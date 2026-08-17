import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { safeEqual } from '@thoth/shared/node';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_HEADER = 'x-csrf-token';

/**
 * Double-submit CSRF protection: state-changing methods require the
 * X-CSRF-Token header to match the token stored in the session. Cookies are
 * SameSite=Lax, so this is defense in depth against cross-site POSTs.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;

    const sessionToken = req.session?.csrfToken;
    const headerToken = req.headers[CSRF_HEADER];
    if (!sessionToken || typeof headerToken !== 'string' || !safeEqual(sessionToken, headerToken)) {
      throw new ForbiddenException('Missing or invalid CSRF token');
    }
    return true;
  }
}
