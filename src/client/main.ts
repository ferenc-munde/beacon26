import './style.css';
import { Client, Room, getStateCallbacks } from 'colyseus.js';
import {
  AmbientLight,
  Color,
  CylinderGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  SphereGeometry,
  Vector3,
  TextureLoader,
  WebGLRenderer,
  GridHelper,
  Raycaster,
  Vector2,
} from 'three';

// ─── Types ───────────────────────────────────────────────────────────────────

type RemoteCursor = {
  mesh: Mesh;
  material: MeshStandardMaterial;
  label: HTMLDivElement;
  color: string;
  target: Vector3;
};

type PlayerSnapshot = {
  x: number;
  y: number;
  z: number;
  color: string;
};

// ─── Puzzle configuration ─────────────────────────────────────────────────────
const PUZZLES: Array<{ id: string; label: string; color: string; pos: [number, number, number] }> = [
  { id: 'cosmic_clues',        label: 'Terminal Zero',        color: '#ff00ff', pos: [-4.5,  0.2, -1.5] },
  { id: 'quantum_switchboard', label: 'Quantum Switchboard',  color: '#facc15', pos: [-2.5,  0.2,  1.0] },
  { id: 'star_map',            label: 'Star Map Protocol',    color: '#22d3ee', pos: [ 3.5,  0.2, -1.5] },
  { id: 'space_game',          label: 'Space Game',           color: '#4ade80', pos: [ 4.5,  0.2,  1.2] },
  { id: 'word_search',         label: 'Word Search',          color: '#fb923c', pos: [ 0.5,  0.2, -3.0] },
];

const PUZZLE_URLS: Record<string, string> = {
  cosmic_clues:        '/puzzles/cosmic_clues.html',
  quantum_switchboard: '/puzzles/quantum-switchboard.html',
  star_map:            '/puzzles/star_map/',
  space_game:          '/puzzles/space-game/',
  word_search:         '/puzzles/word_search.html',
};

// ─── DOM Bootstrap ────────────────────────────────────────────────────────────

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root not found');

app.innerHTML = `
  <div class="hud">
    <div>
      <p class="eyebrow">Beacon26</p>
      <h1>Shared cursor puzzle space</h1>
    </div>
    <div class="status" id="status">Connecting…</div>
  </div>
  <div class="hint">Move your mouse or touch the screen. Click on colored nodes to enter puzzles.</div>
  <div id="activity-log"></div>

  <!-- Intro video overlay (shown before each puzzle starts) -->
  <div id="intro-overlay" class="intro-overlay hidden">
    <div class="intro-content">
      <div class="intro-badge">MISSION BRIEFING</div>
      <div id="intro-puzzle-name" class="intro-puzzle-name"></div>
      <div class="intro-video-wrap">
        <video id="intro-video" class="intro-video" playsinline>
          <source src="/video/intro%20video.mp4" type="video/mp4">
        </video>
        <div class="intro-progress-bar"><div id="intro-progress-fill" class="intro-progress-fill"></div></div>
      </div>
      <div class="intro-actions">
        <button id="intro-skip-btn" class="intro-skip-btn">SKIP INTRO ↵</button>
      </div>
    </div>
  </div>

  <!-- Full-screen puzzle overlay (hidden by default) -->
  <div id="puzzle-overlay" class="puzzle-overlay hidden">
    <div class="puzzle-overlay-header">
      <span id="puzzle-overlay-title">Puzzle</span>
      <button id="quit-btn" class="quit-btn">✕ QUIT GAME</button>
    </div>
    <iframe id="puzzle-iframe" class="puzzle-iframe" src="" allow="autoplay"></iframe>
    <div id="solve-toast" class="solve-toast hidden"></div>
  </div>
`;

// ─── Scene ────────────────────────────────────────────────────────────────────

const status = document.querySelector<HTMLElement>('#status');
const renderer = new WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.className = 'scene';
app.appendChild(renderer.domElement);

const scene = new Scene();
scene.background = new Color('#07111f');

