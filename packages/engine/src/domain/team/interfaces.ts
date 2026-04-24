import type { IEffectTarget } from "@/domain/effect/interfaces";
import type { IPlayer } from "@/domain/player/interfaces";
import type { TeamType } from "@/domain/team/team-type";

/**
 * Common properties for all team types.
 */
export interface IBaseTeam extends IEffectTarget {
  /** The strategic nature of the team. */
  readonly type: TeamType;
  /** Players belonging to this team. */
  readonly players: IPlayer[];
  /** Whether the team has been eliminated. */
  isEliminated: boolean;

  addPlayer(player: IPlayer): void;
  removePlayer(player: IPlayer): void;
}

/**
 * Properties for teams that compete primarily through elimination rather than scoring.
 */
export interface IStandardTeam extends IBaseTeam {}

/**
 * Properties for teams that compete based on a numerical score.
 */
export interface IScoringTeam extends IBaseTeam {
  readonly type: typeof TeamType.SCORER | typeof TeamType.PUSHER;
  /** Current score of the team. */
  score: number;
}

/**
 * Combined type representing any possible state a team can be in.
 */
export type Team = IStandardTeam | IScoringTeam;
