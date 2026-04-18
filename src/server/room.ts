import { Room, Client } from 'colyseus';
import { BeaconPuzzleState, Player, BeaconTile } from './state.js';

const colors = ['#ff00ff', '#facc15', '#22d3ee', '#4ade80', '#fca5a5'];
// Matches the 4 hex node colors: magenta, yellow, cyan, green (+ spare)

const PUZZLES = ['cosmic_clues', 'quantum_switchboard', 'star_map', 'space_game', 'word_search'];

export class BeaconPuzzleRoom extends Room<BeaconPuzzleState> {

  onCreate (options: any) {
    this.autoDispose = false; // Persist room even when empty (no state loss on reconnect)
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

    // ── Cursor sync ────────────────────────────────────────────────────────────
    this.onMessage('cursor', (client, message: { x?: number; y?: number; z?: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        if (typeof message.x === 'number') player.x = message.x;
        if (typeof message.y === 'number') player.y = message.y;
        if (typeof message.z === 'number') player.z = message.z;
      }
    });

    // ── Legacy move / claim (kept for simulate.ts) ─────────────────────────────
    this.onMessage("move", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        if (message.x !== undefined) player.x = message.x;
        if (message.y !== undefined) player.y = message.y;
      }
    });

    this.onMessage("claim", (client, message) => {
      const tile = this.state.tiles.find(t => t.x === message.x && t.y === message.y);
      if (tile) {
        tile.ownerSessionId = client.sessionId;
      }
    });

    // ── Puzzle lifecycle ────────────────────────────────────────────────────────

    /**
     * A player clicked a puzzle node. Broadcast to ALL so every client
     * opens the same puzzle iframe simultaneously.
     */
    this.onMessage('open_puzzle', (client, message: { puzzle: string }) => {
      const puzzle = message.puzzle;
      if (!PUZZLES.includes(puzzle)) return;

      // Mark as active
      this.state.activePuzzle = puzzle;
      this.state.status = 'playing';

      // Tell everyone to open it
      this.broadcast('OPEN_PUZZLE', { puzzle }, { except: [] as Client[] });
      console.log(`[Room] Puzzle opened: ${puzzle} (by ${client.sessionId})`);
    });

    /**
     * Fired when the iframe signals PUZZLE_SOLVED.
     * Saves the result, clears activePuzzle and tells all clients to close.
     */
    this.onMessage('puzzle_solved', (client, message: { puzzle: string }) => {
      const puzzle = message.puzzle;
      if (!puzzle) return;

      // Record if not already solved
      const solved = this.state.solvedPuzzles ? this.state.solvedPuzzles.split(',').filter(Boolean) : [];
      if (!solved.includes(puzzle)) {
        solved.push(puzzle);
        this.state.solvedPuzzles = solved.join(',');
      }
      this.state.activePuzzle = "";

      // Check overall game completion
      const allSolved = PUZZLES.every(p => solved.includes(p));
      if (allSolved) {
        this.state.status = 'finished';
      }

      // Broadcast close + celebrate
      this.broadcast('CLOSE_PUZZLE', {
        puzzle,
        solvedBy: this.state.players.get(client.sessionId)?.name ?? 'A player',
        allSolved,
      });
      console.log(`[Room] Puzzle solved: ${puzzle} (by ${client.sessionId}). AllSolved=${allSolved}`);
    });

    /**
     * A single player hit "QUIT GAME" — close the puzzle only for them.
     * We keep activePuzzle set so others remain inside.
     */
    this.onMessage('puzzle_closed', (client, _message) => {
      // Nothing to persist — just ack. Client-side already removed its overlay.
      console.log(`[Room] Player ${client.sessionId} manually closed puzzle.`);
    });
  }

  onJoin (client: Client, options: any) {
    console.log(client.sessionId, "joined!");

    // If a name was provided during join, use it
    const providedName: string | undefined = options?.name;

    const newPlayer = new Player(client.sessionId);
    newPlayer.name = providedName ?? `Player ${this.state.players.size + 1}`;
    newPlayer.color = colors[this.state.players.size % colors.length];
    this.state.players.set(client.sessionId, newPlayer);

    // Tell the new joiner which puzzle (if any) is currently open,
    // so they immediately open the same iframe
    if (this.state.activePuzzle) {
      client.send('OPEN_PUZZLE', { puzzle: this.state.activePuzzle });
    }
  }

  /**
   * Allow a 30-second reconnect window before removing the player entirely.
   * Their position/name/color remain in state throughout.
   */
  async onLeave (client: Client, consented: boolean) {
    console.log(client.sessionId, "left! consented:", consented);

    // Only allow auto-reconnect for unexpected disconnects
    if (!consented) {
      try {
        // Wait up to 30 seconds for the client to reconnect
        await this.allowReconnection(client, 30);
        console.log(client.sessionId, "reconnected!");
        return; // Keep the player state as-is
      } catch (e) {
        // Reconnect timeout — remove the player
        console.log(client.sessionId, "reconnect timed out, removing.");
      }
    }

    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }
}