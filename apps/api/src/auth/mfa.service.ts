import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import type { User, WebAuthnCredential } from '@prisma/client';
import { ConfigService } from '../config/config.service';
import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService,
  ) {}

  // ---- TOTP ---------------------------------------------------------------

  /** Generates a TOTP secret and the otpauth URI (for the QR code), without persisting yet. */
  generateTotpSecret(user: User): { secret: string; otpauthUrl: string } {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, 'THOTH', secret);
    return { secret, otpauthUrl };
  }

  verifyTotp(secret: string, token: string): boolean {
    try {
      return authenticator.verify({ token, secret });
    } catch {
      return false;
    }
  }

  /** Confirms the first code, persists the encrypted secret and marks MFA as active. */
  async enrollTotp(userId: string, secret: string, token: string): Promise<boolean> {
    if (!this.verifyTotp(secret, token)) return false;
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecretEnc: this.crypto.encryptString(secret), mfaEnrolled: true },
    });
    return true;
  }

  async verifyUserTotp(user: User, token: string): Promise<boolean> {
    if (!user.totpSecretEnc) return false;
    const secret = this.crypto.decryptString(user.totpSecretEnc);
    return this.verifyTotp(secret, token);
  }

  // ---- WebAuthn / passkeys ------------------------------------------------

  async registrationOptions(user: User) {
    const existing = await this.prisma.webAuthnCredential.findMany({
      where: { userId: user.id },
    });
    const options = await generateRegistrationOptions({
      rpName: this.config.rpName,
      rpID: this.config.rpId,
      userID: Buffer.from(user.id),
      userName: user.email,
      userDisplayName: user.name,
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
      excludeCredentials: existing.map((c) => ({ id: c.id })),
    });
    return options;
  }

  async verifyRegistration(
    user: User,
    expectedChallenge: string,
    response: RegistrationResponseJSON,
    name: string,
  ): Promise<boolean> {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: this.config.webauthnOrigin,
      expectedRPID: this.config.rpId,
      requireUserVerification: false,
    });
    if (!verification.verified || !verification.registrationInfo) return false;

    const { credential } = verification.registrationInfo;
    await this.prisma.webAuthnCredential.create({
      data: {
        id: credential.id,
        userId: user.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        transports: response.response.transports ?? [],
        name: name || 'Passkey',
      },
    });
    await this.prisma.user.update({ where: { id: user.id }, data: { mfaEnrolled: true } });
    return true;
  }

  async authenticationOptions(user: User) {
    const creds = await this.prisma.webAuthnCredential.findMany({ where: { userId: user.id } });
    return generateAuthenticationOptions({
      rpID: this.config.rpId,
      allowCredentials: creds.map((c) => ({ id: c.id, transports: c.transports as never })),
      userVerification: 'preferred',
    });
  }

  async verifyAuthentication(
    user: User,
    expectedChallenge: string,
    response: AuthenticationResponseJSON,
  ): Promise<boolean> {
    const cred: WebAuthnCredential | null = await this.prisma.webAuthnCredential.findUnique({
      where: { id: response.id },
    });
    if (!cred || cred.userId !== user.id) return false;

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: this.config.webauthnOrigin,
      expectedRPID: this.config.rpId,
      requireUserVerification: false,
      credential: {
        id: cred.id,
        publicKey: new Uint8Array(cred.publicKey),
        counter: Number(cred.counter),
        transports: cred.transports as never,
      },
    });
    if (!verification.verified) return false;

    await this.prisma.webAuthnCredential.update({
      where: { id: cred.id },
      data: { counter: BigInt(verification.authenticationInfo.newCounter), lastUsedAt: new Date() },
    });
    return true;
  }

  async listCredentials(userId: string) {
    return this.prisma.webAuthnCredential.findMany({
      where: { userId },
      select: { id: true, name: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}
