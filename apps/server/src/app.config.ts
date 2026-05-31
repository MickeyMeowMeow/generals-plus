/**
 * Import dotenv at the very top to ensure environment variables
 * are available to all subsequent modules.
 */
import "dotenv/config";

import { defineRoom, LobbyRoom, logger } from "@colyseus/core";
import { monitor } from "@colyseus/monitor";
import { Encoder } from "@colyseus/schema";
import { defineServer, matchMaker } from "colyseus";
import express from "express";
import mongoose from "mongoose";

import { ENV } from "#/env";
import { auth } from "#/features/auth/auth-config";
import { registerMapRoutes } from "#/features/maps/map-routes";
import { MatchRoom } from "#/features/match/match-room";
import { registerProfileRoutes } from "#/features/profile/profile-routes";
import { MatchQueueRoom } from "#/features/queue/queue-room";
import { registerCustomRoomRoutes } from "#/features/setup/custom-room-routes";
import { SetupRoom } from "#/features/setup/setup-room";

Encoder.BUFFER_SIZE = 1024 * 1024;

/**
 * Colyseus matchmaker methods exposed to the browser client.
 *
 * The rebuilt client relies on these methods directly: official queue uses
 * `joinOrCreate`, custom-room URLs use `create` and `joinById`, and the
 * setup/queue -> match transition consumes server-issued seat reservations.
 */
matchMaker.controller.exposedMethods = [
  "create",
  "joinById",
  "reconnect",
  "joinOrCreate",
  "consumeSeatReservation",
];

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
  logger.info("Attempting to connect to:", redactMongoUri(mongoUri));

  try {
    // Explicitly configure query strictness for this application.
    mongoose.set("strictQuery", false);

    await mongoose.connect(mongoUri);
    logger.info("🍃 Database: MongoDB connected successfully.");
  } catch (err) {
    logger.error("❌ Database: Connection failed.", err);
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
  rooms: {
    lobby: defineRoom(LobbyRoom),
    queue: defineRoom(MatchQueueRoom).filterBy(["gameMode"]),
    setup: defineRoom(SetupRoom).filterBy(["gameMode"]).enableRealtimeListing(),
    match: defineRoom(MatchRoom),
  },

  /**
   * Configure Express middleware and HTTP routes.
   */
  express: async (app) => {
    // 1. Establish database connection before mounting routes
    await connectDB();

    // 2. Parse JSON bodies for custom room HTTP endpoints.
    app.use(express.json());

    // 3. Bind Authentication module routes (/auth/register, /auth/login, etc.)
    app.use(auth.prefix, auth.routes());

    registerProfileRoutes(app);

    // 4. (Optional) Bind Colyseus Monitor for development debugging
    if (process.env.NODE_ENV !== "production") {
      app.use("/colyseus", monitor());
    }

    registerCustomRoomRoutes(app);

    registerMapRoutes(app);

    // Health check endpoint
    app.get("/health", (_req, res) => {
      res.status(200).json({ status: "ok", uptime: process.uptime() });
    });
  },
});
