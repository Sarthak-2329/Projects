import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import { connectDB } from './lib/db.js';
import { ENV } from './lib/env.js';
import { app, server } from './lib/createApp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
const PORT = Number(ENV.PORT || 3000);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

if (ENV.NODE_ENV === 'production') {
  const requiredEnvironment = [
    'MONGO_URI',
    'JWT_SECRET',
    'CLIENT_URL',
    'RESEND_API_KEY',
    'EMAIL_FROM',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'ARCJET_KEY',
  ];
  const missingEnvironment = requiredEnvironment.filter((name) => !ENV[name]);
  if (missingEnvironment.length > 0) {
    throw new Error(`Missing required production environment variables: ${missingEnvironment.join(', ')}`);
  }
}

// Serve frontend in production
if (ENV.NODE_ENV === 'production' && existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

async function startServer() {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
}

startServer();