const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 6.5, 10);
camera.lookAt(0, 0, 0);

scene.add(new AmbientLight('#ffffff', 1.1));

const plane = new Mesh(
  new PlaneGeometry(24, 24),
  new MeshStandardMaterial({ color: '#0f172a', roughness: 1, metalness: 0 })
);
plane.rotation.x = -Math.PI / 2;
scene.add(plane);

scene.add(new GridHelper(24, 24, '#18304d', '#0f2238'));

const beaconTexture = new TextureLoader().load('/assets/beacon.svg');
const beacon = new Mesh(
  new PlaneGeometry(2.4, 2.4),
  new MeshBasicMaterial({ map: beaconTexture, transparent: true, side: DoubleSide })
);
beacon.position.set(0, 2.8, -3.5);
scene.add(beacon);

const localCursor = new Mesh(
  new SphereGeometry(0.18, 24, 24),
  new MeshStandardMaterial({ color: '#f8fafc', emissive: '#cbd5e1', emissiveIntensity: 0.4 })
);
localCursor.position.set(0, 0.2, 0);
scene.add(localCursor);

const hexMeshes: Array<{ mesh: Mesh; puzzle: typeof PUZZLES[0]; glowLight: PointLight }> = [];

PUZZLES.forEach(p => {
  const geo = new CylinderGeometry(0.55, 0.55, 0.12, 6);
  const mat = new MeshStandardMaterial({
    color: p.color,
    emissive: p.color,
    emissiveIntensity: 0.6,
    roughness: 0.3,
    metalness: 0.4,
  });
  const mesh = new Mesh(geo, mat);
  mesh.position.set(...p.pos);
  mesh.rotation.y = Math.PI / 6;
  mesh.userData = { puzzleId: p.id };
  scene.add(mesh);

  const light = new PointLight(p.color, 1.2, 3);
  light.position.set(p.pos[0], p.pos[1] - 0.1, p.pos[2]);
  scene.add(light);

  hexMeshes.push({ mesh, puzzle: p, glowLight: light });
});

const raycaster = new Raycaster();
const mouse2d = new Vector2();

// ─── Intro overlay ───────────────────────────────────────────────────────────

const introOverlay  = document.querySelector<HTMLDivElement>('#intro-overlay')!;
const introVideo    = document.querySelector<HTMLVideoElement>('#intro-video')!;
const introSkipBtn  = document.querySelector<HTMLButtonElement>('#intro-skip-btn')!;
const introPuzzleName = document.querySelector<HTMLDivElement>('#intro-puzzle-name')!;
const introProgressFill = document.querySelector<HTMLDivElement>('#intro-progress-fill')!;

let pendingPuzzleId: string | null = null;
let introAnimFrame: number | null = null;

function showIntroOverlay(puzzleId: string): void {
  const p = PUZZLES.find(x => x.id === puzzleId);
  if (!p) return;

  pendingPuzzleId = puzzleId;
  introPuzzleName.textContent = p.label;
  introOverlay.classList.remove('hidden');
  introProgressFill.style.width = '0%';

  introVideo.currentTime = 0;
  introVideo.play().catch(() => { /* autoplay blocked — still show overlay */ });

  function tickProgress() {
    if (!introVideo.duration) { introAnimFrame = requestAnimationFrame(tickProgress); return; }
    const pct = (introVideo.currentTime / introVideo.duration) * 100;
    introProgressFill.style.width = `${pct}%`;
    introAnimFrame = requestAnimationFrame(tickProgress);
  }
  introAnimFrame = requestAnimationFrame(tickProgress);
}

function dismissIntroAndLaunch(): void {
  if (introAnimFrame !== null) { cancelAnimationFrame(introAnimFrame); introAnimFrame = null; }
  introVideo.pause();
  introOverlay.classList.add('hidden');

  if (pendingPuzzleId && room?.connection?.isOpen) {
    room.send('open_puzzle', { puzzle: pendingPuzzleId });
  }
  pendingPuzzleId = null;
}

