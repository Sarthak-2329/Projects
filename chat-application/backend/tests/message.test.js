import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// ---------------------------------------------------------------------------
// Mocks — hoisted before any module imports.
// ---------------------------------------------------------------------------

vi.mock('../src/middleware/arcjet.middleware.js', () => ({
  arcjetProtection: (_req, _res, next) => next(),
}));

vi.mock('../src/lib/resend.js', () => ({
  resendClient: {
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'mock-id' }, error: null }),
    },
  },
  sender: { name: 'Test', email: 'test@test.dev' },
}));

vi.mock('../src/lib/cloudinary.js', () => ({
  default: {
    uploader: {
      upload: vi.fn().mockResolvedValue({ secure_url: 'https://cdn.example.com/test.jpg' }),
    },
  },
}));

const { app }  = await import('../src/lib/createApp.js');
const User     = (await import('../src/models/User.js')).default;

// ---------------------------------------------------------------------------
// Helper: create a verified user directly in the DB then log in.
//
// Bypasses the signup API entirely so message tests don't depend on the
// email-verification flow (that is already covered in auth.test.js).
// ---------------------------------------------------------------------------
async function makeAuthenticatedAgent(email = `u-${Date.now()}@test.com`, password = 'password123') {
  const salt = await bcrypt.genSalt(10);
  await User.create({
    fullName: 'Test User',
    email,
    password: await bcrypt.hash(password, salt),
    isEmailVerified: true,
  });

  const agent     = request.agent(app);
  const loginRes  = await agent.post('/api/auth/login').send({ email, password });

  if (loginRes.status !== 200) {
    throw new Error(`makeAuthenticatedAgent: login returned ${loginRes.status}: ${JSON.stringify(loginRes.body)}`);
  }

  return { agent, user: loginRes.body };
}

// ---------------------------------------------------------------------------
// POST /api/messages/send/:receiverId
// ---------------------------------------------------------------------------
describe('POST /api/messages/send/:receiverId', () => {
  it('returns 401 without authentication', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post(`/api/messages/send/${fakeId}`)
      .send({ text: 'Hello!' });
    expect(res.status).toBe(401);
  });

  it('sends a text message and returns 201 with the message', async () => {
    const { agent: senderAgent } = await makeAuthenticatedAgent('sender@test.com');
    const { user: receiver }     = await makeAuthenticatedAgent('receiver@test.com');

    const res = await senderAgent
      .post(`/api/messages/send/${receiver._id}`)
      .send({ text: 'Hey there!' });

    expect(res.status).toBe(201);
    expect(res.body.message).toBeDefined();
    expect(res.body.message.text).toBe('Hey there!');
    expect(res.body.message.status).toMatch(/^(sent|delivered)$/);
  });

  it('returns 400 when both text and image are missing', async () => {
    const { agent: senderAgent } = await makeAuthenticatedAgent('sender2@test.com');
    const { user: receiver }     = await makeAuthenticatedAgent('recv2@test.com');

    const res = await senderAgent
      .post(`/api/messages/send/${receiver._id}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when a user tries to message themselves', async () => {
    const { agent, user } = await makeAuthenticatedAgent('self@test.com');

    const res = await agent
      .post(`/api/messages/send/${user._id}`)
      .send({ text: 'Talking to myself' });
    expect(res.status).toBe(400);
  });
});
