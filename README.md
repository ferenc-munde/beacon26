# beacon26

Debrecen University University Hackathon 2026. The Beacon - The Last Standing.

## Requirements

For Docker-based runs, install:

- Docker
- Docker Compose

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