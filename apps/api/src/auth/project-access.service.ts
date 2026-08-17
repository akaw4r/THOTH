import { Injectable } from '@nestjs/common';
import { PROJECT_ROLE_LEVEL, type ProjectRole } from '@thoth/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './decorators';

/**
 * Per-project authorization rules (isolation between projects).
 *
 * - Global ADMIN has full access (effective MANAGER role in any project).
 * - Other users only see projects where they are members.
 */
@Injectable()
export class ProjectAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** The user's effective role in the project, or null if they have no access. */
  async effectiveRole(user: AuthUser, projectId: string): Promise<ProjectRole | null> {
    if (user.role === 'ADMIN') return 'MANAGER';
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    return membership?.role ?? null;
  }

  hasAtLeast(role: ProjectRole | null, required: ProjectRole): boolean {
    if (!role) return false;
    return PROJECT_ROLE_LEVEL[role] >= PROJECT_ROLE_LEVEL[required];
  }

  /** Project IDs visible to the user (used for listing). */
  async visibleProjectFilter(user: AuthUser): Promise<{ id?: { in: string[] } }> {
    if (user.role === 'ADMIN') return {};
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId: user.id },
      select: { projectId: true },
    });
    return { id: { in: memberships.map((m) => m.projectId) } };
  }
}
