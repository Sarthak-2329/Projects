import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import {ENV} from '../lib/env.js';

export const socketAuthMiddleware = async (socket, next) => {
    try {
        const token = socket.handshake.headers.cookie
            ?.split(/;\s*/)
            .find((row) => row.startsWith("jwt="))
            ?.split("=")[1];
        if (!token) {
            console.log("No token provided");
            return next(new Error("Authentication error: Token not provided"));
        }
        const decoded = jwt.verify(token, ENV.JWT_SECRET);
        if(!decoded){
            console.log("Invalid token");
            return next(new Error("Authentication error: Invalid token"));
        }
        const user = await User.findById(decoded.userId).select("-password");
        if(!user){
            console.log("User not found");
            return next(new Error("Authentication error: User not found"));
        }

        socket.user = user;
        socket.userId = user._id.toString();
        console.log(`User ${user.fullName} ${user._id} authenticated via socket`);
        next();
    } catch (error) {
        console.log("Authentication error:", error.message);
        next(new Error("Authentication error"));
    }
};