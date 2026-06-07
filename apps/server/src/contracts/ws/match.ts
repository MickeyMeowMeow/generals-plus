import * as z from "zod";

import {
  ActionSchema,
  ClientPingSchema,
  GameResultSchema,
  ServerPingSchema,
} from "#/features/match/schemas";

export const matchWsContracts = {
  channel: "match",
  description:
    "An active match room. Clients can only join through seat reservation details.",
  joinOptions: z
    .object({})
    .describe(
      "No extra parameters are required. Clients join via seat reservation details.",
    ),
  clientToServer: {
    action: {
      summary: "Submit a game action",
      payload: ActionSchema,
    },
    clear_queue: {
      summary: "Clear queued actions",
      payload: z.object({}).describe("Empty request body"),
    },
    ping: {
      summary: "Send a teammate-only map ping",
      payload: ClientPingSchema,
    },
  },
  serverToClient: {
    game_end: {
      summary: "Match finished",
      payload: GameResultSchema,
    },
    ping: {
      summary: "Broadcast a team map ping",
      payload: ServerPingSchema,
    },
  },
};
