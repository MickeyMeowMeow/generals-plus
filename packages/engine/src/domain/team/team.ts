import { EffectTarget } from "#/domain/effect/effect-target";
import type { IPlayer } from "#/domain/player/interfaces";
import type {
  IBaseTeam,
  IScoringTeam,
  IStandardTeam,
} from "#/domain/team/interfaces";
import { TeamType } from "#/domain/team/team-type";

export abstract class BaseTeam extends EffectTarget implements IBaseTeam {
  public readonly teamId: string;
  public abstract readonly type: TeamType;
  public isEliminated: boolean = false;
  private readonly _players: Set<IPlayer>;

  constructor(teamId: string) {
    super();
    this.teamId = teamId;
    this._players = new Set<IPlayer>();
  }

  get players(): IPlayer[] {
    return Array.from(this._players);
  }

  public addPlayer(player: IPlayer): void {
    this._players.add(player);
  }

  public removePlayer(player: IPlayer): void {
    this._players.delete(player);
  }
}

export class StandardTeam extends BaseTeam implements IStandardTeam {
  public readonly type = TeamType.STANDARD;

  constructor(teamId: string) {
    super(teamId);
  }
}

export class ScoringTeam extends BaseTeam implements IScoringTeam {
  public readonly type: typeof TeamType.SCORER | typeof TeamType.PUSHER;
  public score: number = 0;

  constructor(
    type: typeof TeamType.SCORER | typeof TeamType.PUSHER,
    teamId: string,
  ) {
    super(teamId);
    this.type = type;
  }
}
