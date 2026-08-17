import { Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { REPORT_QUEUE } from '@thoth/shared';
import { parseEncryptionKey } from '@thoth/shared/node';
import { closeBrowser, renderReport } from './render';

interface ReportJobData {
  reportId: string;
  projectId: string;
}

function log(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(`[worker] ${new Date().toISOString()} ${msg}`);
}

async function main(): Promise<void> {
  // Fail-fast like the API: without REDIS_URL the worker would come up "healthy"
  // pointing at a nonexistent Redis and the queue would be consumed by no one.
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is required (e.g. redis://redis:6379)');
  }
  const encryptionKey = parseEncryptionKey(process.env.ENCRYPTION_KEY ?? '');
  const prisma = new PrismaClient();
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

  const worker = new Worker<ReportJobData>(
    REPORT_QUEUE,
    async (job: Job<ReportJobData>) => {
      log(`render started report=${job.data.reportId} project=${job.data.projectId}`);
      await renderReport(job.data.reportId, job.data.projectId, { prisma, encryptionKey });
      log(`render finished report=${job.data.reportId}`);
    },
    { connection, concurrency: 2 },
  );

  worker.on('failed', async (job, err) => {
    log(`FAILURE report=${job?.data.reportId}: ${err.message}`);
    // Only marks FAILED after exhausting the attempts.
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await prisma.report
        .update({
          where: { id: job.data.reportId },
          data: { status: 'FAILED', error: err.message.slice(0, 1000) },
        })
        .catch(() => undefined);
    }
  });

  log(`listening on queue "${REPORT_QUEUE}" (redis: ${redisUrl})`);

  const shutdown = async (): Promise<void> => {
    log('shutting down...');
    await worker.close();
    await closeBrowser();
    await connection.quit();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[worker] fatal error:', err);
  process.exit(1);
});