introVideo.addEventListener('ended', dismissIntroAndLaunch);
introSkipBtn.addEventListener('click', dismissIntroAndLaunch);

// ─── Puzzle click ─────────────────────────────────────────────────────────────

function onPointerClick(event: PointerEvent) {
  if (!isPuzzleOverlayHidden()) return;
  if (introOverlay && !introOverlay.classList.contains('hidden')) return;
  if (!room || !room.connection?.isOpen) return;

  mouse2d.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse2d.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse2d, camera);

  const hits = raycaster.intersectObjects(hexMeshes.map(h => h.mesh));
  if (hits.length > 0) {
    const puzzleId = hits[0].object.userData.puzzleId as string;
    showIntroOverlay(puzzleId);
  }
}

window.addEventListener('pointerdown', onPointerClick);

const remotes = new Map<string, RemoteCursor>();

function ensureRemoteCursor(sessionId: string, player: any): void {
  if (!room || sessionId === room.sessionId || remotes.has(sessionId)) return;

  const mesh = new Mesh(
    new SphereGeometry(0.18, 24, 24),
    new MeshStandardMaterial({ color: player.color, emissive: player.color, emissiveIntensity: 0.2 })
  );
  mesh.position.set(player.x, 0.2, player.z);
  scene.add(mesh);

  const material = mesh.material as MeshStandardMaterial;
  const label = document.createElement('div');
  label.className = 'cursor-label';
  label.textContent = player.name;
  app.appendChild(label);

  const remote: RemoteCursor = {
    mesh, material, label,
    color: player.color,
    target: new Vector3(player.x, 0.2, player.z),
  };
  remotes.set(sessionId, remote);

  if ($room) {
    $room(player).onChange(() => {
      remote.color = player.color;
      remote.target.set(player.x, 0.2, player.z);
      remote.material.color.set(player.color);
      remote.material.emissive.set(player.color);
    });
  }
}

const activityLog = document.querySelector<HTMLDivElement>('#activity-log')!;

function logActivity(text: string, type: 'join' | 'leave' | 'info' | 'solve' = 'info') {
  const entry = document.createElement('div');
  entry.className = `activity-entry activity-${type}`;
  entry.textContent = text;
  activityLog.prepend(entry);
  while (activityLog.children.length > 8) {
    activityLog.removeChild(activityLog.lastChild!);
  }
  setTimeout(() => entry.classList.add('faded'), 6000);
}

const overlay   = document.querySelector<HTMLDivElement>('#puzzle-overlay')!;
const iframe    = document.querySelector<HTMLIFrameElement>('#puzzle-iframe')!;
const quitBtn   = document.querySelector<HTMLButtonElement>('#quit-btn')!;
const toastEl   = document.querySelector<HTMLDivElement>('#solve-toast')!;
const titleEl   = document.querySelector<HTMLSpanElement>('#puzzle-overlay-title')!;

function isPuzzleOverlayHidden() {
  return overlay.classList.contains('hidden');
}

function openPuzzleOverlay(puzzleId: string) {
  const p = PUZZLES.find(x => x.id === puzzleId);
  if (!p) return;
  titleEl.textContent = p.label;
  iframe.src = PUZZLE_URLS[puzzleId] || '';
  overlay.classList.remove('hidden');
  logActivity(`[ PUZZLE ] ${p.label} opened`, 'info');
}

function closePuzzleOverlay() {
  overlay.classList.add('hidden');
  iframe.src = '';
  toastEl.classList.add('hidden');
  toastEl.textContent = '';
}

function showSolveToast(text: string) {
  toastEl.textContent = text;
  toastEl.classList.remove('hidden');
  setTimeout(() => {
    closePuzzleOverlay();
  }, 4000);
}

quitBtn.addEventListener('click', () => {
  if (room?.connection?.isOpen) {
    room.send('puzzle_closed', {});
  }
  closePuzzleOverlay();
});

