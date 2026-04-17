import { Room, Client } from 'colyseus';
import { BeaconState, PlayerState } from './state.js';

const colors = ['#7dd3fc', '#fca5a5', '#fde68a', '#c4b5fd', '#86efac'];

export class BeaconRoom extends Room<BeaconState> {
  onCreate(): void {
    this.setState(new BeaconState());

    this.onMessage('cursor', (client, message: { x?: number; y?: number; z?: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) {
        return;
      }

      if (typeof message.x === 'number') player.x = message.x;
      if (typeof message.y === 'number') player.y = message.y;
      if (typeof message.z === 'number') player.z = message.z;
    });
  }

  onJoin(client: Client): void {
    const player = new PlayerState();
    player.name = `Player ${this.state.players.size + 1}`;
    player.color = colors[this.state.players.size % colors.length];
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
  }
}