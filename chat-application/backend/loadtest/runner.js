import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runBenchmark() {
  console.log('--- Starting MongoMemoryServer for Benchmark ---');
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  process.env.MONGO_URI = uri;
  process.env.PORT = '3000';
  process.env.JWT_SECRET = 'benchmark_secret_key_123456789012345678901234567890';
  process.env.NODE_ENV = 'production';
  process.env.LOG_LEVEL = 'error'; // Keep benchmark console clean
  process.env.ARCJET_ENV = 'development';
  process.env.ARCJET_KEY = 'ajkey_mock_12345678901234567890';
  process.env.CLIENT_URL = 'http://127.0.0.1:3000';
  process.env.RESEND_API_KEY = 're_mock_12345678901234567890';
  process.env.EMAIL_FROM = 'noreply@bench.dev';
  process.env.CLOUDINARY_CLOUD_NAME = 'mock_cloud';
  process.env.CLOUDINARY_API_KEY = '123456789';
  process.env.CLOUDINARY_API_SECRET = 'mock_secret';

  console.log('Connecting Mongoose to memory DB...');
  await mongoose.connect(uri);

  const User = (await import('../src/models/User.js')).default;
  const Message = (await import('../src/models/Message.js')).default;

  console.log('Seeding 200 benchmark test users...');
  const salt = await bcrypt.genSalt(6); // Faster salt for batch test setup
  const hashedPassword = await bcrypt.hash('password123', salt);

  const usersToInsert = [];
  for (let i = 1; i <= 200; i++) {
    usersToInsert.push({
      fullName: `Benchmark User ${i}`,
      email: `benchuser${i}@bench.dev`,
      password: hashedPassword,
      isEmailVerified: true,
      profilePic: '',
    });
  }
  await User.insertMany(usersToInsert);
  console.log('Seeded 200 verified users successfully.');

  // Import and start the server
  const { server } = await import('../src/lib/createApp.js');
  await new Promise((resolve) => server.listen(3000, resolve));
  console.log('Backend server running on http://127.0.0.1:3000');

  const k6Bin = path.join(__dirname, 'bin/k6');
  const scriptPath = path.join(__dirname, 'chat-flow.js');

  const runK6 = (vus, duration) => {
    return new Promise((resolve, reject) => {
      console.log(`\n======================================================`);
      console.log(`RUNNING BENCHMARK: ${vus} Concurrent Virtual Users (${duration})`);
      console.log(`======================================================\n`);

      const summaryFile = path.join(__dirname, `summary_${vus}.json`);
      const k6Proc = spawn(
        k6Bin,
        ['run', scriptPath, '--env', `VUS=${vus}`, '--env', `DURATION=${duration}`, '--summary-export', summaryFile],
        { stdio: 'inherit' }
      );

      k6Proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`k6 exited with code ${code}`));
      });
    });
  };

  try {
    // Warmup / 50 VUs for 30s
    await runK6(50, '30s');

    // High Load / 200 VUs for 30s
    await runK6(200, '30s');
  } catch (err) {
    console.error('Benchmark error:', err);
  } finally {
    console.log('\nStopping backend server and MongoMemoryServer...');
    server.close();
    await mongoose.disconnect();
    await mongod.stop();
    console.log('Benchmark run finished.');
    process.exit(0);
  }
}

runBenchmark().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
