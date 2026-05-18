import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

/**
 * Public player metadata embedded in every scoreboard row.
 *
 * The HUD intentionally renders scoreboard data without consulting match player
 * maps, so rows carry the identity, team, and color fields needed for display.
 */
export class BaseScoreboardPlayerEntry extends Schema {
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
export class TurfWarScoreboard extends TroopLandScoreboard {
  @type([TurfWarScoreboardTeamEntry]) teams =
    new ArraySchema<TurfWarScoreboardTeamEntry>();
}

/**
 * Domination scoreboard with per-player troop/land rows and team scores.
 */
export class DominationScoreboard extends TroopLandScoreboard {
  @type({ map: "number" }) teamScores = new MapSchema<number>();
}
