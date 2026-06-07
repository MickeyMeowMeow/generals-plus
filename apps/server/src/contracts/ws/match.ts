import * as z from "zod";

import {
  ActionSchema,
  ClientPingSchema,
  GameResultSchema,
  ServerPingSchema,
} from "#/features/match/schemas";

export const matchWsContracts = {
  channel: "match",
  description: "Active game match room. Accessed via seat reservation only.",
  joinOptions: z
    .object({})
    .describe("No options. Clients join through a seat reservation."),
  clientToServer: {
    action: {
      summary: "Submit a game action",
      payload: ActionSchema,
    },
    clear_queue: {
      summary: "Clear the queued actions for the player",
      payload: z.object({}).describe("No payload"),
    },
    ping: {
      summary: "Send a team-only map ping",
      payload: ClientPingSchema,
    },
  },
  serverToClient: {
    game_end: {
      summary: "Match ended",
      payload: GameResultSchema,
    },
    ping: {
      summary: "Team ping broadcast",
      payload: ServerPingSchema,
    },
  },
};
