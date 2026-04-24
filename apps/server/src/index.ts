/**
 * Entry point of the server application.
 */

import server from "#app.config";
import { ENV } from "#env";

// Get port from environment variables or default to 2567
const port = ENV.PORT;

/**
 * Start listening on the specified port.
 * This will trigger the hooks defined in app.config.ts (like express, connectDB, etc.)
 */
server
  .listen(port)
  .then(() => {
    console.log(`✅ Server: Listening on http://localhost:${port}`);
  })
  .catch((err) => {
    console.error("❌ Server: Failed to start!", err);
    process.exit(1);
  });
