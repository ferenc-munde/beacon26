import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import http from 'node:http';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { BeaconPuzzleRoom } from './room.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In production (Docker), built client goes to dist/ (one level up from dist/server/)
const clientDist = path.resolve(__dirname, '..');

// puzzle-games folder: in production it lives at dist/puzzle-games/
// (Vite copies public/* to dist, and Express also serves it directly below)
const puzzlesDist = path.resolve(__dirname, '..', 'puzzle-games');

const port = Number(process.env.PORT || 3000);

const app = express();
const httpServer = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer
  })
});

gameServer.define('beacon_puzzle', BeaconPuzzleRoom);

// Serve puzzle mini-games under /puzzles/*
// This makes URLs like /puzzles/cosmic_clues.html, /puzzles/star_map/, etc.
app.use('/puzzles', express.static(puzzlesDist));

// Serve Vite-built client assets
app.use(express.static(clientDist));

app.get('/health', (_request, response) => {
  response.status(200).send('ok');
});

// SPA fallback — must come AFTER /puzzles static so puzzle sub-routes work
app.get('*', (_request, response) => {
  response.sendFile(path.join(clientDist, 'index.html'));
});

httpServer.listen(port, () => {
  console.log(`Beacon26 listening on port ${port}`);
});