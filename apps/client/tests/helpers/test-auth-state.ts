import type { AuthContextValue } from "#/features/auth/auth-store";

let value: AuthContextValue | null = null;

export function getTestAuthValue() {
  return value;
}

export function setTestAuthValue(v: AuthContextValue) {
  value = v;
}
