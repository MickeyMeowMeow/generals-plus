import type { Action } from "#/domain/action/interfaces";
import type { EffectRegistry } from "#/domain/effect/effect-registry";
import type { GameMode } from "#/domain/game/game-mode";
import type { IGameResult } from "#/domain/game/game-result";
import type { GameStatus } from "#/domain/game/game-status";
import type { Grid } from "#/domain/grid/grid";
import type { IPlayer, IPlayerState } from "#/domain/player/interfaces";
import type { Team } from "#/domain/team/interfaces";
import type { IVisionGrid } from "#/domain/vision/vision-grid";
import type { ICoordinate } from "#/math/coordinate";

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

  /** The registry that handles ticking and expiring effects. */
  readonly effectRegistry: EffectRegistry;

  /** The 2D grid of cells. */
  readonly grid: Grid;

  /** Map of all players (ID -> State). */
  readonly players: Map<string, IPlayer>;

  /** Map of all teams (ID -> State). */
  readonly teams: Map<string, Team>;

  /** Explicit player→coordinate mapping for custom maps. */
  spawnPositions?: Map<string, ICoordinate>;

  /**
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
   * @param action The action object containing player ID and execution details.
   * @returns True if the action was valid and executed, false otherwise.
   */
  handleAction(action: Action): boolean;

  /**
   * Evaluates the current game state against the specific victory conditions of the active GameMode.
   *
   * If a victory or draw condition is met, this method will:
   * 1. Transition the game status to 'FINISHED'.
   * 2. Finalize all player and team statistics.
   * 3. Generate a complete game report.
   *
   * @returns Returns the final game results if the game has ended, or null if the game is still in progress.
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
   * @returns The final game results generated at the moment of termination.
   */
  forceEnd(): IGameResult;

  /**
   * Retrieves the current vision grid for a specific player based on their team.
   *
   * @param playerId The ID of the player requesting vision.
   * @returns The masked grid for the player, or null if the player doesn't exist.
   */
  getVisionGrid(playerId: string): IVisionGrid | null;

  /**
   * Retrieves the fundamental state for a specific player (ID, team, status).
   * Note: This does not include dynamic scores like troops or land.
   *
   * @param playerId The ID of the player.
   * @returns The player's state, or null if the player doesn't exist.
   */
  getPlayerState(playerId: string): IPlayerState | null;

  /**
   * Retrieves the current scoreboard, containing scores (troops, land, etc.) for all active players
   * and any global score metrics. The specific type returned depends on the game mode.
   *
   * @returns The unified scoreboard for the current mode.
   */
  getScoreboard(): IBaseScoreboard;
}

export interface IBaseScoreboard {
  readonly mode: GameMode;
}

export interface IClassicScoreboard extends IBaseScoreboard {
  readonly mode: typeof GameMode.CLASSIC;
  readonly players: Array<{
    readonly playerId: string;
    readonly troops: number;
    readonly land: number;
    readonly isAlive: boolean;
  }>;
}

export interface ITurfWarScoreboard extends IBaseScoreboard {
  readonly mode: typeof GameMode.TURF_WAR;
  readonly players: Array<{
    readonly playerId: string;
    readonly troops: number;
    readonly land: number;
    readonly isAlive: boolean;
  }>;
  readonly teams: Array<{
    readonly teamId: string;
    readonly playerIds: readonly string[];
    readonly landPercent: number;
  }>;
}

export interface IDominationScoreboard extends IBaseScoreboard {
  readonly mode: typeof GameMode.DOMINATION;
  readonly players: Array<{
    readonly playerId: string;
    readonly troops: number;
    readonly land: number;
    readonly isAlive: boolean;
  }>;
  readonly teamScores: Map<string, number>;
}

export interface ICollapseScoreboard extends IBaseScoreboard {
  readonly mode: typeof GameMode.COLLAPSE;
  readonly players: Array<{
    readonly playerId: string;
    readonly troops: number;
    readonly land: number;
    readonly isAlive: boolean;
  }>;
  readonly nextCollapseTick: number;
  readonly currentProgress: number;
  readonly startDelayTicks: number;
  readonly shrinkIntervalTicks: number;
}

/**
 * Classic FFA Mode.
 * Focuses on capital captures.
 */
export interface IClassicGame extends IBaseGame {
  readonly mode: typeof GameMode.CLASSIC;

  getScoreboard(): IClassicScoreboard;
}

/**
 * Turf War Mode.
 * High-speed area control. Most tiles owned at the end of time wins.
 */
export interface ITurfWarGame extends IBaseGame {
  readonly mode: typeof GameMode.TURF_WAR;

  getScoreboard(): ITurfWarScoreboard;
}