window.addEventListener('message', (event: MessageEvent) => {
  if (!event.data || typeof event.data !== 'object') return;
  const { type, puzzle } = event.data;
  if (type === 'PUZZLE_SOLVED' && puzzle) {
    if (room?.connection?.isOpen) {
      room.send('puzzle_solved', { puzzle });
    }
  }
  if (type === 'EXIT_GAME') {
    if (room?.connection?.isOpen) {
      room.send('puzzle_closed', {});
    }
    closePuzzleOverlay();
  }
});

// ─── Colyseus Connection ──────────────────────────────────────────────────────

const client = new Client(getWsEndpoint());
let room: Room | null = null;
let $room: ReturnType<typeof getStateCallbacks> | null = null;
let localX = 0;
let localY = 0;
let lastSentAt = 0;
let hasPointer = false;

void joinRoom();
void tick();

async function joinRoom(): Promise<void> {
  try {
    const params = new URLSearchParams(window.location.search);
    const requestedRoomId = params.get('room');
    const name = sessionStorage.getItem('playerName') || `Player ${Math.floor(Math.random() * 1000)}`;
    
    if (requestedRoomId) {
      console.log(`[Lobby] Attempting to join session: ${requestedRoomId}`);
      try {
        room = await client.joinById(requestedRoomId, { name });
      } catch (joinErr) {
        // Invalid or expired room — fall back to creating a fresh session
        console.warn(`[Lobby] Session "${requestedRoomId}" not found or expired. Creating new session.`);
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('room');
        window.history.replaceState({}, '', cleanUrl.toString());
        if (status) status.textContent = 'Session not found — starting new room…';
        room = await client.create('beacon_puzzle', { name });
      }
    } else {
      console.log(`[Lobby] Creating new session...`);
      room = await client.create('beacon_puzzle', { name });
    }

    // Capture the join/create ID for display and URL sync
    // In Colyseus 0.16+, the public room ID is room.roomId
    $room = getStateCallbacks(room);
    const actualRoomId = room.roomId;
    console.log(`[Lobby] Successfully joined/created session: ${actualRoomId}`);

    // Update URL with the actual room ID for easy sharing
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('room', actualRoomId);
    window.history.replaceState({}, '', newUrl.toString());

    // Update status and session overlay
    status!.textContent = `Connected · ${room.sessionId.slice(0, 8)}`;
    updateSessionUI(actualRoomId);

    room.onMessage('OPEN_PUZZLE', (data: { puzzle: string }) => {
      openPuzzleOverlay(data.puzzle);
    });

    room.onMessage('CLOSE_PUZZLE', (data: { puzzle: string; solvedBy: string; allSolved: boolean }) => {
      const p = PUZZLES.find(x => x.id === data.puzzle);
      const label = p?.label ?? data.puzzle;
      logActivity(`[ ✓ SOLVED ] ${label} by ${data.solvedBy}`, 'solve');
      if (data.allSolved) {
        showSolveToast(`🎉 All puzzles solved! Mission complete!`);
      } else {
        showSolveToast(`✓ ${label} solved by ${data.solvedBy}!`);
      }
    });

    // In Colyseus 0.16+, use the getStateCallbacks proxy for schema listeners.
    // onAdd fires immediately for pre-existing players AND for future joins.
    let initialSyncDone = false;
    $room!(room.state).players.onAdd((player: any, sessionId: string) => {
      ensureRemoteCursor(sessionId, player);
      // Only log join messages for players who arrive AFTER the initial state sync
      if (sessionId !== room!.sessionId && initialSyncDone) {
        logActivity(`[+] ${player.name} joined`, 'join');
      }
    });
    $room!(room.state).players.onRemove((_player: any, sessionId: string) => {
      const remote = remotes.get(sessionId);
      if (remote) {
        logActivity(`[-] ${remote.label.textContent} disconnected`, 'leave');
        scene.remove(remote.mesh);
        remote.mesh.geometry.dispose();
        (remote.mesh.material as MeshStandardMaterial).dispose();
        remote.label.remove();
        remotes.delete(sessionId);
      }
    });
    // Mark initial sync done after the first state is received
    room.onStateChange(() => {
      if (!initialSyncDone) initialSyncDone = true;
    });

    room.onLeave(() => {
      room = null;
      $room = null;
      if (status) status.textContent = 'Disconnected. Reconnecting…';
      for (const remote of remotes.values()) {
        scene.remove(remote.mesh);
        remote.mesh.geometry.dispose();
        (remote.mesh.material as MeshStandardMaterial).dispose();
        remote.label.remove();
      }
      remotes.clear();
      window.setTimeout(joinRoom, 2000);
    });

  } catch (error) {
    if (status) status.textContent = 'Reconnect pending…';
    console.error('Failed to join room', error);
    window.setTimeout(joinRoom, 2000);
  }
}

