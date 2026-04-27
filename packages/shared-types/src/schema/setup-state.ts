import { ArraySchema, Schema, type } from "@colyseus/schema";
import { GameMode } from "@generals-plus/engine";

/**
 * Represents a player in the pre-match setup room.
 */
export class SetupPlayer extends Schema {
  /** Unique player identifier from auth context. */
  @type("string") id: string = "";
  /** Display name shown in setup room UI. */
  @type("string") username: string = "";
  /** Whether this player currently owns host privileges. */
  @type("boolean") isHost: boolean = false;
}

/**
 * Authoritative setup room state synchronized to all connected clients.
 */
export class SetupState extends Schema {
  /** Selected game mode for the upcoming match. */
  @type("string") gameMode: GameMode = GameMode.CLASSIC;
  /** Player id of current room host. */
  @type("string") hostId: string = "";
  /** Whether this room is visible in public listings. */
  @type("boolean") isPublic: boolean = true;
  /** Ordered list of players currently in the setup room. */
  @type([SetupPlayer]) players = new ArraySchema<SetupPlayer>();
  /** Maximum number of players allowed to join this room. */
  @type("number") maxPlayers: number = 8;
}
