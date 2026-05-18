export type GameRoomErrorCode =
  | "MATCH_CONNECT_FAILED"
  | "RECOVERY_FAILED"
  | "RECOVERY_TIMEOUT"
  | "RECOVERY_ROOM_NOT_FOUND"
  | "RECOVERY_TOKEN_INVALID";

export class GameRoomError extends Error {
  code: GameRoomErrorCode;

  constructor(code: GameRoomErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "GameRoomError";
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export function isTerminalRecoveryErrorCode(code: GameRoomErrorCode | null) {
  return (
    code === "RECOVERY_ROOM_NOT_FOUND" || code === "RECOVERY_TOKEN_INVALID"
  );
}

export function normalizeRecoveryError(error: unknown): GameRoomError {
  if (error instanceof GameRoomError) {
    return error;
  }

  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : "Failed to connect to match";
  const normalized = message.toLowerCase();

  if (normalized.includes("room not found")) {
    return new GameRoomError("RECOVERY_ROOM_NOT_FOUND", message, error);
  }

  if (normalized.includes("reconnection token invalid or expired")) {
    return new GameRoomError("RECOVERY_TOKEN_INVALID", message, error);
  }

  return new GameRoomError("RECOVERY_FAILED", message, error);
}

export function normalizeGameRoomError(
  error: unknown,
  connectionType: "reservation" | "recovery",
) {
  if (connectionType === "recovery") {
    return normalizeRecoveryError(error);
  }

  if (error instanceof GameRoomError) {
    return error;
  }

  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : "Failed to connect to match";
  return new GameRoomError("MATCH_CONNECT_FAILED", message, error);
}
