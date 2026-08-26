import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use child_process.fork so process.env mutations in globalSetup propagate
    // to test workers automatically.
    pool: 'forks',

    // Run test files one at a time.
    // Without this, separate file forks share the same MongoMemoryServer.
    // Auth's afterEach (which deletes ALL collections) would fire while message
    // tests are mid-flight, deleting users the message tests just created.
    fileParallelism: false,

    globalSetup: './tests/globalSetup.js',
    setupFiles: ['./tests/setup.js'],
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    sequence: { concurrent: false },
    include: ['tests/**/*.test.js'],
  },
});
