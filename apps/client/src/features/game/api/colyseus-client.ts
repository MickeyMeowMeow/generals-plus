import { Client } from "@colyseus/sdk";

import { resolveColyseusEndpoint } from "#/infra/colyseus/connection";

export const colyseusClient = new Client(resolveColyseusEndpoint());
