/**
 * createApp.js
 *
 * Configures the Express app (middleware + routes) and re-exports the socket
 * primitives.  Both server.js (production) and tests import from here so they
 * always hit the same fully-wired app.  server.js is the ONLY place that
 * calls server.listen().
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import pinoHttp from 'pino-http';
import mongoose from 'mongoose';

import authRoutes from '../routes/auth.route.js';
import messageRoutes from '../routes/message.route.js';
import { ENV } from './env.js';
import { logger } from './logger.js';
import { register, httpRequestCounter, httpRequestDuration } from './metrics.js';
import { app, server, io, getRedisHealth } from './socket.js';

// ---- Request Logging (Pino HTTP) ----
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/metrics' || req.url === '/api/health',
    },
    customLogLevel: (_req, res, err) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  })
);

// ---- Prometheus Metrics Middleware ----
app.use((req, res, next) => {
  if (req.path === '/metrics' || req.path === '/api/health') return next();

  const start = process.hrtime();
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationSeconds = diff[0] + diff[1] / 1e9;
    const route = req.route?.path || req.baseUrl || req.path;
    const labels = {
      method: req.method,
      route: route || req.path,
      status_code: res.statusCode.toString(),
    };
    httpRequestCounter.inc(labels);
    httpRequestDuration.observe(labels, durationSeconds);
  });
  next();
});

// ---- Body & Cookie Parsers ----
app.use(express.json({ limit: '5mb' }));
app.use(cors({ origin: ENV.CLIENT_URL || true, credentials: true }));
app.use(cookieParser());

// ---- Observability Routes ----
app.get('/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    logger.error({ error: err.message }, 'Failed to generate metrics');
    res.status(500).end(err.message);
  }
});

app.get('/api/health', async (_req, res) => {
  const isMongoConnected = mongoose.connection.readyState === 1;
  const redisHealth = await getRedisHealth();

  const isHealthy = isMongoConnected && (redisHealth.status === 'connected' || redisHealth.status === 'disabled');

  const healthData = {
    status: isHealthy ? 'ok' : 'error',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      database: {
        status: isMongoConnected ? 'connected' : 'disconnected',
      },
      redis: redisHealth,
    },
  };

  res.status(isHealthy ? 200 : 503).json(healthData);
});

// ---- Routes ----
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);

export { app, server, io };
