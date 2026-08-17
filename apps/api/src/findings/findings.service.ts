import { Injectable, NotFoundException } from '@nestjs/common';
import {
  evaluateCvssVector,
  type CreateFindingInput,
  type UpdateFindingInput,
} from '@thoth/shared';
import type { Finding, OwaspCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { serializeOwasp } from '../owasp/owasp.serialize';
import type { AuthUser } from '../auth/decorators';

/** Relations always loaded with the finding for serialization. */
const FINDING_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
  owaspCategory: true,
} satisfies Prisma.FindingInclude;

type FindingWithRelations = Finding & {
  createdBy?: { id: string; name: string } | null;
  owaspCategory?: OwaspCategory | null;
};

@Injectable()
export class FindingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(projectId: string) {
    const findings = await this.prisma.finding.findMany({
      where: { projectId },
      orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }],
      include: FINDING_INCLUDE,
    });
    return findings.map((f) => this.serialize(f));
  }

  async get(projectId: string, findingId: string) {
    const finding = await this.prisma.finding.findFirst({
      where: { id: findingId, projectId },
      include: FINDING_INCLUDE,
    });
    if (!finding) throw new NotFoundException('Finding not found');
    return this.serialize(finding);
  }

  /** Derives the CVSS score from the vector, if present. */
  private cvssFields(vector?: string | null): {
    cvssVector: string | null;
    cvssScore: number | null;
  } {
    if (!vector) return { cvssVector: null, cvssScore: null };
    const evaluated = evaluateCvssVector(vector);
    return { cvssVector: vector, cvssScore: evaluated?.score ?? null };
  }

  async create(projectId: string, user: AuthUser, input: CreateFindingInput) {
    const cvss = this.cvssFields(input.cvssVector);
    const finding = await this.prisma.finding.create({
      data: {
        projectId,
        title: input.title,
        severity: input.severity,
        status: input.status,
        descriptionMd: input.descriptionMd,
        impactMd: input.impactMd,
        recommendationMd: input.recommendationMd,
        referencesMd: input.referencesMd,
        affectedAssets: input.affectedAssets,
        head: input.head,
        tribe: input.tribe,
        squad: input.squad,
        techLead: input.techLead,
        owaspCategoryId: input.owaspCategoryId ?? null,
        createdById: user.id,
        ...cvss,
      },
      include: FINDING_INCLUDE,
    });
    return this.serialize(finding);
  }

  async createFromTemplate(projectId: string, user: AuthUser, templateId: string) {
    const tpl = await this.prisma.findingTemplate.findUnique({ where: { id: templateId } });
    if (!tpl) throw new NotFoundException('Template not found');
    const cvss = this.cvssFields(tpl.cvssVector);
    const finding = await this.prisma.finding.create({
      data: {
        projectId,
        title: tpl.title,
        severity: tpl.severity,
        descriptionMd: tpl.descriptionMd,
        impactMd: tpl.impactMd,
        recommendationMd: tpl.recommendationMd,
        referencesMd: tpl.referencesMd,
        templateId: tpl.id,
        // Inherits the OWASP classification from the template.
        owaspCategoryId: tpl.owaspCategoryId,
        createdById: user.id,
        ...cvss,
      },
      include: FINDING_INCLUDE,
    });
    return this.serialize(finding);
  }

  async update(projectId: string, findingId: string, user: AuthUser, input: UpdateFindingInput) {
    const current = await this.prisma.finding.findFirst({ where: { id: findingId, projectId } });
    if (!current) throw new NotFoundException('Finding not found');

    const data: Record<string, unknown> = {};
    for (const key of [
      'title',
      'severity',
      'status',
      'descriptionMd',
      'impactMd',
      'recommendationMd',
      'referencesMd',
      'affectedAssets',
      'head',
      'tribe',
      'squad',
      'techLead',
      'owaspCategoryId',
    ] as const) {
      if (input[key] !== undefined) data[key] = input[key];
    }
    if (input.cvssVector !== undefined) {
      Object.assign(data, this.cvssFields(input.cvssVector));
    }

    // Saves a snapshot of the previous state (history/versioning) in the same transaction.
    const [, updated] = await this.prisma.$transaction([
      this.prisma.findingRevision.create({
        data: {
          findingId,
          editedById: user.id,
          editedByName: user.name,
          snapshot: this.snapshot(current) as Prisma.InputJsonValue,
        },
      }),
      this.prisma.finding.update({
        where: { id: findingId },
        data,
        include: FINDING_INCLUDE,
      }),
    ]);
    return this.serialize(updated);
  }

  async remove(projectId: string, findingId: string) {
    const current = await this.prisma.finding.findFirst({ where: { id: findingId, projectId } });
    if (!current) throw new NotFoundException('Finding not found');
    await this.prisma.finding.delete({ where: { id: findingId } });
  }

  async revisions(projectId: string, findingId: string) {
    const finding = await this.prisma.finding.findFirst({ where: { id: findingId, projectId } });
    if (!finding) throw new NotFoundException('Finding not found');
    const revisions = await this.prisma.findingRevision.findMany({
      where: { findingId },
      orderBy: { createdAt: 'desc' },
    });
    return revisions.map((r) => ({
      id: r.id,
      editedBy: r.editedById ? { id: r.editedById, name: r.editedByName ?? '—' } : null,
      createdAt: r.createdAt.toISOString(),
      snapshot: r.snapshot,
    }));
  }

  private snapshot(f: Finding): Record<string, unknown> {
    return {
      title: f.title,
      severity: f.severity,
      cvssVector: f.cvssVector,
      status: f.status,
      descriptionMd: f.descriptionMd,
      impactMd: f.impactMd,
      recommendationMd: f.recommendationMd,
      referencesMd: f.referencesMd,
      affectedAssets: f.affectedAssets,
      head: f.head,
      tribe: f.tribe,
      squad: f.squad,
      techLead: f.techLead,
      owaspCategoryId: f.owaspCategoryId,
    };
  }

  private serialize(f: FindingWithRelations) {
    return {
      id: f.id,
      projectId: f.projectId,
      title: f.title,
      severity: f.severity,
      cvssVector: f.cvssVector,
      cvssScore: f.cvssScore,
      status: f.status,
      descriptionMd: f.descriptionMd,
      impactMd: f.impactMd,
      recommendationMd: f.recommendationMd,
      referencesMd: f.referencesMd,
      affectedAssets: f.affectedAssets,
      head: f.head,
      tribe: f.tribe,
      squad: f.squad,
      techLead: f.techLead,
      owaspCategoryId: f.owaspCategoryId,
      owaspCategory: serializeOwasp(f.owaspCategory ?? null),
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
      createdBy: f.createdBy ?? null,
    };
  }
}
