import { EffectTarget } from "#/domain/effect/effect-target";
import type { IPlayer } from "#/domain/player/interfaces";
import { PlayerStatus } from "#/domain/player/player-status";
import type { Team } from "#/domain/team/interfaces";

export class Player extends EffectTarget implements IPlayer {
  public readonly playerId: string;
  public team: Team;
  public status: PlayerStatus;

  constructor(
    team: Team,
    playerId: string,
    status: PlayerStatus = PlayerStatus.ACTIVE,
  ) {
    super();
    this.playerId = playerId;
    this.team = team;
    this.status = status;
  }
}
