import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { REPORT_QUEUE } from '@thoth/shared';
import { ConfigService } from '../config/config.service';

export interface ReportJobData {
  reportId: string;
  projectId: string;
}

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly connection: Redis;
  readonly reportQueue: Queue<ReportJobData>;

  constructor(config: ConfigService) {
    this.connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
    this.reportQueue = new Queue<ReportJobData>(REPORT_QUEUE, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    });
  }

  async enqueueReport(data: ReportJobData): Promise<void> {
    await this.reportQueue.add('render', data);
  }

  async onModuleDestroy(): Promise<void> {
    await this.reportQueue.close();
    await this.connection.quit();
  }
}
