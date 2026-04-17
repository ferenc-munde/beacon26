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