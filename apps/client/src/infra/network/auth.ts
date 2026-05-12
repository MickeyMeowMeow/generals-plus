/**
 * Shape of the auth response emitted by the network provider.
 */
export interface AuthData<User = unknown> {
  readonly user: User | null;
  readonly token: string | null;
}
