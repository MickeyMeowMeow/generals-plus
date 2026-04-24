/**
 * Import dotenv at the very top to ensure environment variables
 * are available to all subsequent modules.
 */
import "dotenv/config";

import { monitor } from "@colyseus/monitor";
import { defineServer } from "colyseus";
import mongoose from "mongoose";

import { ENV } from "#/env";
import { auth } from "#/features/auth/auth-config";

/**
 * Database connection utility.
 * Uses credentials defined in your Docker Compose / .env file.
 */
function redactMongoUri(uri: string) {
  return uri.replace(
    /^(mongodb(?:\+srv)?:\/\/)([^:@/]+)(?::([^@/]*))?@/i,
    "$1***:***@",
  );
}

async function connectDB() {
  // Default to the credentials set in your docker-compose.yml
  const mongoUri = ENV.MONGO_URI;
  console.log("Attempting to connect to:", redactMongoUri(mongoUri));

  try {
    // Explicitly configure query strictness for this application.
    mongoose.set("strictQuery", false);

    await mongoose.connect(mongoUri);
    console.log("🍃 Database: MongoDB connected successfully.");
  } catch (err) {
    console.error("❌ Database: Connection failed.", err);
    // Exit process on database failure as the app cannot function without it
    process.exit(1);
  }
}

/**
 * Main Server Configuration using Colyseus v0.17 defineServer syntax.
 */
export default defineServer({
  /**
   * Define game rooms and their respective handler classes.
   */
  rooms: {},

  /**
   * Configure Express middleware and HTTP routes.
   */
  express: async (app) => {
    // 1. Establish database connection before mounting routes
    await connectDB();

    // 2. Bind Authentication module routes (/auth/register, /auth/login, etc.)
    app.use(auth.prefix, auth.routes());

    // 3. (Optional) Bind Colyseus Monitor for development debugging
    if (process.env.NODE_ENV !== "production") {
      app.use("/colyseus", monitor());
    }

    // Health check endpoint
    app.get("/health", (_req, res) => {
      res.status(200).json({ status: "ok", uptime: process.uptime() });
    });
  },
});
