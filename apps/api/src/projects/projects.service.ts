import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import {
  DEFAULT_SECTIONS,
  type CreateProjectInput,
  type ProjectRole,
  type UpdateProjectInput,
} from '@thoth/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../auth/project-access.service';
import { ConfigService } from '../config/config.service';
import type { AuthUser } from '../auth/decorators';

function toDate(value?: string | null): Date | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly config: ConfigService,
  ) {}

  async list(user: AuthUser) {
    const filter = await this.access.visibleProjectFilter(user);
    const projects = await this.prisma.project.findMany({
      where: filter,
      orderBy: { updatedAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        findings: { select: { severity: true } },
        members: { where: { userId: user.id }, select: { role: true } },
      },
    });
    return projects.map((p) => {
      const findingCounts: Record<string, number> = {};
      for (const f of p.findings) findingCounts[f.severity] = (findingCounts[f.severity] ?? 0) + 1;
      return {
        ...this.serialize(p),
        findingCounts,
        myRole: user.role === 'ADMIN' ? 'MANAGER' : (p.members[0]?.role ?? null),
      };
    });
  }

  async getOrThrow(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, email: true, name: true } } } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async detail(projectId: string) {
    const project = await this.getOrThrow(projectId);
    return {
      ...this.serialize(project),
      members: project.members.map((m) => ({
        userId: m.userId,
        role: m.role,
        user: m.user,
      })),
    };
  }

  /** Creates the project, adds the creator as MANAGER and seeds the default sections. */
  async create(user: AuthUser, input: CreateProjectInput) {
    const project = await this.prisma.project.create({
      data: {
        name: input.name,
        client: input.client,
        scope: input.scope,
        startDate: toDate(input.startDate),
        endDate: toDate(input.endDate),
        reportDate: toDate(input.reportDate),
        techLead: input.techLead,
        status: input.status,
        createdById: user.id,
        members: { create: { userId: user.id, role: 'MANAGER' } },
        sections: {
          create: DEFAULT_SECTIONS.map((s, i) => ({
            title: s.title,
            slug: s.slug,
            order: i,
            contentMd: s.contentMd,
          })),
        },
      },
    });
    return this.detail(project.id);
  }

  async update(projectId: string, input: UpdateProjectInput) {
    const data: Prisma.ProjectUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.client !== undefined) data.client = input.client;
    if (input.scope !== undefined) data.scope = input.scope;
    if (input.status !== undefined) data.status = input.status;
    if (input.startDate !== undefined) data.startDate = toDate(input.startDate);
    if (input.endDate !== undefined) data.endDate = toDate(input.endDate);
    if (input.reportDate !== undefined) data.reportDate = toDate(input.reportDate);
    if (input.techLead !== undefined) data.techLead = input.techLead;
    await this.prisma.project.update({ where: { id: projectId }, data });
    return this.detail(projectId);
  }

  async remove(projectId: string) {
    await this.prisma.project.delete({ where: { id: projectId } });
  }

  // ---- members ------------------------------------------------------------

  /**
   * Resolves a user by email; if they don't exist, PRE-CREATES them (domain
   * validated) with the default global role. On the first Google login the
   * provisioning matches by email and completes the record. Rejects emails
   * outside the allowed domains.
   */
  private async resolveOrCreateUserByEmail(email: string): Promise<User> {
    const normalized = email.toLowerCase().trim();
    if (!this.config.isEmailAllowed(normalized)) {
      throw new BadRequestException(
        `Email outside the allowed domains (${this.config.allowedEmailDomains.join(', ')}).`,
      );
    }
    const existing = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (existing) return existing;
    return this.prisma.user.create({
      data: { email: normalized, name: normalized, role: this.config.defaultUserRole },
    });
  }

  async addOrUpdateMember(
    projectId: string,
    ref: { userId?: string; email?: string },
    role: ProjectRole,
  ) {
    const user = ref.userId
      ? await this.prisma.user.findUnique({ where: { id: ref.userId } })
      : await this.resolveOrCreateUserByEmail(ref.email ?? '');
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: user.id } },
      create: { projectId, userId: user.id, role },
      update: { role },
    });
    return this.detail(projectId);
  }

  /**
   * Grants a role to an email on one or more projects at once (admin flow).
   * Pre-creates the user if necessary and validates that all projects exist.
   */
  async grantAccess(email: string, role: ProjectRole, projectIds: string[]) {
    const ids = Array.from(new Set(projectIds));
    const found = await this.prisma.project.count({ where: { id: { in: ids } } });
    if (found !== ids.length) {
      throw new NotFoundException('One or more projects were not found.');
    }
    const user = await this.resolveOrCreateUserByEmail(email);
    await this.prisma.$transaction(
      ids.map((projectId) =>
        this.prisma.projectMember.upsert({
          where: { projectId_userId: { projectId, userId: user.id } },
          create: { projectId, userId: user.id, role },
          update: { role },
        }),
      ),
    );
    return { userId: user.id, email: user.email, role, projectCount: ids.length };
  }

  async removeMember(projectId: string, userId: string) {
    await this.prisma.projectMember
      .delete({ where: { projectId_userId: { projectId, userId } } })
      .catch(() => undefined);
    return this.detail(projectId);
  }

  private serialize(p: {
    id: string;
    name: string;
    client: string;
    scope: string;
    startDate: Date | null;
    endDate: Date | null;
    reportDate: Date | null;
    techLead: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy?: { id: string; name: string; email: string } | null;
  }) {
    return {
      id: p.id,
      name: p.name,
      client: p.client,
      scope: p.scope,
      startDate: p.startDate ? p.startDate.toISOString().slice(0, 10) : null,
      endDate: p.endDate ? p.endDate.toISOString().slice(0, 10) : null,
      reportDate: p.reportDate ? p.reportDate.toISOString().slice(0, 10) : null,
      techLead: p.techLead,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      createdBy: p.createdBy ?? null,
    };
  }
}