// ─── Cursor sync ──────────────────────────────────────────────────────────────

function getWsEndpoint(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

function updateCursor(event: PointerEvent): void {
  hasPointer = true;
  const x = (event.clientX / window.innerWidth) * 2 - 1;
  const y = -(event.clientY / window.innerHeight) * 2 + 1;
  localX = x * 8;
  localY = y * 4.5;
  localCursor.position.set(localX, 0.2, localY);
  syncCursor();
}

function syncCursor(): void {
  if (!room || !room.connection || !room.connection.isOpen) return;
  const now = performance.now();
  if (now - lastSentAt < 75) return;
  lastSentAt = now;
  room.send('cursor', { x: localX, y: 0.2, z: localY });
}

function tick(): void {
  const t = Date.now() * 0.001;
  for (const remote of remotes.values()) {
    remote.mesh.position.lerp(remote.target, 0.2);
    const projected = remote.mesh.position.clone().project(camera);
    const screenX = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-projected.y * 0.5 + 0.5) * window.innerHeight;
    remote.label.style.transform = `translate(${screenX}px, ${screenY}px)`;
    remote.label.style.borderColor = remote.color;
  }
  hexMeshes.forEach(({ mesh, puzzle, glowLight }, i) => {
    mesh.position.y = 0.2 + Math.sin(t * 1.2 + i * 1.3) * 0.06;
    const intensity = 0.6 + Math.sin(t * 2.0 + i * 0.9) * 0.3;
    (mesh.material as MeshStandardMaterial).emissiveIntensity = intensity;
    glowLight.intensity = 0.8 + Math.sin(t * 2.0 + i * 0.9) * 0.5;
  });
  if (!hasPointer) localCursor.rotation.y += 0.01;
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

window.addEventListener('pointermove', updateCursor, { passive: true });
window.addEventListener('touchmove', (event) => {
  const touch = event.touches[0];
  if (!touch) return;
  updateCursor(new PointerEvent('pointermove', { clientX: touch.clientX, clientY: touch.clientY }));
}, { passive: true });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Session UI ───────────────────────────────────────────────────────────────

function updateSessionUI(roomId: string) {
  console.log(`[UI] Updating session display with ID: ${roomId}`);
  const display = document.getElementById('session-id-display');
  const copyBtn = document.getElementById('copy-session-btn');
  
  if (display) {
    display.textContent = roomId || "UNKNOWN";
  }
  
  if (copyBtn) {
    copyBtn.onclick = () => {
      if (!roomId) return;
      navigator.clipboard.writeText(roomId).then(() => {
        copyBtn.classList.add('success');
        const labelEl = copyBtn.querySelector<HTMLSpanElement>('.copy-label');
        if (labelEl) labelEl.textContent = 'COPIED!';
        const originalTitle = copyBtn.getAttribute('title');
        copyBtn.setAttribute('title', 'Copied!');
        setTimeout(() => {
          copyBtn.classList.remove('success');
          if (labelEl) labelEl.textContent = 'COPY';
          copyBtn.setAttribute('title', originalTitle || 'Copy invite link');
        }, 2000);
      });
    };
  }
}
