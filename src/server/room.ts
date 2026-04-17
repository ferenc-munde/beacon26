import { Room, Client } from 'colyseus';
import { BeaconPuzzleState, Player, BeaconTile } from './state.js';

const colors = ['#7dd3fc', '#fca5a5', '#fde68a', '#c4b5fd', '#86efac'];

export class BeaconPuzzleRoom extends Room<BeaconPuzzleState> {

  onCreate (options: any) {
    this.setState(new BeaconPuzzleState());
    
    // Create an 8x8 basic grid dummy beacon map
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 8; y++) {
        const tile = new BeaconTile();
        tile.x = x;
        tile.y = y;
        tile.type = "land";
        this.state.tiles.push(tile);
      }
    }

    this.onMessage("move", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
         if (message.x !== undefined) player.x = message.x;
         if (message.y !== undefined) player.y = message.y;
         console.log(`Player ${client.sessionId} moved to ${player.x}, ${player.y}`);
      }
    });

    this.onMessage('cursor', (client, message: { x?: number; y?: number; z?: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
         if (typeof message.x === 'number') player.x = message.x;
         if (typeof message.y === 'number') player.y = message.y;
         if (typeof message.z === 'number') player.z = message.z;
      }
    });

    this.onMessage("claim", (client, message) => {
      const tile = this.state.tiles.find(t => t.x === message.x && t.y === message.y);
      if (tile) {
        tile.ownerSessionId = client.sessionId;
        console.log(`Player ${client.sessionId} claimed tile ${tile.x}, ${tile.y}`);
      }
    });
  }

  onJoin (client: Client, options: any) {
    console.log(client.sessionId, "joined!");
    const newPlayer = new Player(client.sessionId);
    newPlayer.name = `Player ${this.state.players.size + 1}`;
    newPlayer.color = colors[this.state.players.size % colors.length];
    this.state.players.set(client.sessionId, newPlayer);
  }

  onLeave (client: Client, consented: boolean) {
    console.log(client.sessionId, "left!");
    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }

}