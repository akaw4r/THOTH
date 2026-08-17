import { Controller, Get, Logger, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { MeResponse, SessionUser } from '@thoth/shared';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { AllowPendingMfa, CurrentUser, Public, type AuthUser } from './decorators';
import { OidcService } from './oidc.service';
import { UserProvisioningService } from './user-provisioning.service';
import { GoogleDirectoryService } from './google-directory.service';
import { destroySession, ensureCsrfToken, establishSession } from './session.helper';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly oidc: OidcService,
    private readonly provisioning: UserProvisioningService,
    private readonly directory: GoogleDirectoryService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Session state + CSRF token. Called at frontend boot. */
  @Public()
  @Get('me')
  async me(@Req() req: Request): Promise<MeResponse> {
    const csrfToken = ensureCsrfToken(req);
    let user: SessionUser | null = null;
    if (req.session.userId) {
      const dbUser = await this.prisma.user.findUnique({ where: { id: req.session.userId } });
      if (dbUser) {
        user = {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          role: dbUser.role,
          isLocalAdmin: dbUser.isLocalAdmin,
          mfaEnrolled: dbUser.mfaEnrolled,
        };
      }
    }
    return {
      user,
      csrfToken,
      localAdminEnabled: this.config.localAdminEnabled,
      mfaRequired: this.config.mfaRequired,
    };
  }

  /** Starts the Google OIDC flow (redirects to Google's consent screen). */
  @Public()
  @Get('google')
  async googleStart(
    @Req() req: Request,
    @Res() res: Response,
    @Query('returnTo') returnTo?: string,
  ) {
    if (!this.oidc.isReady) {
      return res.redirect('/login?error=google_unavailable');
    }
    const authReq = this.oidc.createAuthRequest();
    req.session.oidc = {
      state: authReq.state,
      nonce: authReq.nonce,
      codeVerifier: authReq.codeVerifier,
      returnTo: sanitizeReturnTo(returnTo),
    };
    return res.redirect(authReq.url);
  }

  /** Google callback. Redirect URI: ${BASE_URL}/api/auth/callback/google */
  @Public()
  @Get('callback/google')
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const pending = req.session.oidc;
    if (!this.oidc.isReady || !pending) {
      return res.redirect('/login?error=invalid_state');
    }
    delete req.session.oidc;

    try {
      const profile = await this.oidc.handleCallback(req.query as Record<string, string>, pending);

      // Google Workspace group gate (when configured): only members of
      // GOOGLE_ALLOWED_GROUPS can log in. Fail-closed.
      if (this.config.googleGroupGatingEnabled) {
        const isMember = await this.directory.isMemberOfAllowedGroup(profile.email);
        if (!isMember) {
          await this.audit.record(
            {
              action: 'auth.google.denied',
              actorEmail: profile.email,
              metadata: { reason: 'not_in_allowed_group' },
            },
            req,
          );
          return res.redirect('/login?error=not_authorized');
        }
      }

      const user = await this.provisioning.provisionFromGoogle(profile);
      if (!user) {
        await this.audit.record(
          {
            action: 'auth.google.denied',
            actorEmail: profile.email,
            metadata: { reason: 'domain_or_verification' },
          },
          req,
        );
        return res.redirect('/login?error=domain_not_allowed');
      }
      await establishSession(req, user);
      await this.audit.record(
        { action: 'auth.google.success', actorId: user.id, actorEmail: user.email },
        req,
      );
      return res.redirect(pending.returnTo || '/');
    } catch (err) {
      this.logger.error(`Error in Google callback: ${(err as Error).message}`);
      return res.redirect('/login?error=oidc_failed');
    }
  }

  @AllowPendingMfa()
  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response, @CurrentUser() user: AuthUser) {
    await this.audit.record(
      { action: 'auth.logout', actorId: user.id, actorEmail: user.email },
      req,
    );
    await destroySession(req);
    res.clearCookie('thoth.sid');
    return res.status(200).json({ ok: true });
  }
}

/** Only accepts internal paths (prevents open redirect). */
function sanitizeReturnTo(returnTo?: string): string | undefined {
  if (!returnTo) return undefined;
  if (returnTo.startsWith('/') && !returnTo.startsWith('//')) return returnTo;
  return undefined;
}
