import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { ENV } from '../lib/env.js';
import { logger } from '../lib/logger.js';

export const socketAuthMiddleware = async (socket, next) => {
    try {
        const token = socket.handshake.headers.cookie
            ?.split(/;\s*/)
            .find((row) => row.startsWith("jwt="))
            ?.split("=")[1];
        if (!token) {
            logger.warn({ socketId: socket.id }, "Socket auth failed: No token provided");
            return next(new Error("Authentication error: Token not provided"));
        }
        const decoded = jwt.verify(token, ENV.JWT_SECRET);
        if(!decoded){
            logger.warn({ socketId: socket.id }, "Socket auth failed: Invalid token");
            return next(new Error("Authentication error: Invalid token"));
        }
        const user = await User.findById(decoded.userId).select("-password");
        if(!user){
            logger.warn({ socketId: socket.id, userId: decoded.userId }, "Socket auth failed: User not found");
            return next(new Error("Authentication error: User not found"));
        }

        socket.user = user;
        socket.userId = user._id.toString();
        logger.info({ userId: user._id, fullName: user.fullName, socketId: socket.id }, "User authenticated via socket");
        next();
    } catch (error) {
        logger.warn({ socketId: socket.id, error: error.message }, "Socket authentication error");
        next(new Error("Authentication error"));
    }
};