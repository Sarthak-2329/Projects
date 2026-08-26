import { MongoMemoryServer } from 'mongodb-memory-server';

/** @type {MongoMemoryServer} */
let mongoServer;

/**
 * Runs once before all test files, in the main process.
 * Mutations to process.env here ARE inherited by fork-mode test workers.
 */
export async function setup() {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI    = mongoServer.getUri();
  process.env.JWT_SECRET   = 'test-jwt-secret-key-for-vitest-only';
  process.env.NODE_ENV     = 'test';
  process.env.CLIENT_URL   = 'http://localhost:5173';
  // Ensure no accidental Redis connection in tests
  delete process.env.REDIS_URL;
  // Prevent dotenv from overwriting env vars we just set
  process.env.DOTENV_CONFIG_PATH = '/nonexistent/.env';
}

/** Runs once after all test files finish. */
export async function teardown() {
  if (mongoServer) await mongoServer.stop();
}
