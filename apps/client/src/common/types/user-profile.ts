import type { PlayerRatings } from "@generals-plus/shared-types";

export interface UserProfile {
  readonly id: string;
  readonly displayName: string;
  readonly ratings?: PlayerRatings;
  readonly metadata?: Record<string, unknown>;
}
