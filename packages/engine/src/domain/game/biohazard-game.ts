import { ActionType } from "#/domain/action/action-type";
import type { Action } from "#/domain/action/interfaces";
import { Terrain } from "#/domain/cell/terrain";
import { BiohazardCombatResolver } from "#/domain/combat/biohazard-combat-resolver";
import { EffectType } from "#/domain/effect/effect-type";
import { TroopModifierEffect } from "#/domain/effect/periodic/troop-modifier";
import { BaseGame } from "#/domain/game/base-game";
import { GameMode } from "#/domain/game/game-mode";
import type { IGameResult } from "#/domain/game/game-result";
import { GameStatus } from "#/domain/game/game-status";
import type {
  IBiohazardGame,
  IBiohazardScoreboard,
} from "#/domain/game/interfaces";
import type { GridInput } from "#/domain/grid/grid-generator";
import { PlayerStatus } from "#/domain/player/player-status";
import { HumanTeam, ZombieTeam } from "#/domain/team/team";
import { TeamType } from "#/domain/team/team-type";

export interface BiohazardGameOptions {
  outbreakTick?: number;
  finishTick?: number;
  zombieTroopMultiplier?: number;
}

export class BiohazardGame extends BaseGame implements IBiohazardGame {
  readonly mode = GameMode.BIOHAZARD;
  private readonly combatResolver = new BiohazardCombatResolver();

  readonly outbreakTick: number;
  readonly maxTicks: number;
  readonly zombieTroopMultiplier: number;

  infectionPhase: "PREPARATION" | "OUTBREAK" = "PREPARATION";
  motherZombiePlayerIds: Set<string> = new Set();
  private humanTeamId: string | null = null;
  private zombieTeamId: string | null = null;

  constructor(input: GridInput, options?: BiohazardGameOptions) {
    super(input);
    this.outbreakTick = options?.outbreakTick ?? 120;
    this.maxTicks = options?.finishTick ?? 480;
    this.zombieTroopMultiplier = options?.zombieTroopMultiplier ?? 2;

    this.combatResolver.onInfection = (infectedPlayerId, _attackerPlayerId) => {
      this.convertToZombie(infectedPlayerId);
    };
  }

  startGame(): void {
    super.startGame();
    this.assignStartPositions();

    // Standard troop effects expire at outbreak tick so they can be replaced
    const expiry = this.outbreakTick;

    this.effectRegistry.register(
      this.tick,
      new TroopModifierEffect(this.tick, {
        id: "biohazard-general-troop-gen",
        type: EffectType.TROOP_GENERATION,
        target: this.grid,
        terrain: Terrain.GENERAL,
        delta: 1,
        interval: 1,
        expireAt: expiry,
      }),
    );

    this.effectRegistry.register(
      this.tick,
      new TroopModifierEffect(this.tick, {
        id: "biohazard-city-troop-gen",
        type: EffectType.TROOP_GENERATION,
        target: this.grid,
        terrain: Terrain.CITY,
        delta: 1,
        interval: 1,
        expireAt: expiry,
      }),
    );

    this.effectRegistry.register(
      this.tick,
      new TroopModifierEffect(this.tick, {
        id: "biohazard-plain-troop-gen",
        type: EffectType.TROOP_GENERATION,
        target: this.grid,
        terrain: Terrain.PLAIN,
        delta: 1,
        interval: 25,
        expireAt: expiry,
      }),
    );
  }

