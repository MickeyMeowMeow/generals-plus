import { GameMode } from "@generals-plus/engine";

/** Product title shown by the shared stage-brand component. */
export const APP_TITLE = "Generals Plus";

/**
 * Mode options presented by lobby and setup controls.
 *
 * Non-Classic modes are visible but disabled until matching engine/server
 * implementations exist, keeping the UI honest while documenting the roadmap.
 */
export const GAME_MODE_OPTIONS = [
  {
    id: GameMode.CLASSIC,
    label: "Classic",
    description: "Capture the general under fog of war.",
    minPlayers: 2,
    isEnabled: true,
  },
  {
    id: GameMode.DEMOLITION,
    label: "Demolition",
    description: "Attackers plant and detonate a bomb.",
    minPlayers: 2,
    isEnabled: false,
  },
  {
    id: GameMode.TURF_WAR,
    label: "Turf War",
    description: "Win by holding the most territory.",
    minPlayers: 2,
    isEnabled: false,
  },
  {
    id: GameMode.BIOHAZARD,
    label: "Biohazard",
    description: "Survive infection or spread it.",
    minPlayers: 2,
    isEnabled: false,
  },
  {
    id: GameMode.PAYLOAD,
    label: "Payload",
    description: "Escort the objective through enemy space.",
    minPlayers: 2,
    isEnabled: false,
  },
  {
    id: GameMode.RUGBY,
    label: "Rugby",
    description: "Carry the ball into the enemy goal.",
    minPlayers: 2,
    isEnabled: false,
  },
  {
    id: GameMode.COLLAPSE,
    label: "Collapse",
    description: "Fight as the playable map shrinks.",
    minPlayers: 2,
    isEnabled: false,
  },
  {
    id: GameMode.DOMINATION,
    label: "Domination",
    description: "Control points to build score.",
    minPlayers: 2,
    isEnabled: false,
  },
  {
    id: GameMode.ESPIONAGE,
    label: "Espionage",
    description: "Steal intel through heavy fog.",
    minPlayers: 2,
    isEnabled: false,
  },
] as const;

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