export interface IDemolitionScoreboard extends IBaseScoreboard {
  readonly mode: typeof GameMode.DEMOLITION;
  readonly players: Array<{
    readonly playerId: string;
    readonly troops: number;
    readonly land: number;
    readonly isAlive: boolean;
  }>;
  readonly bombSiteCount: number;
  readonly plantedAtSite: string | null;
  readonly detonationTick: number | null;
  readonly plantProgressTicks: number;
  readonly defuseProgressTicks: number;
  readonly defuserId: string | null;
  readonly isPlanted: boolean;
  readonly isDefused: boolean;
  readonly plantDurationTicks: number;
  readonly defuseDurationTicks: number;
  readonly detonateDurationTicks: number;
}

/**
 * Demolition Mode.
 * Tracks the bomb status and detonation sequence.
 */
export interface IDemolitionGame extends IBaseGame {
  readonly mode: typeof GameMode.DEMOLITION;

  getScoreboard(): IDemolitionScoreboard;
}

export interface IPayloadScoreboard extends IBaseScoreboard {
  readonly mode: typeof GameMode.PAYLOAD;
  readonly players: Array<{
    readonly playerId: string;
    readonly troops: number;
    readonly land: number;
    readonly isAlive: boolean;
  }>;
  readonly cartProgress: number; // 0.0 to 1.0
  readonly cartIndex: number;
  readonly trackLength: number;
  readonly totalTimeTicks: number;
  readonly speedTicks: number;
  readonly cartSize: number;
  readonly minPushers: number;
  readonly isContested: boolean;
  readonly pushingTeamId: string | null;
  readonly leftTeamId: string;
  readonly rightTeamId: string;
}

/**
 * Payload Mode.
 * Tracks the movement of the cart along a designated track.
 */
export interface IPayloadGame extends IBaseGame {
  readonly mode: typeof GameMode.PAYLOAD;
  /** Progress of the cart from 0.0 (Start) to 1.0 (End). */
  payloadProgress: number;

  getScoreboard(): IPayloadScoreboard;
}

export interface IBiohazardScoreboard extends IBaseScoreboard {
  readonly mode: typeof GameMode.BIOHAZARD;
  readonly players: Array<{
    readonly playerId: string;
    readonly troops: number;
    readonly land: number;
    readonly isAlive: boolean;
    readonly isZombie: boolean;
    readonly isMotherZombie: boolean;
  }>;
  readonly infectionPhase: "PREPARATION" | "OUTBREAK";
  readonly outbreakTick: number;
  readonly humanCount: number;
  readonly zombieCount: number;
  readonly totalTimeTicks: number;
}

/**
 * Biohazard Mode.
 * Manages the infection state and survivor counts.
 */
export interface IBiohazardGame extends IBaseGame {
  readonly mode: typeof GameMode.BIOHAZARD;
  infectionPhase: "PREPARATION" | "OUTBREAK";
  /** The tick when the first Mother Zombie will be chosen. */
  outbreakTick: number;

  getScoreboard(): IBiohazardScoreboard;
}

/**
 * Collapse (Battle Royale) Mode.
 * Manages the shrinking safe zone.
 */
export interface ICollapseGame extends IBaseGame {
  readonly mode: typeof GameMode.COLLAPSE;

  getScoreboard(): ICollapseScoreboard;
}

/**
 * Domination Mode.
 * Tracks point accumulation from control points (Shrines).
 */
export interface IDominationGame extends IBaseGame {
  readonly mode: typeof GameMode.DOMINATION;
  /** Points required to win the match. */
  readonly targetScore: number;
  /** Scores of each team. */
  readonly teamScores: Map<string, number>;

  getScoreboard(): IDominationScoreboard;
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

export interface IRugbyScoreboard extends IBaseScoreboard {
  readonly mode: typeof GameMode.RUGBY;
  readonly players: Array<{
    readonly playerId: string;
    readonly troops: number;
    readonly land: number;
    readonly isAlive: boolean;
  }>;
  readonly teamScores: Map<string, number>;
  readonly winningScore: number;
  readonly totalTimeTicks: number;
  readonly rugbyBallCount: number;
  readonly rugbyMoveSpeedTicks: number;
}

/**
 * Rugby Mode.
 * Focused on scoring and area control totals.
 */
export interface IRugbyGame extends IBaseGame {
  readonly mode: typeof GameMode.RUGBY;
  winningScore: number;

  getScoreboard(): IRugbyScoreboard;
}

/**
 * Union type representing all possible game states.
 */
export type GameState =
  | IClassicGame
  | ITurfWarGame
  | IDemolitionGame
  | IPayloadGame
  | IBiohazardGame
  | ICollapseGame
  | IDominationGame
  | IEspionageGame
  | IRugbyGame;