  private triggerOutbreak(): void {
    const activeTeamIds = new Set<string>();
    for (const player of this.players.values()) {
      if (player.status === PlayerStatus.ACTIVE) {
        activeTeamIds.add(player.team.teamId);
      }
    }

    if (activeTeamIds.size < 2) return;

    const teamArray = Array.from(activeTeamIds);
    const pickedTeamId =
      teamArray[Math.floor(Math.random() * teamArray.length)] ?? "";

    const zombieTeam = new ZombieTeam("zombies");
    const humanTeam = new HumanTeam("humans");
    this.teams.set("zombies", zombieTeam);
    this.teams.set("humans", humanTeam);
    this.zombieTeamId = "zombies";
    this.humanTeamId = "humans";

    for (const player of this.players.values()) {
      if (player.status !== PlayerStatus.ACTIVE) continue;

      const oldTeam = player.team;
      oldTeam.removePlayer(player);

      if (oldTeam.teamId === pickedTeamId) {
        player.team = zombieTeam;
        zombieTeam.addPlayer(player);
        this.motherZombiePlayerIds.add(player.playerId);
      } else {
        player.team = humanTeam;
        humanTeam.addPlayer(player);
      }
    }

    // Remove empty StandardTeams
    const teamsToRemove: string[] = [];
    for (const [teamId, team] of this.teams) {
      if (
        teamId !== "zombies" &&
        teamId !== "humans" &&
        team.players.length === 0
      ) {
        teamsToRemove.push(teamId);
      }
    }
    for (const teamId of teamsToRemove) {
      this.teams.delete(teamId);
    }

    this.infectionPhase = "OUTBREAK";

    // Register post-outbreak troop generation
    // Standard production for ALL active players (no ownerPlayerIds filter,
    // so newly infected players still get troop generation automatically)
    this.effectRegistry.register(
      this.tick,
      new TroopModifierEffect(this.tick, {
        id: "biohazard-outbreak-general",
        type: EffectType.TROOP_GENERATION,
        target: this.grid,
        terrain: Terrain.GENERAL,
        delta: 1,
        interval: 1,
      }),
    );

    this.effectRegistry.register(
      this.tick,
      new TroopModifierEffect(this.tick, {
        id: "biohazard-outbreak-city",
        type: EffectType.TROOP_GENERATION,
        target: this.grid,
        terrain: Terrain.CITY,
        delta: 1,
        interval: 1,
      }),
    );

    this.effectRegistry.register(
      this.tick,
      new TroopModifierEffect(this.tick, {
        id: "biohazard-outbreak-plain",
        type: EffectType.TROOP_GENERATION,
        target: this.grid,
        terrain: Terrain.PLAIN,
        delta: 1,
        interval: 25,
      }),
    );

    // Mother zombie extra boost on top of standard production
    const extraDelta = this.zombieTroopMultiplier - 1;
    this.effectRegistry.register(
      this.tick,
      new TroopModifierEffect(this.tick, {
        id: "biohazard-outbreak-mother-general-boost",
        type: EffectType.TROOP_GENERATION,
        target: this.grid,
        terrain: Terrain.GENERAL,
        delta: extraDelta,
        interval: 1,
        ownerPlayerIds: this.motherZombiePlayerIds,
      }),
    );

    this.effectRegistry.register(
      this.tick,
      new TroopModifierEffect(this.tick, {
        id: "biohazard-outbreak-mother-city-boost",
        type: EffectType.TROOP_GENERATION,
        target: this.grid,
        terrain: Terrain.CITY,
        delta: extraDelta,
        interval: 1,
        ownerPlayerIds: this.motherZombiePlayerIds,
      }),
    );

    this.effectRegistry.register(
      this.tick,
      new TroopModifierEffect(this.tick, {
        id: "biohazard-outbreak-mother-plain-boost",
        type: EffectType.TROOP_GENERATION,
        target: this.grid,
        terrain: Terrain.PLAIN,
        delta: extraDelta,
        interval: 25,
        ownerPlayerIds: this.motherZombiePlayerIds,
      }),
    );
  }

  private convertToZombie(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player || player.status !== PlayerStatus.ACTIVE) return;

    const zombieTeam = this.teams.get("zombies");
    if (!zombieTeam) return;

    const oldTeam = player.team;
    oldTeam.removePlayer(player);
    player.team = zombieTeam;
    zombieTeam.addPlayer(player);
  }

  protected executeAction(action: Action): boolean {
    if (
      action.type !== ActionType.MOVE &&
      action.type !== ActionType.SPLIT_MOVE
    ) {
      return false;
    }

    const success = this.combatResolver.execute(
      action,
      this.grid,
      this.players,
    );

    if (success) {
      this.checkGameEnd();
    }

    return success;
  }

  nextTick(): void {
    if (this.status !== GameStatus.PLAYING) {
      return;
    }

    if (
      this.tick + 1 === this.outbreakTick &&
      this.infectionPhase === "PREPARATION"
    ) {
      this.triggerOutbreak();
    }

    super.nextTick();
    this.checkGameEnd();
  }

  protected evaluateGameEnd(): IGameResult | null {
    if (this.infectionPhase === "PREPARATION") {
      const aliveTeams = this.getAliveTeams();
      if (aliveTeams.size <= 1) {
        return {
          mode: this.mode,
          winnerTeamId: aliveTeams.values().next().value ?? null,
        };
      }
      return null;
    }

    const hasActiveZombies = this.hasActivePlayersOfType(TeamType.ZOMBIE);
    const hasActiveHumans = this.hasActivePlayersOfType(TeamType.HUMAN);

    if (!hasActiveZombies) {
      return { mode: this.mode, winnerTeamId: this.humanTeamId };
    }

    if (!hasActiveHumans) {
      return { mode: this.mode, winnerTeamId: this.zombieTeamId };
    }

    if (this.tick >= this.maxTicks) {
      return { mode: this.mode, winnerTeamId: this.humanTeamId };
    }

    return null;
  }

  private hasActivePlayersOfType(teamType: TeamType): boolean {
    for (const player of this.players.values()) {
      if (
        player.status === PlayerStatus.ACTIVE &&
        player.team.type === teamType
      ) {
        return true;
      }
    }
    return false;
  }

  getScoreboard(): IBiohazardScoreboard {
    const baseScores = this.calculateBaseScores();

    const players = Array.from(baseScores.entries()).map(
      ([playerId, score]) => {
        const player = this.players.get(playerId);
        const isZombie = player?.team.type === TeamType.ZOMBIE;
        const isMotherZombie = this.motherZombiePlayerIds.has(playerId);
        return {
          playerId,
          troops: score.troops,
          land: score.land,
          isAlive: player?.status === PlayerStatus.ACTIVE,
          isZombie,
          isMotherZombie,
        };
      },
    );

    let humanCount = 0;
    let zombieCount = 0;
    for (const player of this.players.values()) {
      if (player.status !== PlayerStatus.ACTIVE) continue;
      if (player.team.type === TeamType.HUMAN) humanCount++;
      else if (player.team.type === TeamType.ZOMBIE) zombieCount++;
    }

    return {
      mode: this.mode,
      players,
      infectionPhase: this.infectionPhase,
      outbreakTick: this.outbreakTick,
      humanCount,
      zombieCount,
      totalTimeTicks: this.maxTicks,
    };
  }
}
