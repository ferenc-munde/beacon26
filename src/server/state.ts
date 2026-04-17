import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") sessionId: string;
  @type("string") name: string = "Player";
  @type("string") color: string = "#ffffff";
  @type("number") x: number;
  @type("number") y: number;
  @type("number") z: number;

  constructor(sessionId: string) {
    super();
    this.sessionId = sessionId;
    this.x = 0;
    this.y = 0;
    this.z = 0;
  }
}

export class BeaconTile extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("string") type: string = "land";
  @type("string") ownerSessionId: string = "";
}

export class BeaconPuzzleState extends Schema {
  @type("string") status: string = "waiting";
  @type({ map: Player }) players = new MapSchema<Player>();
  @type([ BeaconTile ]) tiles = new ArraySchema<BeaconTile>();
}