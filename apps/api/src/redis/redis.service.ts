import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigService } from '../config/config.service';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  /** Client for general use (session, auxiliary rate-limit). */
  readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
    this.client.on('error', (err) => this.logger.error(`Redis: ${err.message}`));
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
