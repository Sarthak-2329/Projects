import crypto from "crypto";
import {
  enqueueEmail,
  JOB_WELCOME_EMAIL,
  JOB_VERIFICATION_EMAIL,
  JOB_PASSWORD_RESET_EMAIL,
} from "../lib/queue.js";
import { generateToken } from "../lib/utils.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import { ENV } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import cloudinary from "../lib/cloudinary.js";

// ---------------------------------------------------------------------------
// Signup — creates account but does NOT issue a JWT.
// Returns 201 { pendingVerification: true, email } so the frontend can show
// a "check your inbox" state. The user cannot log in until they verify.
// ---------------------------------------------------------------------------
export const signup = async (req, res) => {
  const { fullName, email, password } = req.body;
  try {
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const normalizedEmail = email.toLowerCase().trim();
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ message: "Invalid email format" });
    }
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ message: "An account with that email already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate a one-time verification token (raw in email, SHA-256 hash in DB)
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    const newUser = new User({
      fullName: fullName.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      isEmailVerified: false,
      emailVerifyToken: hashedToken,
      emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });
    await newUser.save();

    const verifyLink = `${ENV.CLIENT_URL}/verify-email/${rawToken}`;
    enqueueEmail(JOB_VERIFICATION_EMAIL, {
      email: newUser.email,
      name: newUser.fullName,
      verifyLink,
    });

    res.status(201).json({
      pendingVerification: true,
      email: newUser.email,
      message: "Account created! Check your email to verify your account before logging in.",
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({ message: messages.join(", ") });
    }
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    logger.error({ error: error.message }, "Error in signup");
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// Login — hard-gates unverified accounts with a specific error code.
// ---------------------------------------------------------------------------
export const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select("+password");
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    if (!user.isEmailVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in.",
        code: "EMAIL_UNVERIFIED",
      });
    }

    generateToken(user._id, res);
    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    logger.error({ error: error.message }, "Error in login");
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// Verify email — POST /api/auth/verify-email  body: { token }
// Hashes the raw token, finds the matching user, marks them verified,
// issues a JWT, and sends the welcome email.
// ---------------------------------------------------------------------------
export const verifyEmail = async (req, res) => {
  const { token } = req.body;
  try {
    if (!token) {
      return res.status(400).json({ message: "Verification token is required" });
    }
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      emailVerifyToken: hashedToken,
      emailVerifyExpires: { $gt: new Date() },
    });
    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired verification link. Please request a new one.",
      });
    }
    user.isEmailVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpires = undefined;
    await user.save();

    // Enqueue welcome email asynchronously upon successful verification
    enqueueEmail(JOB_WELCOME_EMAIL, {
      email: user.email,
      name: user.fullName,
      clientURL: ENV.CLIENT_URL,
    });

    generateToken(user._id, res);
    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    logger.error({ error: error.message }, "Error in verifyEmail");
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// Resend verification — POST /api/auth/resend-verification  body: { email }
// Always returns 200 even for unknown emails to prevent enumeration.
// ---------------------------------------------------------------------------
export const resendVerification = async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(200).json({
        message: "If that email is registered and unverified, a new link has been sent.",
      });
    }
    if (user.isEmailVerified) {
      return res.status(400).json({
        message: "This account is already verified. You can log in.",
      });
    }
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    user.emailVerifyToken = hashedToken;
    user.emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const verifyLink = `${ENV.CLIENT_URL}/verify-email/${rawToken}`;
    enqueueEmail(JOB_VERIFICATION_EMAIL, {
      email: user.email,
      name: user.fullName,
      verifyLink,
    });

    res.status(200).json({
      message: "If that email is registered and unverified, a new link has been sent.",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    logger.error({ error: error.message }, "Error in resendVerification");
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------
export const logout = (_, res) => {
  res.cookie("jwt", "", { maxAge: 0 });
  res.status(200).json({ message: "Logged out successfully" });
};

// ---------------------------------------------------------------------------
// Update profile picture
// ---------------------------------------------------------------------------
export const updateProfile = async (req, res) => {
  try {
    const { profilePic } = req.body;
    if (!profilePic) return res.status(400).json({ message: "Profile pic is required" });
    const uploadResponse = await cloudinary.uploader.upload(profilePic);
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { profilePic: uploadResponse.secure_url },
      { new: true }
    );
    res.status(200).json({
      _id: updatedUser._id,
      fullName: updatedUser.fullName,
      email: updatedUser.email,
      profilePic: updatedUser.profilePic,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({ message: messages.join(", ") });
    }
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    logger.error({ error: error.message }, "Error in updateProfile");
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// Forgot password — POST /api/auth/forgot-password  body: { email }
// ---------------------------------------------------------------------------
export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(200).json({ message: "If that email is registered, a reset link has been sent." });
    }
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const resetLink = `${ENV.CLIENT_URL}/reset-password/${rawToken}`;
    enqueueEmail(JOB_PASSWORD_RESET_EMAIL, {
      email: user.email,
      name: user.fullName,
      resetLink,
    });

    res.status(200).json({ message: "If that email is registered, a reset link has been sent." });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    logger.error({ error: error.message }, "Error in forgotPassword");
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// Reset password — POST /api/auth/reset-password/:token  body: { password }
// ---------------------------------------------------------------------------
export const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  try {
    if (!password) return res.status(400).json({ message: "Password is required" });
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset link. Please request a new one." });
    }
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    res.status(200).json({ message: "Password reset successful. You can now log in." });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    logger.error({ error: error.message }, "Error in resetPassword");
    res.status(500).json({ message: "Internal server error" });
  }
};
