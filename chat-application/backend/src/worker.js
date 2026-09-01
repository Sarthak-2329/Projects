import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { ENV } from './lib/env.js';
import { logger } from './lib/logger.js';
import { QUEUE_NAME_EMAIL, processEmailJob } from './lib/queue.js';

if (!ENV.REDIS_URL) {
  logger.error('Cannot start BullMQ worker: REDIS_URL is not configured');
  process.exit(1);
}

const connection = new Redis(ENV.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const worker = new Worker(
  QUEUE_NAME_EMAIL,
  async (job) => {
    logger.info(
      {
        jobId: job.id,
        jobName: job.name,
        attempt: job.attemptsMade + 1,
      },
      'Worker started processing email job'
    );
    return await processEmailJob(job);
  },
  {
    connection,
    concurrency: 5,
  }
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id, jobName: job.name }, 'Worker successfully completed email job');
});

worker.on('failed', (job, err) => {
  logger.error(
    {
      jobId: job?.id,
      jobName: job?.name,
      attemptsMade: job?.attemptsMade,
      error: err.message,
    },
    'Worker failed processing email job'
  );
});

worker.on('error', (err) => {
  logger.error({ error: err.message }, 'BullMQ worker error');
});

logger.info('BullMQ email worker is active and awaiting jobs');

async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down BullMQ worker gracefully...');
  try {
    await worker.close();
    await connection.quit();
    logger.info('BullMQ worker stopped');
    process.exit(0);
  } catch (err) {
    logger.error({ error: err.message }, 'Error during worker shutdown');
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
