import { ArraySchema, Schema, type } from "@colyseus/schema";

/**
 * Public player metadata embedded in every scoreboard row.
 *
 * The HUD intentionally renders scoreboard data without consulting match player
 * maps, so rows carry the identity, team, and color fields needed for display.
 */
export abstract class BaseScoreboardPlayerEntry extends Schema {
  @type("string") playerId: string = "";
  @type("string") teamId: string = "";
  @type("string") displayName: string = "";
  @type("number") color: number = 0;
}

/**
 * Common per-player metrics for modes scored by land and soldiers.
 */
export class TroopLandScoreboardPlayerEntry extends BaseScoreboardPlayerEntry {
  @type("number") troops: number = 0;
  @type("number") land: number = 0;
}

/**
 * Classic mode row, including whether the player's general is still alive.
 */
export class ClassicScoreboardPlayerEntry extends TroopLandScoreboardPlayerEntry {
  @type("boolean") isAlive: boolean = false;
}

export class TurfWarScoreboardPlayerEntry extends TroopLandScoreboardPlayerEntry {
  @type("boolean") isAlive: boolean = false;
}

/**
 * Base schema for all scoreboard variants sent through match state.
 */
export abstract class BaseScoreboard extends Schema {
  @type("string") mode: string = "";
}

/**
 * Classic scoreboard schema with classic-specific player rows.
 */
export class ClassicScoreboard extends BaseScoreboard {
  @type([ClassicScoreboardPlayerEntry]) players =
    new ArraySchema<ClassicScoreboardPlayerEntry>();
}

/**
 * Generic troop/land scoreboard for modes without extra scoring fields.
 */
export class TroopLandScoreboard extends BaseScoreboard {
  @type([TroopLandScoreboardPlayerEntry]) players =
    new ArraySchema<TroopLandScoreboardPlayerEntry>();
}

/**
 * Turf War team aggregate used for territory percentage display.
 */
export class TurfWarScoreboardTeamEntry extends Schema {
  @type("string") teamId: string = "";
  @type(["string"]) playerIds = new ArraySchema<string>();
  @type("number") landPercent: number = 0;
}

/**
 * Turf War scoreboard with per-player troop/land rows and team territory data.
 */
export class TurfWarScoreboard extends BaseScoreboard {
  @type([TurfWarScoreboardPlayerEntry]) players =
    new ArraySchema<TurfWarScoreboardPlayerEntry>();
  @type([TurfWarScoreboardTeamEntry]) teams =
    new ArraySchema<TurfWarScoreboardTeamEntry>();
}

/**
 * Domination mode player row, including troops, land, and alive status.
 */
export class DominationScoreboardPlayerEntry extends TroopLandScoreboardPlayerEntry {
  @type("boolean") isAlive: boolean = false;
}

/**
 * Domination team aggregate used for team score display.
 */
export class DominationScoreboardTeamEntry extends Schema {
  @type("string") teamId: string = "";
  @type(["string"]) playerIds = new ArraySchema<string>();
  @type("number") score: number = 0;
}

/**
 * Domination scoreboard with per-player troop/land/isAlive rows and team score data.
 */
export class DominationScoreboard extends BaseScoreboard {
  @type([DominationScoreboardPlayerEntry]) players =
    new ArraySchema<DominationScoreboardPlayerEntry>();
  @type([DominationScoreboardTeamEntry]) teams =
    new ArraySchema<DominationScoreboardTeamEntry>();
}

export class DemolitionScoreboardPlayerEntry extends TroopLandScoreboardPlayerEntry {
  @type("boolean") isAlive: boolean = false;
}

export class DemolitionScoreboardTeamEntry extends Schema {
  @type("string") teamId: string = "";
  @type(["string"]) playerIds = new ArraySchema<string>();
}

export class DemolitionScoreboard extends BaseScoreboard {
  @type([DemolitionScoreboardPlayerEntry]) players =
    new ArraySchema<DemolitionScoreboardPlayerEntry>();
  @type([DemolitionScoreboardTeamEntry]) teams =
    new ArraySchema<DemolitionScoreboardTeamEntry>();

  @type("number") bombSiteCount: number = 2;
  @type("string") plantedAtSite: string = ""; // "A", "B", etc., or ""
  @type("number") detonationTick: number = -1; // -1 if not planted
  @type("number") plantProgressTicks: number = 0;
  @type("number") defuseProgressTicks: number = 0;
  @type("string") defuserId: string = ""; // player defusing, or ""
  @type("boolean") isPlanted: boolean = false;
  @type("boolean") isDefused: boolean = false;
  @type("number") plantDuration: number = 3;
  @type("number") defuseDuration: number = 5;
  @type("number") detonateDuration: number = 45;
}
