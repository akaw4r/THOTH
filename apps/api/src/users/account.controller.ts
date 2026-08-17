import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { totpCodeSchema, webauthnNameSchema } from '@thoth/shared';
import { AuditService } from '../audit/audit.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AllowPendingMfa, CurrentUser, type AuthUser } from '../auth/decorators';
import { MfaService } from '../auth/mfa.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * MFA management for the user's own account (any authenticated user).
 * Different from the local LOGIN flow: here the user is already authenticated
 * and hardens their own account with TOTP/passkeys.
 * @AllowPendingMfa: must be accessible BEFORE enrollment — this is where the
 * first access enrolls the mandatory MFA.
 */
@AllowPendingMfa()
@Controller('account/mfa')
export class AccountController {
  constructor(
    private readonly mfa: MfaService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async loadUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('User not found');
    return user;
  }

  @Get('credentials')
  async credentials(@CurrentUser() user: AuthUser) {
    const creds = await this.mfa.listCredentials(user.id);
    const dbUser = await this.loadUser(user.id);
    return {
      totpEnrolled: Boolean(dbUser.totpSecretEnc),
      webauthn: creds.map((c) => ({
        id: c.id,
        name: c.name,
        createdAt: c.createdAt.toISOString(),
        lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
      })),
    };
  }

  @Get('totp/setup')
  async totpSetup(@Req() req: Request, @CurrentUser() user: AuthUser) {
    const dbUser = await this.loadUser(user.id);
    const { secret, otpauthUrl } = this.mfa.generateTotpSecret(dbUser);
    (req.session as any).accountTotpSecret = secret;
    return { secret, otpauthUrl };
  }

  @Post('totp/enroll')
  async totpEnroll(
    @Req() req: Request,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(totpCodeSchema)) body: { code: string },
  ) {
    const secret = (req.session as any).accountTotpSecret as string | undefined;
    if (!secret) throw new BadRequestException('Start the setup first');
    const ok = await this.mfa.enrollTotp(user.id, secret, body.code);
    if (!ok) throw new BadRequestException('Invalid code');
    delete (req.session as any).accountTotpSecret;
    await this.audit.record(
      { action: 'account.mfa.totp_enrolled', actorId: user.id, actorEmail: user.email },
      req,
    );
    return { ok: true };
  }

  @Get('webauthn/setup')
  async webauthnSetup(@Req() req: Request, @CurrentUser() user: AuthUser) {
    const dbUser = await this.loadUser(user.id);
    const options = await this.mfa.registrationOptions(dbUser);
    req.session.webauthnChallenge = options.challenge;
    return options;
  }

  @Post('webauthn/enroll')
  async webauthnEnroll(
    @Req() req: Request,
    @CurrentUser() user: AuthUser,
    @Body() body: { response: any; name?: string },
  ) {
    const challenge = req.session.webauthnChallenge;
    if (!challenge) throw new BadRequestException('Missing challenge');
    const dbUser = await this.loadUser(user.id);
    const name = webauthnNameSchema.parse({ name: body.name }).name;
    const ok = await this.mfa.verifyRegistration(dbUser, challenge, body.response, name);
    delete req.session.webauthnChallenge;
    if (!ok) throw new BadRequestException('Failed to register passkey');
    await this.audit.record(
      { action: 'account.mfa.webauthn_enrolled', actorId: user.id, actorEmail: user.email },
      req,
    );
    return { ok: true };
  }

  @Delete('webauthn/:id')
  async removeCredential(
    @Req() req: Request,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const cred = await this.prisma.webAuthnCredential.findUnique({ where: { id } });
    if (!cred || cred.userId !== user.id) throw new BadRequestException('Credential not found');
    await this.prisma.webAuthnCredential.delete({ where: { id } });
    await this.audit.record(
      { action: 'account.mfa.webauthn_removed', actorId: user.id, actorEmail: user.email },
      req,
    );
    return { ok: true };
  }
}
