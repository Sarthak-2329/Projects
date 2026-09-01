import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';

// Mock Arcjet
vi.mock('../src/middleware/arcjet.middleware.js', () => ({
  arcjetProtection: (_req, _res, next) => next(),
}));

// Mock Cloudinary
vi.mock('../src/lib/cloudinary.js', () => ({
  default: {
    uploader: {
      upload: vi.fn().mockResolvedValue({ secure_url: 'http://cloudinary.mock/image.png' }),
    },
  },
}));

// Mock queue
vi.mock('../src/lib/queue.js', () => ({
  enqueueEmail: vi.fn().mockResolvedValue({ id: 'mock-id' }),
  JOB_WELCOME_EMAIL: 'welcomeEmail',
  JOB_VERIFICATION_EMAIL: 'verificationEmail',
  JOB_PASSWORD_RESET_EMAIL: 'passwordResetEmail',
}));

const { app } = await import('../src/lib/createApp.js');
const User = (await import('../src/models/User.js')).default;
const Conversation = (await import('../src/models/Conversation.js')).default;
const Message = (await import('../src/models/Message.js')).default;

// Helper to create a verified user and log them in with supertest agent
async function createVerifiedUserAndSession(userData) {
  const salt = await bcrypt.genSalt(6);
  const hashedPassword = await bcrypt.hash(userData.password, salt);

  const user = new User({
    fullName: userData.fullName,
    email: userData.email.toLowerCase().trim(),
    password: hashedPassword,
    isEmailVerified: true,
  });
  await user.save();

  const agent = request.agent(app);
  const loginRes = await agent.post('/api/auth/login').send({
    email: userData.email,
    password: userData.password,
  });
  expect(loginRes.status).toBe(200);

  return { user, agent };
}

describe('Group Conversations API (/api/conversations)', () => {
  let user1, agent1;
  let user2, agent2;
  let nonMemberAgent;

  beforeEach(async () => {
    await Message.deleteMany({});
    await Conversation.deleteMany({});
    await User.deleteMany({});

    const session1 = await createVerifiedUserAndSession({
      fullName: 'User One',
      email: 'user1@test.com',
      password: 'password123',
    });
    user1 = session1.user;
    agent1 = session1.agent;

    const session2 = await createVerifiedUserAndSession({
      fullName: 'User Two',
      email: 'user2@test.com',
      password: 'password123',
    });
    user2 = session2.user;
    agent2 = session2.agent;

    const session3 = await createVerifiedUserAndSession({
      fullName: 'Non Member',
      email: 'nonmember@test.com',
      password: 'password123',
    });
    nonMemberAgent = session3.agent;
  });

  describe('POST /api/conversations (createGroup)', () => {
    it('creates a new group with creator as admin and returns 201', async () => {
      const res = await agent1.post('/api/conversations').send({
        name: 'Project Alpha Team',
        members: [user2._id.toString()],
      });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Project Alpha Team');
      expect(res.body.members).toHaveLength(2);

      const creatorMember = res.body.members.find((m) => m.userId._id === user1._id.toString());
      expect(creatorMember?.role).toBe('admin');

      const regularMember = res.body.members.find((m) => m.userId._id === user2._id.toString());
      expect(regularMember?.role).toBe('member');
    });

    it('rejects empty group name with 400', async () => {
      const res = await agent1.post('/api/conversations').send({
        name: '   ',
        members: [user2._id.toString()],
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Group name is required/i);
    });

    it('rejects empty member list with 400', async () => {
      const res = await agent1.post('/api/conversations').send({
        name: 'Empty Group',
        members: [],
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/member/i);
    });
  });

  describe('GET /api/conversations (getUserGroups)', () => {
    it('returns only groups that the user is a member of', async () => {
      // Create group with user1 and user2
      await agent1.post('/api/conversations').send({
        name: 'Engineering',
        members: [user2._id.toString()],
      });

      const resUser1 = await agent1.get('/api/conversations');
      expect(resUser1.status).toBe(200);
      expect(resUser1.body).toHaveLength(1);
      expect(resUser1.body[0].name).toBe('Engineering');

      const resUser2 = await agent2.get('/api/conversations');
      expect(resUser2.status).toBe(200);
      expect(resUser2.body).toHaveLength(1);

      const resNonMember = await nonMemberAgent.get('/api/conversations');
      expect(resNonMember.status).toBe(200);
      expect(resNonMember.body).toHaveLength(0);
    });
  });

  describe('POST & GET /api/conversations/:id/messages', () => {
    let groupId;

    beforeEach(async () => {
      const createRes = await agent1.post('/api/conversations').send({
        name: 'Design Sync',
        members: [user2._id.toString()],
      });
      groupId = createRes.body._id;
    });

    it('allows a member to send a group message', async () => {
      const res = await agent1.post(`/api/conversations/${groupId}/messages`).send({
        text: 'Hello team!',
      });

      expect(res.status).toBe(201);
      expect(res.body.ack).toBe(true);
      expect(res.body.message.text).toBe('Hello team!');
      expect(res.body.message.conversationId).toBe(groupId);
      expect(res.body.message.senderId._id).toBe(user1._id.toString());
    });

    it('allows a member to read group message history', async () => {
      await agent1.post(`/api/conversations/${groupId}/messages`).send({ text: 'Msg 1' });
      await agent2.post(`/api/conversations/${groupId}/messages`).send({ text: 'Msg 2' });

      const res = await agent2.get(`/api/conversations/${groupId}/messages`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].text).toBe('Msg 1');
      expect(res.body[1].text).toBe('Msg 2');
    });

    it('rejects non-members with 403 on send and read', async () => {
      // Send attempt by non-member
      const sendRes = await nonMemberAgent.post(`/api/conversations/${groupId}/messages`).send({
        text: 'Intruder message',
      });
      expect(sendRes.status).toBe(403);
      expect(sendRes.body.message).toMatch(/not a member/i);

      // Read attempt by non-member
      const readRes = await nonMemberAgent.get(`/api/conversations/${groupId}/messages`);
      expect(readRes.status).toBe(403);
      expect(readRes.body.message).toMatch(/not a member/i);
    });
  });

  describe('POST /api/conversations/:id/leave', () => {
    it('allows a member to leave a group', async () => {
      const createRes = await agent1.post('/api/conversations').send({
        name: 'Short-lived Group',
        members: [user2._id.toString()],
      });
      const groupId = createRes.body._id;

      const leaveRes = await agent2.post(`/api/conversations/${groupId}/leave`).send();
      expect(leaveRes.status).toBe(200);
      expect(leaveRes.body.message).toMatch(/Left group successfully/i);

      // Verify user2 can no longer access messages
      const accessRes = await agent2.get(`/api/conversations/${groupId}/messages`);
      expect(accessRes.status).toBe(403);
    });
  });
});
