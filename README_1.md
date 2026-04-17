# Beacon26

Minimal hackathon scaffold for a cooperative Three.js puzzle game with a single Colyseus + Express Node service.

## Local development

1. Install dependencies: `npm install`
1. Start the dev stack: `npm run dev`
1. Open `http://localhost:3000`

## Production build

1. Build the client and server: `npm run build`
1. Start the production server: `npm start`

## Docker

1. Build and run: `docker compose up --build`

## Notes

* The client computes the websocket URL from the current protocol and host.
* The server listens on `process.env.PORT || 3000`.
* The frontend build is served from `dist` by the same Node process.
* Static asset paths should use absolute `/assets/...` references.
