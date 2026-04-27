import { entity } from "@colyseus/schema";

import { Player } from "#/schema/player";

@entity
export class ClassicPlayer extends Player {}
