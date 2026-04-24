import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

import { Cell } from "./cell";
import { Player } from "./player";

// Aligned with engine GameStatus enum values
export const GameStatus = {
  WAITING: "waiting",
  PLAYING: "playing",
  FINISHED: "finished",
} as const;

export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];

// Aligned with engine GameMode enum values
export const GameMode = {
  CLASSIC: "classic",
  DEMOLITION: "demolition",
  TURF_WAR: "turf_war",
  BIOHAZARD: "biohazard",
  PAYLOAD: "payload",
  RUGBY: "rugby",
  COLLAPSE: "collapse",
  DOMINATION: "domination",
  ESPIONAGE: "espionage",
} as const;

export type GameMode = (typeof GameMode)[keyof typeof GameMode];

export class MatchState extends Schema {
  @type("string") mode: GameMode = GameMode.CLASSIC;
  @type("string") status: GameStatus = GameStatus.WAITING;
  @type("number") tick: number = 0;

  @type("number") width: number = 0;
  @type("number") height: number = 0;

  @type([Cell]) grid = new ArraySchema<Cell>();
  @type({ map: Player }) players = new MapSchema<Player>();
}
