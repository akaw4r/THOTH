import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { ProjectRole } from '@thoth/shared';
import { PROJECT_ROLE_KEY, type AuthUser } from './decorators';
import { ProjectAccessService } from './project-access.service';

/**
 * Ensures the user has the minimum required role in the project identified by
 * :projectId (or :id on project routes). Returns 404 — not 403 — when the user
 * has no access at all, to avoid leaking the project's existence.
 */
@Injectable()
export class ProjectRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: ProjectAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<ProjectRole>(PROJECT_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser; projectRole?: ProjectRole }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    const projectId = req.params.projectId ?? req.params.id;
    if (!projectId) throw new NotFoundException('Project not found');

    const role = await this.access.effectiveRole(user, projectId);
    if (!role) throw new NotFoundException('Project not found');
    if (!this.access.hasAtLeast(role, required)) {
      throw new ForbiddenException('Insufficient permission in this project');
    }

    req.projectRole = role;
    return true;
  }
}
