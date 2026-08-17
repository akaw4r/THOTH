import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  changePasswordSchema,
  localLoginSchema,
  totpCodeSchema,
  webauthnNameSchema,
  type LocalLoginResponse,
  type LocalLoginStep,
} from '@thoth/shared';
import type { User } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { LocalAuthService } from './local-auth.service';
import { MfaService } from './mfa.service';
import { Public } from './decorators';
import { establishSession } from './session.helper';

/**
 * Local admin break-glass flow — separate and UNADVERTISED route (/auth/local
 * on the front end → /api/auth/local here). It never appears on the main login screen.
 *
 * State machine (the session holds `pendingLocal`, but NOT `userId` until the end):
 *   password → [password change] → [MFA setup] → MFA verification → session
 */
@Controller('auth/local')
export class LocalAuthController {
  private readonly logger = new Logger(LocalAuthController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly localAuth: LocalAuthService,
    private readonly mfa: MfaService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private assertEnabled(): void {
    if (!this.config.localAdminEnabled) {
      throw new UnauthorizedException('Local admin disabled');
    }
  }

  private async loadPendingUser(req: Request): Promise<User> {
    const pending = req.session.pendingLocal;
    if (!pending) throw new UnauthorizedException('No login in progress');
    const user = await this.prisma.user.findUnique({ where: { id: pending.userId } });
    if (!user || !user.isLocalAdmin) throw new UnauthorizedException('Invalid session');
    return user;
  }

  private stepFor(req: Request): LocalLoginStep {
    const p = req.session.pendingLocal!;
    if (p.awaitingPasswordChange) return 'password_change_required';
    if (p.awaitingMfaSetup) return 'mfa_setup_required';
    if (p.awaitingMfa) return 'mfa_required';
    return 'authenticated';
  }

  /** Finalizes when no pending factors remain. */
  private async finalizeIfReady(req: Request, user: User): Promise<LocalLoginStep> {
    const p = req.session.pendingLocal!;
    if (p.awaitingPasswordChange || p.awaitingMfaSetup || p.awaitingMfa) {
      return this.stepFor(req);
    }
    const fresh = await this.prisma.user.findUnique({ where: { id: user.id } });
    await establishSession(req, fresh!);
    await this.localAuth.markLogin(user.id);
    await this.audit.record(
      { action: 'auth.local.success', actorId: user.id, actorEmail: user.email },
      req,
    );
    return 'authenticated';
  }

  // ---- step 1: password ---------------------------------------------------

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  async login(
    @Req() req: Request,
    @Body(new ZodValidationPipe(localLoginSchema)) body: { username: string; password: string },
  ): Promise<LocalLoginResponse> {
    this.assertEnabled();
    const result = await this.localAuth.verifyPassword(body.username, body.password);

    if (!result.ok) {
      await this.audit.record(
        {
          action: 'auth.local.failure',
          actorEmail: body.username,
          metadata: { reason: result.reason },
        },
        req,
      );
      if (result.reason === 'locked') {
        throw new UnauthorizedException('Account temporarily locked. Try again later.');
      }
      throw new UnauthorizedException('Invalid username or password');
    }

    const user = result.user;
    req.session.pendingLocal = {
      userId: user.id,
      awaitingPasswordChange: user.mustChangePassword,
      awaitingMfaSetup: !user.mfaEnrolled,
      awaitingMfa: user.mfaEnrolled,
    };

    const step = await this.finalizeIfReady(req, user);
    return { step, methods: user.mfaEnrolled ? await this.availableMethods(user.id) : undefined };
  }

  private async availableMethods(userId: string): Promise<Array<'totp' | 'webauthn'>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const creds = await this.mfa.listCredentials(userId);
    const methods: Array<'totp' | 'webauthn'> = [];
    if (user?.totpSecretEnc) methods.push('totp');
    if (creds.length > 0) methods.push('webauthn');
    return methods;
  }

  /**
   * Skips MFA enrollment during first login. Only available when
   * MFA_REQUIRED=false; the user can enroll later in Account settings.
   */
  @Public()
  @Post('mfa/skip')
  async mfaSkip(@Req() req: Request): Promise<LocalLoginResponse> {
    this.assertEnabled();
    if (this.config.mfaRequired) {
      throw new ForbiddenException('MFA is required on this server.');
    }
    const user = await this.loadPendingUser(req);
    const pending = req.session.pendingLocal!;
    if (!pending.awaitingMfaSetup) {
      throw new BadRequestException('No MFA enrollment pending');
    }
    pending.awaitingMfaSetup = false;
    await this.audit.record(
      { action: 'auth.local.mfa_skipped', actorId: user.id, actorEmail: user.email },
      req,
    );
    return { step: await this.finalizeIfReady(req, user) };
  }

  // ---- mandatory password change ------------------------------------------

  @Public()
  @Post('password')
  async changePassword(
    @Req() req: Request,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: { newPassword: string },
  ): Promise<LocalLoginResponse> {
    this.assertEnabled();
    const user = await this.loadPendingUser(req);
    if (!req.session.pendingLocal!.awaitingPasswordChange) {
      throw new BadRequestException('Password change is not required');
    }
    await this.localAuth.setPassword(user.id, body.newPassword);
    req.session.pendingLocal!.awaitingPasswordChange = false;
    await this.audit.record(
      { action: 'auth.local.password_changed', actorId: user.id, actorEmail: user.email },
      req,
    );
    const step = await this.finalizeIfReady(req, user);
    return { step };
  }

