/**
 * BotBridge: WebSocket client connecting TS server to Python bot service.
 *
 * Maintains a single WS connection to the Python bot service.
 * Each bot player gets identified by player_id in the messages.
 */

import WebSocket from "ws";

import type { BotAction, ClientMessage, ServerMessage } from "./protocol";

const RECONNECT_DELAY_MS = 2000;
const TICK_TIMEOUT_MS = 400;

function log(level: "info" | "warn" | "error", msg: string) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [BotBridge] [${level}] ${msg}`);
}

export class BotBridge {
  private ws: WebSocket | null = null;
  private url: string;
  private pendingCallbacks = new Map<
    string,
    {
      resolve: (action: BotAction | null) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(url = "ws://localhost:8765/ws") {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);

      ws.on("open", () => {
        log("info", `Connected to Python bot service at ${this.url}`);
        this.ws = ws;
        resolve();
      });

      ws.on("message", (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString()) as ClientMessage;
          this.handleMessage(msg);
        } catch (err) {
          log("error", `Failed to parse message: ${err}`);
        }
      });

      ws.on("close", () => {
        log("warn", "Connection closed");
        this.ws = null;
        if (!this.disposed) {
          this.scheduleReconnect();
        }
      });

      ws.on("error", (err) => {
        log("error", `WebSocket error: ${err.message}`);
        if (!this.ws) {
          reject(err);
        }
      });
    });
  }

  private handleMessage(msg: ClientMessage) {
    if (msg.type === "action") {
      const pending = this.pendingCallbacks.get(msg.player_id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingCallbacks.delete(msg.player_id);
        pending.resolve(msg.action);
      } else {
        log("warn", `Received action for unknown player ${msg.player_id}`);
      }
    }
  }

  /**
   * Send a tick message and wait for the bot's action.
   * Returns null if the bot times out or is disconnected.
   */
  sendTickAndWait(
    playerId: string,
    message: ServerMessage,
  ): Promise<BotAction | null> {
    return new Promise((resolve) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        resolve(null);
        return;
      }

      const timer = setTimeout(() => {
        this.pendingCallbacks.delete(playerId);
        log("warn", `Tick timeout for player ${playerId}`);
        resolve(null);
      }, TICK_TIMEOUT_MS);

      this.pendingCallbacks.set(playerId, { resolve, timer });

      this.ws.send(JSON.stringify(message), (err) => {
        if (err) {
          clearTimeout(timer);
          this.pendingCallbacks.delete(playerId);
          log("error", `Failed to send tick: ${err.message}`);
          resolve(null);
        }
      });
    });
  }

  send(message: ServerMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(message));
  }

  private scheduleReconnect() {
    if (this.disposed) return;
    log("info", `Reconnecting in ${RECONNECT_DELAY_MS}ms...`);
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {});
    }, RECONNECT_DELAY_MS);
  }

  async dispose() {
    this.disposed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    for (const [, pending] of this.pendingCallbacks) {
      clearTimeout(pending.timer);
      pending.resolve(null);
    }
    this.pendingCallbacks.clear();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
