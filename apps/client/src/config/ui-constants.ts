import { GameMode } from "@generals-plus/engine";

/** Product title shown by the shared stage-brand component. */
export const APP_TITLE = "Generals Plus";

/** Default selectable mode until more rulesets are wired end to end. */
export const DEFAULT_GAME_MODE = GameMode.CLASSIC;

/** Client-side mode gate while only Classic is implemented end to end. */
const SUPPORTED_GAME_MODES: ReadonlySet<GameMode> = new Set([
  DEFAULT_GAME_MODE,
  GameMode.TURF_WAR,
  GameMode.DOMINATION,
  GameMode.DEMOLITION,
  GameMode.COLLAPSE,
  GameMode.PAYLOAD,
  GameMode.RUGBY,
]);

/** Formats serialized game-mode ids for compact UI labels. */
function formatGameMode(mode: string): string {
  return mode.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface ModeHelpData {
  summary: string;
  rules: string[];
}

/** Detailed rules for each game mode, shown in the mode help dialog. */
export const GAME_MODE_HELP: Record<GameMode, ModeHelpData> &
  Record<string, ModeHelpData> = {
  [GameMode.CLASSIC]: {
    summary: "Classic generals.io rules. Capture the enemy general to win.",
    rules: [
      "Capture all enemy generals to win.",
      "Your general produces +1 troop per tick.",
      "Cities produce +1 troop per tick once captured.",
      "Losing your general eliminates you from the game.",
      "When a general is captured, it becomes a city.",
    ],
  },
  [GameMode.DEMOLITION]: {
    summary:
      "Attack/Defend mode. Attackers must plant and detonate a bomb. Defenders must stop them.",
    rules: [
      "Two teams: Attackers vs Defenders.",
      "The bomb starts with a random attacker and can only be carried by attackers.",
      "Attackers win by detonating the bomb at a bomb site or eliminating all defenders.",
      "Defenders win by defusing the bomb, eliminating all attackers, or surviving until time runs out (3 min).",
      "Planting takes 6 ticks; defusing takes 10 ticks.",
      "The bomb explodes 90 ticks after being planted.",
    ],
  },
  [GameMode.TURF_WAR]: {
    summary:
      "High-speed area control. The player who owns the most tiles when time runs out wins.",
    rules: [
      "Own the most territory when the timer ends (3 min) to win, or eliminate all enemies early.",
      "All troop generation is doubled (2× speed).",
      "Generals produce +2 troops/tick; cities produce +2 troops/tick.",
      "When a general is captured, it becomes a plain tile.",
      "The scoreboard shows each team's land percentage.",
    ],
  },
  [GameMode.BIOHAZARD]: {
    summary:
      "Survival mode. Zombies try to infect all humans. Humans try to survive.",
    rules: [
      "Two factions: Zombies vs Humans.",
      "Zombies win by infecting all humans.",
      "Humans win by surviving until time runs out.",
    ],
  },
  [GameMode.PAYLOAD]: {
    summary: "Objective push. Teams escort a cart to the enemy base.",
    rules: [
      "Two teams compete to push a cart along a track toward the enemy base.",
      "The cart requires at least 6 troops occupying its 3×3 area to move.",
      "The cart advances every 4 ticks while being pushed.",
      "Win by pushing the cart to the end of the track.",
      "If time runs out (5 min), the team that pushed the cart furthest wins.",
    ],
  },
  [GameMode.RUGBY]: {
    summary:
      "Capture the Ball and score touchdowns. Carry the Rugby Ball into the opponent's Goal Zone.",
    rules: [
      "Two teams compete: Left Team vs Right Team.",
      "A Rugby Ball spawns near the center. Moving onto the ball picks it up.",
      "Carrying the ball slows down troop movement speed (default: 1 move per second).",
      "Score a touchdown by moving the ball into the opponent's Goal Zone.",
      "Goal Zones are located near the left and right margins of the map.",
      "First team to reach the target score (default: 5) wins, or the team with the highest score on timeout.",
    ],
  },
  [GameMode.COLLAPSE]: {
    summary:
      "Battle royale style. The playable map area steadily shrinks over time, forcing players together.",
    rules: [
      "Last team standing wins.",
      "The safe zone shrinks every 30 seconds after an initial 60-second delay.",
      "The map collapses in 6 stages, shrinking to a small final zone.",
      "Tiles outside the safe zone become impassable void.",
      "If your general is caught in the collapse, it is relocated to the safe zone.",
      "Players with no safe land are eliminated.",
    ],
  },
  [GameMode.DOMINATION]: {
    summary:
      "Control point mode. Capture and hold strategic locations on the map to accumulate score.",
    rules: [
      "Two teams compete to reach the target score (default 1000) first.",
      "Capture flag tiles by moving your troops onto them.",
      "Teams score points every tick for each flag they hold.",
      "Holding a flag longer increases its score rate: 1 + floor(ticks held / 100).",
      "If time runs out (5 min), the team with the highest score wins.",
      "Players with no remaining land are eliminated.",
    ],
  },
  [GameMode.ESPIONAGE]: {
    summary:
      "Intelligence gathering. Infiltrate the enemy base to steal intel or operate under heavy fog of war.",
    rules: [
      "Infiltrate the enemy base to steal intel.",
      "Operate under heavy fog of war with limited vision.",
    ],
  },
  "vs-ai": {
    summary:
      "Battle against AI opponents. Practice your strategy and improve your skills.",
    rules: [
      "You play against an AI-controlled opponent using the Classic ruleset.",
      "AI difficulty adapts to provide a challenging experience.",
      "Capture the AI's general to win.",
      "No matchmaking queue — start instantly.",
    ],
  },
};

/** Mode options presented by lobby and setup controls. */
export const GAME_MODE_OPTIONS = [
  ...Object.values(GameMode)
    .filter((mode) => mode !== GameMode.ESPIONAGE)
    .map((mode) => ({
      id: mode as GameMode,
      label: formatGameMode(mode),
      help: GAME_MODE_HELP[mode],
      minPlayers: 2,
      isEnabled: SUPPORTED_GAME_MODES.has(mode),
      isVsAi: false as const,
    })),
  {
    id: "vs-ai" as const,
    label: "AI Arena",
    minPlayers: 2,
    help: GAME_MODE_HELP["vs-ai"],
    isEnabled: false,
    isVsAi: true as const,
  },
];

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
