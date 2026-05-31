/**
 * Import dotenv at the very top to ensure environment variables
 * are available to all subsequent modules.
 */
import "dotenv/config";

import { JWT } from "@colyseus/auth";
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
import { registerSystemRoutes } from "#/features/system/system-routes";
import { VsAiRoom } from "#/features/vs-ai/vs-ai-room";
import { MongoUserRepository } from "#/infra/db/repositories/MongoUserRepository";

const userRepository = new MongoUserRepository();

function getCookie(
  cookieString: string | undefined,
  name: string,
): string | null {
  if (!cookieString) return null;
  const match = cookieString.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

async function colyseusAdminAuthMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  // 1. Force trailing slash redirect for /colyseus to ensure relative browser assets resolve correctly
  const originalUrl = req.originalUrl || "";
  const [pathname, search] = originalUrl.split("?");
  if (pathname === "/colyseus") {
    res.redirect(301, `/colyseus/${search ? `?${search}` : ""}`);
    return;
  }

  // 1.5. Bypass authentication for public static assets requested by the Colyseus Monitor client UI.
  // The monitor UI bundle uses 'crossorigin' script tags which omit credentials (cookies).
  // Enforcing authentication on the static bundles is unnecessary since they contain no sensitive data;
  // security is strictly enforced on all actual API endpoints (/colyseus/api/*) below.
  if (
    req.path.startsWith("/assets/") ||
    req.path.startsWith("/ext/") ||
    req.path === "/favicon.ico"
  ) {
    next();
    return;
  }

  const cookieToken = getCookie(req.headers.cookie, "colyseus_auth_token");
  const token =
    (req.query.token as string) ||
    cookieToken ||
    req.header("authorization")?.replace("Bearer ", "");

  if (!token) {
    res
      .status(401)
      .send(
        "<h1>Unauthorized</h1><p>Missing authentication token. Click 'Open Colyseus Monitor' from the admin panel to view.</p>",
      );
    return;
  }
  try {
    const decoded = (await JWT.verify(token)) as { id?: string } | null;
    if (!decoded?.id) {
      res
        .status(401)
        .send("<h1>Unauthorized</h1><p>Invalid authentication token.</p>");
      return;
    }
    const user = await userRepository.findById(decoded.id);
    if (!user?.isAdmin) {
      res
        .status(403)
        .send(
          "<h1>Forbidden</h1><p>Only administrators can access this monitoring page.</p>",
        );
      return;
    }

    // Set cookie if authenticated via query param to persist nested requests
    if (req.query.token) {
      res.cookie("colyseus_auth_token", req.query.token as string, {
        path: "/colyseus",
        httpOnly: true,
        sameSite: "lax",
        secure: req.secure || req.headers["x-forwarded-proto"] === "https",
      });
    }

    next();
  } catch {
    res.status(401).send("<h1>Unauthorized</h1><p>Authentication failed.</p>");
  }
}

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
    "vs-ai": defineRoom(VsAiRoom),
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

    // 4. Bind Colyseus Monitor (secured for admins in all envs)
    app.use("/colyseus", colyseusAdminAuthMiddleware, monitor());

    registerCustomRoomRoutes(app);

    registerMapRoutes(app);

    registerSystemRoutes(app);

    // Health check endpoint
    app.get("/health", (_req, res) => {
      res.status(200).json({ status: "ok", uptime: process.uptime() });
    });

    // AI bot service health check — pings the Python bot service
    app.get("/ai/health", async (_req, res) => {
      try {
        const healthUrl = ENV.BOT_SERVICE_URL.replace(/^ws/i, "http").replace(
          /\/ws$/,
          "/health",
        );
        const response = await fetch(healthUrl, {
          signal: AbortSignal.timeout(3000),
        });
        if (response.ok) {
          res.status(200).json({ available: true });
        } else {
          res
            .status(503)
            .json({ available: false, error: "Bot service unhealthy" });
        }
      } catch {
        res
          .status(503)
          .json({ available: false, error: "Bot service unreachable" });
      }
    });
  },
});
