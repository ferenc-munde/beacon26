import './style.css';
import { Client, Room } from 'colyseus.js';
import {
  AmbientLight,
  BufferGeometry,
  Color,
  DoubleSide,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  Vector3,
  TextureLoader,
  WebGLRenderer,
  GridHelper,
} from 'three';

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

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root not found');
}

app.innerHTML = `
  <div class="hud">
    <div>
      <p class="eyebrow">Beacon26</p>
      <h1>Shared cursor puzzle space</h1>
    </div>
    <div class="status" id="status">Connecting…</div>
  </div>
  <div class="hint">Move your mouse or touch the screen. Everyone sees the same room.</div>
`;

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

const localCursorGeometry = new SphereGeometry(0.18, 24, 24);
const localCursor = new Mesh(
  localCursorGeometry,
  new MeshStandardMaterial({ color: '#f8fafc', emissive: '#cbd5e1', emissiveIntensity: 0.4 })
);
localCursor.position.set(0, 0.2, 0);
scene.add(localCursor);

const remotes = new Map<string, RemoteCursor>();
const client = new Client(getWsEndpoint());
let room: Room | null = null;
let localX = 0;
let localY = 0;
let lastSentAt = 0;
let hasPointer = false;

void joinRoom();
void tick();

async function joinRoom(): Promise<void> {
  try {
    room = await client.joinOrCreate('beacon_puzzle');
    status!.textContent = `Connected · ${room.sessionId}`;

    room.onStateChange.once(() => {
      room.state.players.onAdd((player, sessionId) => {
        ensureRemoteCursor(sessionId, player);
      });

      room.state.players.onRemove((_player, sessionId) => {
        const remote = remotes.get(sessionId);
        if (!remote) {
          return;
        }

        scene.remove(remote.mesh);
        remote.mesh.geometry.dispose();
        (remote.mesh.material as MeshStandardMaterial).dispose();
        remote.label.remove();
        remotes.delete(sessionId);
      });

      for (const [sessionId, player] of room.state.players.entries()) {
        ensureRemoteCursor(sessionId, player);
      }
    });

    room.onLeave(() => {
      room = null;
      if (status) status.textContent = 'Disconnected. Reconnecting...';
      for (const remote of remotes.values()) {
        scene.remove(remote.mesh);
        remote.mesh.geometry.dispose();
        (remote.mesh.material as MeshStandardMaterial).dispose();
        remote.label.remove();
      }
      remotes.clear();
      window.setTimeout(joinRoom, 1000);
    });

  } catch (error) {
    if (status) {
      status.textContent = 'Reconnect pending';
    }
    console.error('Failed to join room', error);
    window.setTimeout(joinRoom, 1000);
  }
}

function getWsEndpoint(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

function ensureRemoteCursor(sessionId: string, player: any): void {
  if (!room || sessionId === room.sessionId || remotes.has(sessionId)) {
    return;
  }

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
    mesh,
    material,
    label,
    color: player.color,
    target: new Vector3(player.x, 0.2, player.z),
  };

  remotes.set(sessionId, remote);

  player.onChange(() => {
    remote.color = player.color;
    remote.target.set(player.x, 0.2, player.z);
    remote.material.color.set(player.color);
    remote.material.emissive.set(player.color);
  });
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
  if (!room || !room.connection || !room.connection.isOpen) {
    return;
  }

  const now = performance.now();
  if (now - lastSentAt < 75) {
    return;
  }

  lastSentAt = now;
  room.send('cursor', { x: localX, y: 0.2, z: localY } satisfies PlayerSnapshot);
}

function tick(): void {
  for (const remote of remotes.values()) {
    remote.mesh.position.lerp(remote.target, 0.2);

    const projected = remote.mesh.position.clone().project(camera);
    const screenX = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-projected.y * 0.5 + 0.5) * window.innerHeight;
    remote.label.style.transform = `translate(${screenX}px, ${screenY}px)`;
    remote.label.style.borderColor = remote.color;
  }

  if (!hasPointer) {
    localCursor.rotation.y += 0.01;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

window.addEventListener('pointermove', updateCursor, { passive: true });
window.addEventListener('pointerdown', updateCursor, { passive: true });
window.addEventListener('touchmove', (event) => {
  const touch = event.touches[0];
  if (!touch) {
    return;
  }

  updateCursor(new PointerEvent('pointermove', {
    clientX: touch.clientX,
    clientY: touch.clientY,
  }));
}, { passive: true });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});