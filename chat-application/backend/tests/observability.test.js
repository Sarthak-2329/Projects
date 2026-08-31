import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Mock Arcjet
vi.mock('../src/middleware/arcjet.middleware.js', () => ({
  arcjetProtection: (_req, _res, next) => next(),
}));

// Mock Resend
vi.mock('../src/lib/resend.js', () => ({
  resendClient: {
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'mock-id' }, error: null }),
    },
  },
  sender: { name: 'Test', email: 'test@test.dev' },
}));

const { app } = await import('../src/lib/createApp.js');

describe('Observability Endpoints', () => {
  describe('GET /api/health', () => {
    it('returns 200 with service health status and live checks', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.services.database.status).toBe('connected');
      // Redis is disabled by default in test environment
      expect(res.body.services.redis.status).toBe('disabled');
    });
  });

  describe('GET /metrics', () => {
    it('returns Prometheus exposition formatted metrics', async () => {
      const res = await request(app).get('/metrics');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/plain/);
      expect(res.text).toContain('http_requests_total');
      expect(res.text).toContain('http_request_duration_seconds');
      expect(res.text).toContain('socket_connections_active');
      expect(res.text).toContain('messages_sent_total');
    });
  });
});
