import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { ProjectRole, Role } from '@thoth/shared';

/** Marks a route as public (bypasses AuthGuard). */
export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Allows access for an authenticated user who has NOT yet enrolled MFA
 * (enrollment is mandatory on first access). Use only on the routes needed
 * to enroll MFA or sign out (e.g. /account/mfa/*, logout).
 */
export const ALLOW_PENDING_MFA = 'allowPendingMfa';
export const AllowPendingMfa = () => SetMetadata(ALLOW_PENDING_MFA, true);

/** Required global roles (RolesGuard). */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Minimum required project role (ProjectRoleGuard). */
export const PROJECT_ROLE_KEY = 'projectRole';
export const RequireProjectRole = (role: ProjectRole) => SetMetadata(PROJECT_ROLE_KEY, role);

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isLocalAdmin: boolean;
}

/** Injects the authenticated user resolved by AuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    return req.user as AuthUser;
  },
);

/** Injects the user's effective role in the project (set by ProjectRoleGuard). */
export const ProjectRoleParam = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ProjectRole | null => {
    const req = ctx.switchToHttp().getRequest<Request & { projectRole?: ProjectRole }>();
    return req.projectRole ?? null;
  },
);
