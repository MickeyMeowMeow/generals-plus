import type { Client } from "@colyseus/core";
import { Room } from "@colyseus/core";
import type {
  JoinOptions,
  RoomData,
  RoomUser,
} from "@generals-plus/room-types";

export class MatchRoom extends Room<{
  metadata: RoomData;
}> {
  maxClients = 2;
  private users: RoomUser[] = [];

  async onCreate(_options: unknown) {
    this.users = this.metadata.players;
    console.log(
      "[MatchRoom] Room: ",
      this.roomId,
      " created with metadata: ",
      this.metadata,
    );
    // this.setState(new MatchState());
  }
  onAuth(_client: Client, options: JoinOptions) {
    const username = options.username;
    if (!username || typeof username !== "string" || username.trim() === "") {
      console.log(`[MatchRoom] Invalid username: ${username}`);
      return false;
    }
    const userdata = this.users.find(
      (user) => user.username === username && user.token === options.token,
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
