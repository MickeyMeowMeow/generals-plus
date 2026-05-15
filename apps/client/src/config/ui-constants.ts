import { GameMode } from "@generals-plus/engine";

/** Product title shown by the shared stage-brand component. */
export const APP_TITLE = "Generals Plus";

/** Default selectable mode until more rulesets are wired end to end. */
export const DEFAULT_GAME_MODE = GameMode.CLASSIC;

/** Client-side mode gate while only Classic is implemented end to end. */
const SUPPORTED_GAME_MODES: ReadonlySet<GameMode> = new Set([
  DEFAULT_GAME_MODE,
]);

/** Formats serialized game-mode ids for compact UI labels. */
function formatGameMode(mode: string): string {
  return mode.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Mode options presented by lobby and setup controls. */
export const GAME_MODE_OPTIONS = Object.values(GameMode).map((mode) => ({
  id: mode,
  label: formatGameMode(mode),
  minPlayers: 2,
  isEnabled: SUPPORTED_GAME_MODES.has(mode),
}));

/** Playable official modes for queue creation. */
export const OFFICIAL_GAME_MODES = GAME_MODE_OPTIONS.filter(
  (mode) => mode.isEnabled,
);

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
