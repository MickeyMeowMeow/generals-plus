import { Client } from "@colyseus/sdk";

const ENDPOINT = "http://localhost:2567";

export const colyseusClient = new Client(ENDPOINT);
