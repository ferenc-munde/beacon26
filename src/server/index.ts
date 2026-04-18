import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import http from 'node:http';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { BeaconPuzzleRoom } from './room.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 3000);

const app = express();
const httpServer = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer
  })
});

gameServer.define('beacon_puzzle', BeaconPuzzleRoom);

app.use(express.static(clientDist));

app.get('/health', (_request, response) => {
  response.status(200).send('ok');
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

httpServer.listen(port, () => {
  // Keep the startup log short for Railway and local Docker.
  console.log(`Beacon26 listening on port ${port}`);
});