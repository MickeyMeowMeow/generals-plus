import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import cors from "cors";

import { MatchRoom } from "#features/match/match-room.js";

const port = Number(process.env.PORT) || 3000;

const transport = new WebSocketTransport();
transport.getExpressApp().use(cors());

const server = new Server({ transport });
server.define("match", MatchRoom);

server.listen(port).then(() => {
  console.log(`Server listening on port ${port}`);
});
