import { MapSchema, Schema, type } from '@colyseus/schema';

export class PlayerState extends Schema {
  @type('string') name = 'Player';
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
  @type('string') color = '#ffffff';
}

export class BeaconState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}