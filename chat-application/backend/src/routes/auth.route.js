import express from 'express';
import {
  signup,
  login,
  logout,
  updateProfile,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
} from '../controllers/auth.controller.js';
import { protectRoute } from '../middleware/auth.middleware.js';
import { arcjetProtection } from '../middleware/arcjet.middleware.js';

const router = express.Router();

// All auth routes go through Arcjet protection (rate limiting, bot detection)
router.use(arcjetProtection);

// Public routes
router.post("/signup",               signup);
router.post("/login",                login);
router.post("/logout",               logout);
router.post("/forgot-password",      forgotPassword);
router.post("/reset-password/:token",resetPassword);
router.post("/verify-email",         verifyEmail);
router.post("/resend-verification",  resendVerification);

// Protected routes
router.put("/update-profile", protectRoute, updateProfile);
router.get("/check",          protectRoute, (req, res) => res.status(200).json(req.user));

export default router;