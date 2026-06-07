import * as z from "zod";

import { SeatReservationSchema } from "#/features/queue/schemas";

export const vsAiWsContracts = {
  channel: "vs-ai",
  description:
    "Instant 1v1 versus-AI room. Joining as an authenticated user immediately creates a bot match.",
  joinOptions: z
    .object({})
    .describe(
      "No extra parameters are required. The player identity comes from the auth token.",
    ),
  clientToServer: {
    confirm: {
      summary: "Confirm the seat reservation for the created bot match",
      payload: z.object({}).describe("Empty request body"),
    },
  },
  serverToClient: {
    seat: {
      summary: "Seat reservation details for the created match room",
      payload: SeatReservationSchema,
    },
  },
};
