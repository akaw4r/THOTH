import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { auditQuerySchema } from '@thoth/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { Roles } from '../auth/decorators';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

interface AuditQuery {
  page: number;
  pageSize: number;
  action?: string;
  actorEmail?: string;
}

/** Audit log query — ADMIN only, read-only. */
@Controller('audit')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query(new ZodValidationPipe(auditQuerySchema)) query: AuditQuery) {
    const where: Record<string, unknown> = {};
    if (query.action) where.action = { contains: query.action };
    if (query.actorEmail) where.actorEmail = { contains: query.actorEmail.toLowerCase() };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id.toString(),
        action: r.action,
        actorEmail: r.actorEmail,
        entityType: r.entityType,
        entityId: r.entityId,
        ip: r.ip,
        userAgent: r.userAgent,
        metadata: r.metadata,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
