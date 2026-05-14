import { GameMode } from "@generals-plus/engine";

export const APP_TITLE = "Generals Plus";

export const OFFICIAL_GAME_MODES = [
  {
    id: GameMode.CLASSIC,
    label: "Classic",
    tagline: "Capture the general. Own the front.",
    description:
      "The original Generals ruleset with fog of war, expanding armies, and one decisive target.",
    minPlayers: 2,
  },
] as const;

export const GAME_STAGE_COPY = {
  eyebrow: "Realtime command",
  lobbyStatus: "Online operations ready",
  customRoomLabel: "Create custom room",
} as const;
