import { EffectTarget } from "#/domain/effect/effect-target";
import type { IPlayer } from "#/domain/player/interfaces";
import type {
  IBaseTeam,
  IScoringTeam,
  IStandardTeam,
} from "#/domain/team/interfaces";
import { TeamType } from "#/domain/team/team-type";

export abstract class BaseTeam extends EffectTarget implements IBaseTeam {
  readonly teamId: string;
  abstract readonly type: TeamType;
  isEliminated: boolean = false;
  private readonly _players: Set<IPlayer>;

  constructor(teamId: string) {
    super();
    this.teamId = teamId;
    this._players = new Set<IPlayer>();
  }

  get players(): IPlayer[] {
    return Array.from(this._players);
  }

  addPlayer(player: IPlayer): void {
    this._players.add(player);
  }

  removePlayer(player: IPlayer): void {
    this._players.delete(player);
  }
}

export class StandardTeam extends BaseTeam implements IStandardTeam {
  readonly type = TeamType.STANDARD;
}

export class ScoringTeam extends BaseTeam implements IScoringTeam {
  readonly type: typeof TeamType.SCORER | typeof TeamType.PUSHER;
  score: number = 0;

  constructor(
    type: typeof TeamType.SCORER | typeof TeamType.PUSHER,
    teamId: string,
  ) {
    super(teamId);
    this.type = type;
  }
}
