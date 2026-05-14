import { GameMode } from "@generals-plus/engine";

/** Product title shown by the shared stage-brand component. */
export const APP_TITLE = "Generals Plus";

/**
 * Official modes presented in the root-route lobby.
 *
 * The client currently exposes only Classic because the backend match creation
 * path supports that game mode. Keeping the display data here avoids scattering
 * hard-coded lobby copy through the route component and makes future mode
 * additions explicit.
 */
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

/**
 * Shared copy for the full-screen game stage.
 *
 * These strings are consumed by reusable visual primitives instead of individual
 * routes so the rebuilt shell keeps a consistent tone across auth, lobby,
 * setup, queue, and error states.
 */
export const GAME_STAGE_COPY = {
  eyebrow: "Realtime command",
  lobbyStatus: "Online operations ready",
  customRoomLabel: "Create custom room",
} as const;
