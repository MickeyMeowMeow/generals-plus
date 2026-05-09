export interface UserProfile {
  readonly id: string;
  readonly displayName: string;
  readonly metadata?: Record<string, unknown>;
}
