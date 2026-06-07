import * as z from "zod";

import { SeatReservationSchema } from "#/features/queue/schemas";

export const vsAiWsContracts = {
  channel: "vs-ai",
  description:
    "Instant 1v1 room that creates a bot match immediately after the authenticated player joins.",
  joinOptions: z
    .object({})
    .describe("No options. Authentication token identifies the player."),
  clientToServer: {
    confirm: {
      summary: "Confirm the seat reservation for the created bot match",
      payload: z.object({}).describe("No payload"),
    },
  },
  serverToClient: {
    seat: {
      summary: "Seat reservation for the created match room",
      payload: SeatReservationSchema,
    },
  },
};
