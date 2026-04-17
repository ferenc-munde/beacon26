import { Client } from "colyseus.js";

const client = new Client("ws://localhost:3000"); // Container uses port 3000

async function runSimulation() {
  console.log("🤖 Starting Player Simulation...");
  try {
    console.log("[Simulation] Player 1 connecting...");
    const player1 = await client.joinOrCreate("beacon_puzzle");
    console.log(`[Simulation] Player 1 joined with Session ID: ${player1.sessionId}`);

    player1.onStateChange((state) => {});

    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log("\n[Simulation] Player 2 connecting...");
    const player2 = await client.joinOrCreate("beacon_puzzle");
    console.log(`[Simulation] Player 2 joined with Session ID: ${player2.sessionId}`);

    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log("\n[Simulation] Player 1 sends 'move' command...");
    player1.send("move", { x: 5, y: 5 });

    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log("[Simulation] Player 2 sends 'claim' command...");
    player2.send("claim", { x: 2, y: 2 });

    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log("\n[Simulation] Player 2 disconnecting (leaving room)...");
    player2.leave();

    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log("[Simulation] Player 1 disconnecting (leaving room)...");
    player1.leave();

    console.log("\n✅ [Simulation] Finished successfully!");
    process.exit(0);

  } catch (e) {
    console.error("Simulation failed to connect. Is the Docker container running? Details:", e);
    process.exit(1);
  }
}

runSimulation();
