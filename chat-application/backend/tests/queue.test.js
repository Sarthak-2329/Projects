import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Resend client
vi.mock('../src/lib/resend.js', () => ({
  resendClient: {
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'mock-resend-id' }, error: null }),
    },
  },
  sender: { name: 'Test Chat', email: 'test@example.com' },
}));

// Mock logger to avoid test noise
vi.mock('../src/lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  processEmailJob,
  enqueueEmail,
  JOB_WELCOME_EMAIL,
  JOB_VERIFICATION_EMAIL,
  JOB_PASSWORD_RESET_EMAIL,
} from '../src/lib/queue.js';
import { resendClient } from '../src/lib/resend.js';

describe('BullMQ Email Job Processor & Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processEmailJob', () => {
    it('processes verificationEmail job and triggers resend', async () => {
      const job = {
        name: JOB_VERIFICATION_EMAIL,
        data: {
          email: 'user@test.com',
          name: 'Test User',
          verifyLink: 'http://localhost:5173/verify-email/mock-token',
        },
      };

      await processEmailJob(job);

      expect(resendClient.emails.send).toHaveBeenCalledTimes(1);
      const callArgs = resendClient.emails.send.mock.calls[0][0];
      expect(callArgs.to).toBe('user@test.com');
      expect(callArgs.subject).toContain('Verify');
      expect(callArgs.html).toContain('http://localhost:5173/verify-email/mock-token');
    });

    it('processes welcomeEmail job and triggers resend', async () => {
      const job = {
        name: JOB_WELCOME_EMAIL,
        data: {
          email: 'alice@test.com',
          name: 'Alice',
          clientURL: 'http://localhost:5173',
        },
      };

      await processEmailJob(job);

      expect(resendClient.emails.send).toHaveBeenCalledTimes(1);
      const callArgs = resendClient.emails.send.mock.calls[0][0];
      expect(callArgs.to).toBe('alice@test.com');
      expect(callArgs.subject).toContain('Welcome');
    });

    it('processes passwordResetEmail job and triggers resend', async () => {
      const job = {
        name: JOB_PASSWORD_RESET_EMAIL,
        data: {
          email: 'bob@test.com',
          name: 'Bob',
          resetLink: 'http://localhost:5173/reset-password/reset-token-123',
        },
      };

      await processEmailJob(job);

      expect(resendClient.emails.send).toHaveBeenCalledTimes(1);
      const callArgs = resendClient.emails.send.mock.calls[0][0];
      expect(callArgs.to).toBe('bob@test.com');
      expect(callArgs.subject).toContain('Reset');
      expect(callArgs.html).toContain('reset-token-123');
    });

    it('throws on unknown job name', async () => {
      const job = {
        name: 'unknownJob',
        data: { email: 'test@example.com' },
      };

      await expect(processEmailJob(job)).rejects.toThrow(/Unknown email job type/);
    });
  });

  describe('enqueueEmail (in-process fallback when Redis is absent)', () => {
    it('executes the fallback job processor directly when REDIS_URL is unset', async () => {
      await enqueueEmail(JOB_VERIFICATION_EMAIL, {
        email: 'fallback@test.com',
        name: 'Fallback User',
        verifyLink: 'http://localhost:5173/verify-email/fallback-token',
      });

      expect(resendClient.emails.send).toHaveBeenCalledTimes(1);
      expect(resendClient.emails.send.mock.calls[0][0].to).toBe('fallback@test.com');
    });
  });
});
