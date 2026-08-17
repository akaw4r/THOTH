import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { CryptoModule } from './crypto/crypto.module';
import { AuditModule } from './audit/audit.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { CsrfGuard } from './auth/csrf.guard';
import { HealthModule } from './health/health.module';
import { ProjectsModule } from './projects/projects.module';
import { FindingsModule } from './findings/findings.module';
import { TemplatesModule } from './templates/templates.module';
import { OwaspModule } from './owasp/owasp.module';
import { SectionsModule } from './sections/sections.module';
import { DesignsModule } from './designs/designs.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';
import { AiModule } from './ai/ai.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    CryptoModule,
    AuditModule,
    QueueModule,
    // Global rate-limiting: 120 req/min per IP (defense in depth;
    // auth routes have stricter limits via @Throttle).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    AuthModule,
    HealthModule,
    ProjectsModule,
    FindingsModule,
    TemplatesModule,
    OwaspModule,
    SectionsModule,
    DesignsModule,
    AttachmentsModule,
    ReportsModule,
    UsersModule,
    AiModule,
    DashboardModule,
  ],
  providers: [
    // Order matters: throttler → auth (session) → CSRF.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule {}
