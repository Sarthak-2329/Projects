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

import authRoutes    from '../routes/auth.route.js';
import messageRoutes from '../routes/message.route.js';
import { ENV }        from './env.js';
import { app, server, io } from './socket.js';

// ---- Middleware ----
app.use(express.json({ limit: '5mb' }));
app.use(cors({ origin: ENV.CLIENT_URL || true, credentials: true }));
app.use(cookieParser());

// ---- Routes ----
app.use('/api/auth',     authRoutes);
app.use('/api/messages', messageRoutes);

export { app, server, io };
