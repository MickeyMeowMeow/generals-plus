import * as z from "zod";

import {
  PickColorSchema,
  QueueJoinOptionsSchema,
  SeatReservationSchema,
} from "#/features/queue/schemas";

export const queueWsContracts = {
  channel: "queue",
  description: "Official matchmaking queue for ranked and public game modes.",
  joinOptions: QueueJoinOptionsSchema.describe(
    "Client-supplied queue join options",
  ),
  clientToServer: {
    confirm: {
      summary: "Confirm seat reservation to proceed to the match room",
      payload: z.object({}).describe("No payload"),
    },
    pickColor: {
      summary: "Pick a palette color while in queue",
      payload: PickColorSchema,
    },
  },
  serverToClient: {
    error: {
      summary: "Queue error message",
      payload: z.string().describe("Human-readable error message"),
    },
    seat: {
      summary: "Match found and seat reservation issued",
      payload: SeatReservationSchema,
    },
  },
};
