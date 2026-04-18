# beacon26

Debrecen University University Hackathon 2026. The Beacon - The Last Standing.

🚀 Beacon 26
🌌 Overview
Project Beacon is a web-based multiplayer cooperative escape room set aboard a spaceship drifting through deep space.

Players join the same session online, explore a shared 3D environment, interact with objects, and solve puzzles together in real time to progress through the game.

🧠 Concept
The game focuses on:

Simple, intuitive gameplay

Real-time collaboration

Interactive 3D exploration

Progressive puzzle-solving

Players must communicate and think together to unlock new areas and uncover the path forward.

👥 Multiplayer Features
Real-time cooperative gameplay

See other players in the environment

Unique player names with color distinction

Live movement synchronization

Visible cursor positions

Shared puzzle interactions

🎮 Gameplay Mechanics
🌍 Exploration
Navigate a 3D spaceship environment

Look around freely in-browser

Clickable interactive elements (doors, objects, panels)

🖱️ Interactions
Active items are visually highlighted (hover or always visible)

Clicking objects triggers actions or opens puzzles

Example: Clicking a door moves players to the next room

🧩 Puzzle System
Image-based puzzles (drag-and-arrange pieces)

Multiplayer puzzle solving (multiple users at once)

Puzzle pop-ups showing active participants

🔓 Progression Logic
Some puzzles require others to be completed first

Hidden puzzles unlock after prerequisites

Solutions can carry over into future puzzles

 Example Puzzles
⭐ Star Map Puzzle
Analyze a star map and travel logs

Travel paths create intersecting lines

The correct system lies within the triangle formed

🔮 Oracle System
AI-powered hint system

Helps players when stuck

🎵 Audio
Background music

Toggle on/off option

🛠️ Tech Stack
Frontend: Three.js (3D rendering in browser)

Backend: Colyseus (real-time multiplayer server)

Containerization: Docker

Deployment: Railway

🏗️ Architecture
Client handles rendering and user interaction

Server synchronizes:

Player positions

Actions

Puzzle states

Real-time updates ensure all players share the same game state

🚀 Getting Started
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