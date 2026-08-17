import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  action: string;
  actorId?: string | null;
  actorEmail?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Extracts the real IP taking the reverse proxy into account (Caddy sets X-Forwarded-For). */
export function clientIp(req: Request): string | null {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return req.ip ?? req.socket?.remoteAddress ?? null;
}

/**
 * Append-only audit log. Write failures never take down the business
 * operation — they only log an error (the log is best-effort but immutable).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, req?: Request): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          actorId: entry.actorId ?? req?.session?.userId ?? null,
          actorEmail: entry.actorEmail ?? null,
          entityType: entry.entityType ?? null,
          entityId: entry.entityId ?? null,
          ip: req ? clientIp(req) : null,
          userAgent: req?.headers['user-agent'] ?? null,
          metadata: (entry.metadata ?? undefined) as never,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write audit log (${entry.action}): ${(err as Error).message}`);
    }
  }
}
