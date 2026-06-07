import * as z from "zod";

import {
  PickColorSchema,
  QueueJoinOptionsSchema,
  SeatReservationSchema,
} from "#/features/queue/schemas";

export const queueWsContracts = {
  channel: "queue",
  description:
    "Official matchmaking queue room for ranked and public game modes.",
  joinOptions: QueueJoinOptionsSchema.describe(
    "Queue options provided by the client",
  ),
  clientToServer: {
    confirm: {
      summary: "Confirm seat reservation and enter the match room",
      payload: z.object({}).describe("Empty request body"),
    },
    pickColor: {
      summary: "Choose a color while waiting in queue",
      payload: PickColorSchema,
    },
  },
  serverToClient: {
    error: {
      summary: "Queue error message",
      payload: z.string().describe("User-facing error message"),
    },
    seat: {
      summary: "Matched successfully and provided seat reservation details",
      payload: SeatReservationSchema,
    },
  },
};
