/**
 * Entry point of the server application.
 */

import { logger } from "@colyseus/core";

import server from "#/app.config";
import { ENV } from "#/env";

// Get port from environment variables or default to 2567
const port = ENV.PORT;

/**
 * Start listening on the specified port.
 * This will trigger the hooks defined in app.config.ts (like express, connectDB, etc.)
 */
server
  .listen(port)
  .then(() => {
    logger.info(`✅ Server: Listening on http://localhost:${port}`);
  })
  .catch((err) => {
    logger.error("❌ Server: Failed to start!", err);
    process.exit(1);
  });
