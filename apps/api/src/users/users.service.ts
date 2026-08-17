import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { Role } from '@thoth/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private serialize(u: User) {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isLocalAdmin: u.isLocalAdmin,
      mfaEnrolled: u.mfaEnrolled,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    };
  }

  async list() {
    const users = await this.prisma.user.findMany({ orderBy: { name: 'asc' } });
    return users.map((u) => this.serialize(u));
  }

  async updateRole(id: string, role: Role) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({ where: { id }, data: { role } });
    return this.serialize(updated);
  }

  /**
   * Adds/updates a user by email with a global role (including ADMIN).
   * Validates the domain and pre-creates if necessary — on the first Google
   * login the provisioning matches by email and keeps the role (login never demotes).
   */
  async upsertByEmail(email: string, role: Role) {
    const normalized = email.toLowerCase().trim();
    if (!this.config.isEmailAllowed(normalized)) {
      throw new BadRequestException(
        `Email outside the allowed domains (${this.config.allowedEmailDomains.join(', ')}).`,
      );
    }
    const existing = await this.prisma.user.findUnique({ where: { email: normalized } });
    const user = existing
      ? await this.prisma.user.update({ where: { id: existing.id }, data: { role } })
      : await this.prisma.user.create({ data: { email: normalized, name: normalized, role } });
    return this.serialize(user);
  }
}