  // ---- MFA setup (TOTP) ---------------------------------------------------

  @Public()
  @Get('mfa/totp/setup')
  async totpSetup(@Req() req: Request): Promise<{ secret: string; otpauthUrl: string }> {
    this.assertEnabled();
    const user = await this.loadPendingUser(req);
    if (!req.session.pendingLocal!.awaitingMfaSetup) {
      throw new BadRequestException('MFA already configured');
    }
    const { secret, otpauthUrl } = this.mfa.generateTotpSecret(user);
    // Keeps the temporary secret in the session until the first code is confirmed.
    req.session.pendingLocal!.userId = user.id;
    (req.session as any).totpSetupSecret = secret;
    return { secret, otpauthUrl };
  }

  @Public()
  @Post('mfa/totp/enroll')
  async totpEnroll(
    @Req() req: Request,
    @Body(new ZodValidationPipe(totpCodeSchema)) body: { code: string },
  ): Promise<LocalLoginResponse> {
    this.assertEnabled();
    const user = await this.loadPendingUser(req);
    const secret = (req.session as any).totpSetupSecret as string | undefined;
    if (!secret) throw new BadRequestException('Start the TOTP setup first');
    const ok = await this.mfa.enrollTotp(user.id, secret, body.code);
    if (!ok) throw new BadRequestException('Invalid TOTP code');
    delete (req.session as any).totpSetupSecret;
    req.session.pendingLocal!.awaitingMfaSetup = false;
    req.session.pendingLocal!.awaitingMfa = false;
    await this.audit.record(
      {
        action: 'auth.local.mfa_enrolled',
        actorId: user.id,
        actorEmail: user.email,
        metadata: { method: 'totp' },
      },
      req,
    );
    const step = await this.finalizeIfReady(req, user);
    return { step };
  }

  // ---- MFA verification (TOTP) --------------------------------------------

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('mfa/totp')
  async totpVerify(
    @Req() req: Request,
    @Body(new ZodValidationPipe(totpCodeSchema)) body: { code: string },
  ): Promise<LocalLoginResponse> {
    this.assertEnabled();
    const user = await this.loadPendingUser(req);
    if (!req.session.pendingLocal!.awaitingMfa) {
      throw new BadRequestException('MFA not required at this step');
    }
    const ok = await this.mfa.verifyUserTotp(user, body.code);
    if (!ok) {
      await this.audit.record(
        {
          action: 'auth.local.mfa_failure',
          actorId: user.id,
          actorEmail: user.email,
          metadata: { method: 'totp' },
        },
        req,
      );
      throw new UnauthorizedException('Invalid TOTP code');
    }
    req.session.pendingLocal!.awaitingMfa = false;
    const step = await this.finalizeIfReady(req, user);
    return { step };
  }

  // ---- WebAuthn: setup (registration) --------------------------------------

  @Public()
  @Get('mfa/webauthn/setup')
  async webauthnSetup(@Req() req: Request) {
    this.assertEnabled();
    const user = await this.loadPendingUser(req);
    const options = await this.mfa.registrationOptions(user);
    req.session.webauthnChallenge = options.challenge;
    return options;
  }

  @Public()
  @Post('mfa/webauthn/enroll')
  async webauthnEnroll(
    @Req() req: Request,
    @Body() body: { response: any; name?: string },
  ): Promise<LocalLoginResponse> {
    this.assertEnabled();
    const user = await this.loadPendingUser(req);
    const challenge = req.session.webauthnChallenge;
    if (!challenge) throw new BadRequestException('Missing WebAuthn challenge');
    const name = webauthnNameSchema.parse({ name: body.name }).name;
    const ok = await this.mfa.verifyRegistration(user, challenge, body.response, name);
    delete req.session.webauthnChallenge;
    if (!ok) throw new BadRequestException('Failed to register passkey');
    req.session.pendingLocal!.awaitingMfaSetup = false;
    req.session.pendingLocal!.awaitingMfa = false;
    await this.audit.record(
      {
        action: 'auth.local.mfa_enrolled',
        actorId: user.id,
        actorEmail: user.email,
        metadata: { method: 'webauthn' },
      },
      req,
    );
    const step = await this.finalizeIfReady(req, user);
    return { step };
  }

  // ---- WebAuthn: verification (login) --------------------------------------

  @Public()
  @Get('mfa/webauthn/options')
  async webauthnOptions(@Req() req: Request) {
    this.assertEnabled();
    const user = await this.loadPendingUser(req);
    const options = await this.mfa.authenticationOptions(user);
    req.session.webauthnChallenge = options.challenge;
    return options;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('mfa/webauthn')
  async webauthnVerify(
    @Req() req: Request,
    @Body() body: { response: any },
  ): Promise<LocalLoginResponse> {
    this.assertEnabled();
    const user = await this.loadPendingUser(req);
    const challenge = req.session.webauthnChallenge;
    if (!challenge) throw new BadRequestException('Missing WebAuthn challenge');
    const ok = await this.mfa.verifyAuthentication(user, challenge, body.response);
    delete req.session.webauthnChallenge;
    if (!ok) {
      await this.audit.record(
        {
          action: 'auth.local.mfa_failure',
          actorId: user.id,
          actorEmail: user.email,
          metadata: { method: 'webauthn' },
        },
        req,
      );
      throw new UnauthorizedException('Invalid passkey');
    }
    req.session.pendingLocal!.awaitingMfa = false;
    const step = await this.finalizeIfReady(req, user);
    return { step };
  }
}
