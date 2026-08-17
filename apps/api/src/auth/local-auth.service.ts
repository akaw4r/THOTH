import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export type LocalVerifyResult =
  { ok: true; user: User } | { ok: false; reason: 'invalid' | 'locked' | 'disabled' };

/**
 * Local admin authentication (break-glass): Argon2id + progressive lockout.
 * The first factor (password) is verified here; the second (MFA) is orchestrated
 * by the controller. While locked out, not even the correct password passes.
 */
@Injectable()
export class LocalAuthService {
  private readonly logger = new Logger(LocalAuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  static hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verifyPassword(username: string, password: string): Promise<LocalVerifyResult> {
    const user = await this.prisma.user.findUnique({ where: { username } });

    // Verifies a dummy hash when the user does not exist, to avoid leaking
    // which usernames are valid via timing.
    if (!user || !user.isLocalAdmin || !user.passwordHash) {
      await argon2
        .verify(
          '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0$0000000000000000000000000000000000000000000',
          password,
        )
        .catch(() => undefined);
      return { ok: false, reason: 'invalid' };
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return { ok: false, reason: 'locked' };
    }

    const valid = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!valid) {
      await this.registerFailure(user);
      return { ok: false, reason: 'invalid' };
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }
    return { ok: true, user };
  }

  private async registerFailure(user: User): Promise<void> {
    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: shouldLock ? 0 : attempts,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
      },
    });
    if (shouldLock) {
      this.logger.warn(`Local admin ${user.username} locked out for ${LOCKOUT_MINUTES} min`);
    }
  }

  async setPassword(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await LocalAuthService.hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
  }

  async markLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }
}
