import type { IAction } from "@/domain/action/action";
import type { GameMode } from "@/domain/game/game-mode";
import type { IGameResult } from "@/domain/game/game-result";
import type { GameStatus } from "@/domain/game/game-status";
import type { IGrid } from "@/domain/grid/grid";
import type { IItem } from "@/domain/item/item";
import type { IPlayer } from "@/domain/player/player";
import type { Team } from "@/domain/team/team";
import type { ICoordinate } from "@/math/coordinate";

/**
 * The root state of the Game Engine.
 */
export interface IBaseGame {
  /**
   * The primary game mode.
   * Determines which logic system the engine uses.
   */
  readonly mode: GameMode;

  status: GameStatus;
  tick: number;

  /** The 2D grid of cells. */
  readonly grid: IGrid;

  /** Map of all players (ID -> State). */
  readonly players: Map<string, IPlayer>;

  /** Map of all teams (ID -> State). */
  readonly teams: Map<string, Team>;

  /** Dynamic entities (bomb, cart, ball) based on the current mode. */
  readonly items: Array<IItem>;

  /**
   * Transitions the game status from 'LOBBY' to 'PLAYING'.
   * Starts the internal tick counter and troop growth timers.
   */
  startGame(): void;

  /**
   * The core heart-beat of the engine. Executes one simulation step.
   * This handles troop growth, resource generation, and mode-specific progress.
   */
  nextTick(): void;

  /**
   * Processes a player-initiated action (move, skill, etc.).
   *
   * @param action - The action object containing player ID and execution details.
   * @returns boolean - True if the action was valid and executed, false otherwise.
   */
  handleAction(action: IAction): boolean;

  /**
   * Evaluates the current game state against the specific victory conditions of the active GameMode.
   *
   * If a victory or draw condition is met, this method will:
   * 1. Transition the game status to 'FINISHED'.
   * 2. Finalize all player and team statistics.
   * 3. Generate a complete game report.
   *
   * @returns IGameResult | null - Returns the final game results if the game has ended,
   * or null if the game is still in progress.
   */
  checkGameEnd(): IGameResult | null;

  /**
   * Immediately terminates the game session and determines a winner based on the current
   * state, regardless of whether standard victory conditions have been met.
   *
   * This is typically used for:
   * 1. Match time-out (remainingTime reaches 0).
   * 2. Administrative intervention or server-side forced closure.
   *
   * Unlike checkGameEnd(), this method will always result in a 'FINISHED' state
   * and will use fallback logic (e.g., most tiles, most troops) to decide a winner
   * if no definitive victory is achieved.
   *
   * @returns IGameResult - The final game results generated at the moment of termination.
   */
  forceEnd(): IGameResult;
}

/**
 * Classic FFA Mode / Turf War Mode.
 * Focuses on capital captures.
 */
export interface IStandardGame extends IBaseGame {
  readonly mode: typeof GameMode.CLASSIC | typeof GameMode.TURF_WAR;
  // Standard rules usually don't need additional global variables.
}

/**
 * Demolition Mode.
 * Tracks the bomb status and detonation sequence.
 */
export interface IDemolitionGame extends IBaseGame {
  readonly mode: typeof GameMode.DEMOLITION;
  bombStatus: {
    readonly sites: Record<string, ICoordinate>;
    plantedAtSite: string | null;
    detonationTick: number | null; // The tick when the bomb will explode
  };
}

/**
 * Payload Mode.
 * Tracks the movement of the cart along a designated track.
 */
export interface IPayloadGame extends IBaseGame {
  readonly mode: typeof GameMode.PAYLOAD;
  /** Progress of the cart from 0.0 (Start) to 1.0 (End). */
  payloadProgress: number;
}

/**
 * Biohazard Mode.
 * Manages the infection state and survivor counts.
 */
export interface IBiohazardGame extends IBaseGame {
  readonly mode: typeof GameMode.BIOHAZARD;
  infectionPhase: "PREPARATION" | "OUTBREAK" | "CLEANUP";
  /** The tick when the first Mother Zombie will be chosen. */
  outbreakTick: number;
}

/**
 * Collapse (Battle Royale) Mode.
 * Manages the shrinking safe zone.
 */
export interface ICollapseGame extends IBaseGame {
  readonly mode: typeof GameMode.COLLAPSE;
  /** Current progress of the safe zone become smaller. */
  currentProgress: number;
  /** Tick count until the next border shrinkage. */
  nextCollapseTick: number;
}

/**
 * Domination Mode.
 * Tracks point accumulation from control points (Shrines).
 */
export interface IDominationGame extends IBaseGame {
  readonly mode: typeof GameMode.DOMINATION;
  /** Points required to win the match. */
  readonly targetScore: number;
  /** Location of all Shrines on the map. */
  shrineLocations: Array<ICoordinate>;
}

/**
 * Espionage Mode.
 * Manages global stealth and the hidden spy network.
 */
export interface IEspionageGame extends IBaseGame {
  readonly mode: typeof GameMode.ESPIONAGE;
  /** Tracks players who currently have 'Radio Silence' (Stealth) active. */
  stealthActivePlayers: Set<string>;
  /** Global reveal status (e.g., if a Recon Satellite is used). */
  isGlobalRevealActive: boolean;
}

/**
 * Rugby Mode.
 * Focused on scoring and area control totals.
 */
export interface IRugbyGame extends IBaseGame {
  readonly mode: typeof GameMode.RUGBY;
  /** Global score limit or record. */
  winningScore?: number;
}

/**
 * Union type representing all possible game states.
 */
export type GameState =
  | IStandardGame
  | IDemolitionGame
  | IPayloadGame
  | IBiohazardGame
  | ICollapseGame
  | IDominationGame
  | IEspionageGame
  | IRugbyGame;
