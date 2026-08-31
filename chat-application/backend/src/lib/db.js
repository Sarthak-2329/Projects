import mongoose from "mongoose";
import { ENV } from "./env.js";
import { logger } from "./logger.js";

export const connectDB = async () => {
  const { MONGO_URI } = ENV;
  if (!MONGO_URI) throw new Error("MONGO_URI is not set");
  const con = await mongoose.connect(MONGO_URI);
  logger.info({ host: con.connection.host }, "MongoDB connected successfully");
};
