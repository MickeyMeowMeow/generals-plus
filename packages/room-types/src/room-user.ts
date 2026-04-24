import { z } from "zod";

export interface JoinOptions {
  username: string;
  token: string;
}

export const joinOptionsSchema = z
  .object({
    username: z.string().trim().min(1),
    token: z.string().min(1),
  })
  .strict();

export function parseJoinOptions(options: unknown): JoinOptions | null {
  const result = joinOptionsSchema.safeParse(options);
  if (!result.success) {
    return null;
  }

  return result.data;
}

export interface RoomUser {
  username: string;
  token: string;
  // Additional fields can be added as needed
}
