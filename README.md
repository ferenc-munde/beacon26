# beacon26

Debrecen University University Hackathon 2026. The Beacon - The Last Standing.

## Requirements

For Docker-based runs, install:

- Docker
- Docker Compose

For local development without Docker, install:

- Node.js 22+
- npm

## Run with Docker

Build the image:

```bash
docker compose build
```

Start the app:

```bash
docker compose up
```

Then open:

```text
http://localhost:3000
```

If you want to force a clean rebuild, use:

```bash
docker compose up --build --force-recreate
```

The container runs the compiled client and Colyseus server together on port `3000`.

## Deploy to Railway

This repository includes a [railway.toml](railway.toml) file, so Railway can build the app from the Dockerfile without extra manual setup.

1. Push the repository to GitHub.
2. Create a new Railway project and connect the GitHub repo.
3. Railway will detect the Dockerfile and use the config in [railway.toml](railway.toml).
4. Add any required environment variables in Railway if you introduce them later.
5. After deployment, open the Railway-generated domain.

The app listens on the Railway-provided `PORT` and exposes a `/health` endpoint for health checks.
## AI Service (FastAPI) Scaffolding

A separate AI service is scaffolded under [ai](ai) using FastAPI.

- Health endpoint: `GET /health`
- Inference endpoint: `POST /v1/infer`

Example request:

```bash
curl -X POST http://localhost:8000/v1/infer \
  -H "Content-Type: application/json" \
  -d '{"prompt":"need a hint","mode":"play"}'
```

## Run Both Services with Docker Compose

```bash
docker compose up --build
```

Services:

- Game service: `http://localhost:3000`
- AI service: `http://localhost:8000`

## Railway Monorepo Setup (2 Deployments)

Create two Railway services from the same GitHub repository:

1. `beacon26-game`
   - Root directory: repository root (`.`)
   - Uses [railway.toml](railway.toml)
2. `beacon26-ai`
   - Root directory: `ai`
   - Uses [ai/railway.toml](ai/railway.toml)

Both services have their own Dockerfile and health checks.

Recommended environment variables:

- In game service:
  - `AI_BASE_URL` set to `http://beacon26-ai.railway.internal:8080` on Railway
  - `AI_BASE_URL` set to `http://beacon26-ai:8000` for local Docker Compose
- In AI service:
  - `PORT` (Railway sets this automatically)
