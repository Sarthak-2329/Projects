import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Mock external services BEFORE any module that imports them is loaded.
// ---------------------------------------------------------------------------

// Arcjet — always allow in tests
vi.mock('../src/middleware/arcjet.middleware.js', () => ({
  arcjetProtection: (_req, _res, next) => next(),
}));

// Resend — capture calls so we can extract the verification token from the URL
vi.mock('../src/lib/resend.js', () => ({
  resendClient: {
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'mock-email-id' }, error: null }),
    },
  },
  sender: { name: 'Messenger Test', email: 'test@messenger.dev' },
}));

// ---------------------------------------------------------------------------
// Import the Express app AFTER mocks are in place.
// We import `app` from socket.js (not server.js) to avoid calling server.listen.
// ---------------------------------------------------------------------------
const { app } = await import('../src/lib/createApp.js');

// ---------------------------------------------------------------------------
// Helper: sign up a user and extract the raw verification token from the mocked
// Resend call.  Returns { email, password, rawToken }.
// ---------------------------------------------------------------------------
async function signUpAndGetToken(userData = {}) {
  const { resendClient } = await import('../src/lib/resend.js');
  resendClient.emails.send.mockClear();

  const data = {
    fullName: 'Test User',
    email: 'user@test.com',
    password: 'password123',
    ...userData,
  };

  const res = await request(app).post('/api/auth/signup').send(data);
  expect(res.status).toBe(201);
  expect(res.body.pendingVerification).toBe(true);

  // The verification link is the third argument of sendVerificationEmail → resendClient.emails.send
  const sendCallArgs = resendClient.emails.send.mock.calls[0][0];
  const match = sendCallArgs.html.match(/verify-email\/([a-f0-9]{64})/);
  const rawToken = match?.[1] ?? null;

  return { ...data, rawToken };
}

// ---------------------------------------------------------------------------
// POST /api/auth/signup
// ---------------------------------------------------------------------------
describe('POST /api/auth/signup', () => {
  it('returns 201 with pendingVerification flag and sends a verification email', async () => {
    const { resendClient } = await import('../src/lib/resend.js');
    resendClient.emails.send.mockClear();

    const res = await request(app).post('/api/auth/signup').send({
      fullName: 'Alice',
      email: 'alice@test.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.pendingVerification).toBe(true);
    expect(res.body.email).toBe('alice@test.com');
    // authUser must NOT be set (no JWT cookie returned at signup)
    expect(res.body._id).toBeUndefined();
    // Email was sent
    expect(resendClient.emails.send).toHaveBeenCalledTimes(1);
  });

  it('rejects missing fields with 400', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'x@test.com' });
    expect(res.status).toBe(400);
  });

  it('rejects a password shorter than 6 chars with 400', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      fullName: 'Bob',
      email: 'bob@test.com',
      password: '123',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/6/);
  });

  it('rejects an invalid email format with 400', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      fullName: 'Bob',
      email: 'not-an-email',
      password: 'password123',
    });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate email with 400', async () => {
    const payload = { fullName: 'Carol', email: 'carol@test.com', password: 'password123' };
    await request(app).post('/api/auth/signup').send(payload);
    const res = await request(app).post('/api/auth/signup').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already/i);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/verify-email
// ---------------------------------------------------------------------------
describe('POST /api/auth/verify-email', () => {
  it('verifies a valid token, sets cookie, and returns the user', async () => {
    const agent = request.agent(app);
    const { rawToken } = await signUpAndGetToken({ email: 'verify@test.com' });

    const res = await agent.post('/api/auth/verify-email').send({ token: rawToken });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('verify@test.com');
    // A jwt cookie should be present
    const setCookie = res.headers['set-cookie'];
    expect(setCookie?.some((c) => c.startsWith('jwt='))).toBe(true);
  });

  it('rejects an invalid token with 400', async () => {
    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: 'deadbeef'.repeat(8) });
    expect(res.status).toBe(400);
  });

  it('rejects a missing token with 400', async () => {
    const res = await request(app).post('/api/auth/verify-email').send({});
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    // Create a fresh user for each login test
    await signUpAndGetToken({ email: 'login@test.com', password: 'pass1234' });
  });

  it('returns 403 with EMAIL_UNVERIFIED code before verification', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'pass1234' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_UNVERIFIED');
  });

  it('logs in a verified user and returns 200 with user data', async () => {
    // Verify the user first
    const { resendClient } = await import('../src/lib/resend.js');
    const sendCallArgs = resendClient.emails.send.mock.calls.at(-1)[0];
    const match = sendCallArgs.html.match(/verify-email\/([a-f0-9]{64})/);
    const rawToken = match?.[1];
    await request(app).post('/api/auth/verify-email').send({ token: rawToken });

    const agent = request.agent(app);
    const res = await agent
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'pass1234' });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('login@test.com');
    expect(res.body.password).toBeUndefined();
  });

  it('rejects wrong password with 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'wrongpassword' });
    expect(res.status).toBe(400);
  });

  it('rejects unknown email with 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'pass1234' });
    expect(res.status).toBe(400);
  });

  it('logs in case-insensitively with mixed-case email', async () => {
    // User was created with login@test.com in beforeEach
    // Verify first
    const { resendClient } = await import('../src/lib/resend.js');
    const sendCallArgs = resendClient.emails.send.mock.calls.at(-1)[0];
    const match = sendCallArgs.html.match(/verify-email\/([a-f0-9]{64})/);
    const rawToken = match?.[1];
    await request(app).post('/api/auth/verify-email').send({ token: rawToken });

    const agent = request.agent(app);
    const res = await agent
      .post('/api/auth/login')
      .send({ email: 'LOGIN@TEST.COM', password: 'pass1234' });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('login@test.com');
  });
});
