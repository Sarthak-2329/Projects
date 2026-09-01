import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { ENV } from './env.js';
import { logger } from './logger.js';
import {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
} from '../emails/emailHandlers.js';

export const JOB_WELCOME_EMAIL = 'welcomeEmail';
export const JOB_VERIFICATION_EMAIL = 'verificationEmail';
export const JOB_PASSWORD_RESET_EMAIL = 'passwordResetEmail';

export const QUEUE_NAME_EMAIL = 'email';

let emailQueue = null;
let queueRedisClient = null;

if (ENV.REDIS_URL) {
  try {
    queueRedisClient = new Redis(ENV.REDIS_URL, {
      maxRetriesPerRequest: null,
    });

    emailQueue = new Queue(QUEUE_NAME_EMAIL, {
      connection: queueRedisClient,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    logger.info('BullMQ email queue successfully initialized with Redis');
  } catch (err) {
    logger.warn({ error: err.message }, 'Failed to initialize BullMQ email queue; falling back to direct email handling');
    emailQueue = null;
  }
}

/**
 * Worker processor function for email jobs. Reused by backend/src/worker.js
 * and direct in-process fallback.
 */
export async function processEmailJob(job) {
  const { name, data } = job;
  logger.info({ jobName: name, email: data?.email }, 'Processing email job');

  switch (name) {
    case JOB_WELCOME_EMAIL:
      return await sendWelcomeEmail(data.email, data.name, data.clientURL);

    case JOB_VERIFICATION_EMAIL:
      return await sendVerificationEmail(data.email, data.name, data.verifyLink);

    case JOB_PASSWORD_RESET_EMAIL:
      return await sendPasswordResetEmail(data.email, data.name, data.resetLink);

    default:
      throw new Error(`Unknown email job type: ${name}`);
  }
}

/**
 * Enqueues an email job to BullMQ if Redis is available, or executes
 * directly in-process when REDIS_URL is unset.
 */
export async function enqueueEmail(jobName, payload) {
  if (emailQueue) {
    try {
      const job = await emailQueue.add(jobName, payload);
      logger.info({ jobId: job.id, jobName, recipient: payload?.email }, 'Enqueued email job to BullMQ');
      return job;
    } catch (err) {
      logger.error(
        { error: err.message, jobName, recipient: payload?.email },
        'Failed to enqueue email to BullMQ, falling back to direct execution'
      );
      // Fall through to direct execution below
    }
  }

  // Graceful fallback when REDIS_URL is not set or queueing failed
  try {
    logger.info({ jobName, recipient: payload?.email }, 'Running email job directly via fallback');
    await processEmailJob({ name: jobName, data: payload });
  } catch (err) {
    logger.error({ error: err.message, jobName, recipient: payload?.email }, 'Fallback email send failed');
  }
}

export { emailQueue, queueRedisClient };
