import type {
  PlayerRatings,
  UserPreferences,
} from "@generals-plus/shared-types";

export interface UserProfile {
  readonly id: string;
  readonly displayName: string;
  readonly ratings?: PlayerRatings;
  readonly preferences?: UserPreferences;
  readonly metadata?: Record<string, unknown>;
}
