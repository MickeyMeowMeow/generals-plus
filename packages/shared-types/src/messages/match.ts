import type { Action, IGameResult } from "@generals-plus/engine";

import type { MessagePayload } from "#/messages";

export const MatchClientMessage = {
  ACTION: "action",
  CLEAR_QUEUE: "clear_queue",
} as const;

export type MatchClientMessage =
  (typeof MatchClientMessage)[keyof typeof MatchClientMessage];

export interface MatchClientMessagePayload extends MessagePayload {
  [MatchClientMessage.ACTION]: Action;
  [MatchClientMessage.CLEAR_QUEUE]: never;
}

export const MatchServerMessage = {
  GAME_END: "game_end",
} as const;

export type MatchServerMessage =
  (typeof MatchServerMessage)[keyof typeof MatchServerMessage];

export interface MatchServerMessagePayload extends MessagePayload {
  [MatchServerMessage.GAME_END]: IGameResult;
}
