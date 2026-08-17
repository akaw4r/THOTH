import { Injectable, Logger } from '@nestjs/common';
import type { User } from '@prisma/client';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import type { OidcProfile } from './oidc.service';

/** Provisions/updates users coming from Google OIDC. */
@Injectable()
export class UserProvisioningService {
  private readonly logger = new Logger(UserProvisioningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Creates the user on the first valid Google login. Default role is configurable;
   * emails in ADMIN_EMAILS come in as admin. Returns null if the email is not
   * from an allowed domain or is not verified.
   */
  async provisionFromGoogle(profile: OidcProfile): Promise<User | null> {
    const email = profile.email.toLowerCase().trim();
    if (!email || !profile.emailVerified) return null;
    if (!this.config.isEmailAllowed(email)) return null;

    const isAdmin = this.config.isAdminEmail(email);
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      // A local admin is never demoted by a Google login.
      const shouldPromote = isAdmin && existing.role !== 'ADMIN' && !existing.isLocalAdmin;
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          name: profile.name || existing.name,
          lastLoginAt: new Date(),
          ...(shouldPromote ? { role: 'ADMIN' } : {}),
        },
      });
    }

    this.logger.log(`Provisioning new Google user: ${email} (admin=${isAdmin})`);
    return this.prisma.user.create({
      data: {
        email,
        name: profile.name || email,
        role: isAdmin ? 'ADMIN' : this.config.defaultUserRole,
        lastLoginAt: new Date(),
      },
    });
  }
}
