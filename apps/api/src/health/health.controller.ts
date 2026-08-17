import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Liveness/startup: always 200 while the process responds. Does NOT depend on
   * the database/Redis — a dependency blip must not take down (restart) the pods.
   */
  @Public()
  @Get()
  async health() {
    const { ok, checks } = await this.checkDependencies();
    return { status: ok ? 'ok' : 'degraded', checks };
  }

  /**
   * Readiness: 503 when the database or Redis are down, removing the pod from
   * load balancing until the dependencies come back (without restarting it).
   */
  @Public()
  @Get('ready')
  async ready() {
    const { ok, checks } = await this.checkDependencies();
    if (!ok) {
      throw new ServiceUnavailableException({ status: 'degraded', checks });
    }
    return { status: 'ok', checks };
  }

  private async checkDependencies(): Promise<{ ok: boolean; checks: Record<string, string> }> {
    const checks: Record<string, string> = {};
    let ok = true;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.db = 'up';
    } catch {
      checks.db = 'down';
      ok = false;
    }
    try {
      await this.redis.client.ping();
      checks.redis = 'up';
    } catch {
      checks.redis = 'down';
      ok = false;
    }
    return { ok, checks };
  }
}
