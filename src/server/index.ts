import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import http from 'node:http';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { BeaconPuzzleRoom } from './room.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In production (Docker), built files live in dist/ (one level up from dist/server/)
const clientDist = path.resolve(__dirname, '..');
const puzzlesDist = path.resolve(__dirname, '..', 'puzzle-games');

const port = Number(process.env.PORT || 3000);

const app = express();
const httpServer = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer })
});

gameServer.define('beacon_puzzle', BeaconPuzzleRoom);

// ── Puzzle mini-games at /puzzles/* ──────────────────────────────────────────
app.use('/puzzles', express.static(puzzlesDist));

// ── Static assets (JS, CSS, images from Vite build) ─────────────────────────
app.use(express.static(clientDist));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.status(200).send('ok'));

// ── Game lobby (3D space) — served at /game ──────────────────────────────────
// Vite builds game.html → dist/game.html
app.get('/game', (_req, res) => {
  res.sendFile(path.join(clientDist, 'game.html'));
});


// Test endpoint to check if we can reach the AI service
app.get('/api/test-ai', async (_request, response) => {
  const aiBaseUrl = process.env.AI_BASE_URL || 'http://beacon26-ai.railway.internal:8080';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const result = await fetch(`${aiBaseUrl}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    const text = await result.text();

    response.status(200).json({
      success: true,
      aiBaseUrl,
      aiStatus: result.status,
      aiResponse: text
    });
  } catch (error) {
    response.status(503).json({
      success: false,
      aiBaseUrl,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get('*', (_request, response) => {
  response.sendFile(path.join(clientDist, 'index.html'));
});

// ── Landing page at / ────────────────────────────────────────────────────────
// Vite builds index.html → dist/index.html (first, default)
app.get('/', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// ── SPA fallback for any other routes ────────────────────────────────────────
// (puzzle sub-routes like /puzzles/star_map/ are handled above)
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

httpServer.listen(port, () => {
  console.log(`Beacon26 listening on port ${port}`);
});