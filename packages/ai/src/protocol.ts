/**
 * Communication protocol types between TS server and Python bot service.
 */

// --- TS → Python messages ---

export interface VisionCellJSON {
  visibility: string;
  terrain: string;
  troop_count: number;
  owner_index: string;
  is_general: boolean;
  is_city: boolean;
}

export interface TickMessage {
  type: "tick";
  player_id: string;
  tick: number;
  grid: {
    type: "square" | "hex";
    width: number;
    height: number;
  };
  vision: VisionCellJSON[];
  owned_land_count: number;
  owned_army_count: number;
  scoreboard: ScoreboardEntry[];
}

export interface StartMessage {
  type: "start";
  player_id: string;
  config: BotConfig;
}

export interface EndMessage {
  type: "end";
  player_id: string;
}

export type ServerMessage = TickMessage | StartMessage | EndMessage;

// --- Python → TS messages ---

export interface BotAction {
  pass: number;
  row: number;
  col: number;
  direction: number;
  split: number;
}

export interface ActionMessage {
  type: "action";
  player_id: string;
  action: BotAction | null;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export type ClientMessage = ActionMessage | ErrorMessage;

// --- Config ---

export interface ScoreboardEntry {
  playerId: string;
  troops: number;
  land: number;
  isAlive: boolean;
}

export interface BotConfig {
  model_path?: string;
  difficulty?: "easy" | "medium" | "hard";
}

// --- Direction constants ---

export const DIRECTION_OFFSETS = [
  { dx: 0, dy: -1 }, // 0 = UP
  { dx: 0, dy: 1 }, // 1 = DOWN
  { dx: -1, dy: 0 }, // 2 = LEFT
  { dx: 1, dy: 0 }, // 3 = RIGHT
] as const;
