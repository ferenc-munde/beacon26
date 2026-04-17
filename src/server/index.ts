import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import http from 'node:http';
import { Server } from 'colyseus';
import { BeaconRoom } from './room.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 3000);

const app = express();
const httpServer = http.createServer(app);
const gameServer = new Server({ server: httpServer });

gameServer.define('lobby', BeaconRoom);

app.use(express.static(clientDist));

app.get('*', (_request, response) => {
  response.sendFile(path.join(clientDist, 'index.html'));
});

httpServer.listen(port, () => {
  // Keep the startup log short for Railway and local Docker.
  console.log(`Beacon26 listening on port ${port}`);
});