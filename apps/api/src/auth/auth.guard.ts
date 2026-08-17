import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ALLOW_PENDING_MFA, IS_PUBLIC, type AuthUser } from './decorators';

/**
 * Requires an authenticated session and loads the user from the database (source
 * of truth for role/state). Orphaned sessions (user removed) are destroyed.
 * MFA is mandatory on first access: without enrollment, only routes marked
 * with @AllowPendingMfa (MFA enrollment and logout) go through.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const userId = req.session?.userId;
    if (!userId) {
      throw new UnauthorizedException('Not authenticated');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      req.session.destroy(() => undefined);
      throw new UnauthorizedException('Invalid session');
    }

    if (!user.mfaEnrolled) {
      const allowPendingMfa = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_MFA, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowPendingMfa) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'mfa_enrollment_required',
          message: 'Set up MFA to access THOTH.',
        });
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isLocalAdmin: user.isLocalAdmin,
    };
    return true;
  }
}
