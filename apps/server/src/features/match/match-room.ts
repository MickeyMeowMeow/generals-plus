import type { Client } from "@colyseus/core";
import { Room } from "@colyseus/core";
import type { RoomData, RoomUser } from "@generals-plus/room-types";
import { parseJoinOptions } from "@generals-plus/room-types";

export class MatchRoom extends Room {
  maxClients = 2;
  private users: RoomUser[] = [];

  async onCreate(_options: { metadata: RoomData }) {
    this.users = _options.metadata.players ?? [];
    if (this.users.length === 0) {
      console.warn(
        "[MatchRoom] No players provided in room metadata. Room will be empty.",
      );
    }
    console.log(
      "[MatchRoom] Room: ",
      this.roomId,
      " created with metadata: ",
      _options.metadata,
    );
    // TODO: define and implement MatchState schema
    // this.setState(new MatchState());
  }
  onAuth(_client: Client, options: unknown) {
    const joinOptions = parseJoinOptions(options);
    if (!joinOptions) {
      console.log("[MatchRoom] Invalid join payload");
      return false;
    }

    const { username, token } = joinOptions;
    const userdata = this.users.find(
      (user) => user.username === username && user.token === token,
    );
    if (!userdata) {
      console.log(`[MatchRoom] Username not in user list: ${username}`);
      return false;
    }
    return userdata;
  }
  onJoin(client: Client, _options: unknown) {
    console.log(`[MatchRoom] ${client.sessionId} joined`);
    const userdata = client.auth;
    if (userdata) {
      console.log(`[MatchRoom] User Joined: ${userdata.username}`);
    } else {
      console.log(
        `[MatchRoom] Joining user not found in room data: ${client.sessionId}`,
      );
    }
    // use userdata to initialize player schema if needed
  }

  onLeave(client: Client, _code?: number) {
    // handle player leaving the room, cleanup, etc.
    console.log(`[MatchRoom] ${client.sessionId} left`);
  }

  onDispose() {
    // cleanup resources, save state, etc.
    console.log("[MatchRoom] Room disposed");
  }
}
