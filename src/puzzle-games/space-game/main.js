/**
 * main.js
 * Core Game Logic and Three.js Rendering
 */

// ==========================================
// 1. STATE MANAGEMENT (Colyseus Mock)
// ==========================================

class GameStateManager {
    constructor(initialObjects) {
        this.state = {
            score: 0,
            timer: 300, // 5 minutes in seconds
            hints: 3,
            objects: JSON.parse(JSON.stringify(initialObjects)), // Deep copy
            status: 'waiting', // waiting, playing, won, lost
        };

        this.listeners = [];
        this.timerInterval = null;
    }

    // Register a listener for state changes
    // TODO (Colyseus): Listen to room.state.onChange and room.state.objects.onChange to update UI
    subscribe(callback) {
        this.listeners.push(callback);
    }

    notify() {
        this.listeners.forEach(cb => cb(this.state));
    }

    // Intents
    dispatchIntent(action, payload) {
        if (this.state.status !== 'playing' && action !== 'START_GAME') return;

        switch (action) {
            case 'START_GAME':
                this.state.status = 'playing';
                this.startTimer();
                this.notify();
                break;

            case 'ITEM_CLICKED':
                // TODO (Colyseus): Replace with room.send('item_clicked', itemId)
                const itemId = payload;
                if (this.state.objects[itemId] && !this.state.objects[itemId].found) {
                    this.state.objects[itemId].found = true;
                    this.state.score += this.state.objects[itemId].points;
                    this.checkWinCondition();
                    this.notify();
                }
                break;

            case 'HINT_REQUESTED':
                // TODO (Colyseus): Replace with room.send('hint_requested')
                if (this.state.hints > 0) {
                    const unfoundIds = Object.keys(this.state.objects).filter(id => !this.state.objects[id].found);
                    if (unfoundIds.length > 0) {
                        this.state.hints--;
                        const randomId = unfoundIds[Math.floor(Math.random() * unfoundIds.length)];
                        // We attach the hint target to the state momentarily to let UI know
                        this.state.lastHintTarget = this.state.objects[randomId];
                        this.notify();
                        // Clear the hint target after a frame so it doesn't persist
                        this.state.lastHintTarget = null;
                    }
                }
                break;

            case 'TICK':
                if (this.state.timer > 0) {
                    this.state.timer--;
                    if (this.state.timer === 0) {
                        this.state.status = 'lost';
                        this.stopTimer();
                    }
                    this.notify();
                }
                break;
        }
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            this.dispatchIntent('TICK');
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    checkWinCondition() {
        const allFound = Object.values(this.state.objects).every(obj => obj.found);
        if (allFound) {
            this.state.status = 'won';
            this.stopTimer();
        }
    }
}

// ==========================================
// 2. AUDIO SYNTHESIS
// ==========================================

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playBeep() {
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    oscillator.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1); // Slide up

    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
}

// ==========================================
// 3. UI CONTROLLER
// ==========================================

class UIController {
    constructor() {
        this.elements = {
            timer: document.getElementById('timerDisplay'),
            score: document.getElementById('scoreDisplay'),
            hintBtn: document.getElementById('hintBtn'),
            hintCount: document.getElementById('hintCount'),
            itemsList: document.getElementById('itemsList'),
            loaderOverlay: null, // Not used in current layout
            endOverlay: document.getElementById('endOverlay'),
            endTitle: document.getElementById('endTitle'),
            endScore: document.getElementById('endScore'),
            secretKeyword: document.getElementById('secretKeyword'),
            uiContainer: document.getElementById('uiContainer'),
            uiLayer: document.body
        };

        if (!this.elements.timer) console.warn("UI elements not fully loaded");
    }

    initList(objects) {
        this.elements.itemsList.innerHTML = '';
        for (const key in objects) {
            const obj = objects[key];
            const li = document.createElement('li');
            li.className = 'item-entry';
            li.id = `ui-item-${obj.id}`;
            li.innerHTML = `
                <span class="name">${obj.name}</span>
                <span class="points">${obj.points} PT</span>
            `;
            this.elements.itemsList.appendChild(li);
        }
    }

    update(state) {
        // Update Timer
        const mins = Math.floor(state.timer / 60).toString().padStart(2, '0');
        const secs = (state.timer % 60).toString().padStart(2, '0');
        this.elements.timer.textContent = `${mins}:${secs}`;

        // Update Score
        this.elements.score.textContent = state.score;

        // Update Hints
        this.elements.hintCount.textContent = state.hints;
        this.elements.hintBtn.disabled = state.hints === 0 || state.status !== 'playing';

        // Update Object List
        for (const key in state.objects) {
            const obj = state.objects[key];
            const li = document.getElementById(`ui-item-${obj.id}`);
            if (li) {
                if (obj.found && !li.classList.contains('found')) {
                    li.classList.add('found');
                    playBeep(); // Play sound when state changes to found
                }
            }
        }

        // Handle Game Over / Win
        if (state.status === 'won' || state.status === 'lost') {
            this.elements.endOverlay.classList.remove('hidden');
            this.elements.endTitle.textContent = state.status === 'won' ? 'YOU WIN' : 'GAME OVER';
            this.elements.endTitle.style.color = state.status === 'won' ? '#00ffaa' : '#ff003c';
            this.elements.endScore.textContent = `Final Score: ${state.score}`;

            if (this.elements.secretKeyword) {
                this.elements.secretKeyword.style.display = state.status === 'won' ? 'block' : 'none';
            }

            if (state.status === 'won') {
                // Notify parent lobby
                window.parent.postMessage({ type: 'PUZZLE_SOLVED', puzzle: 'space_game' }, '*');
                window.dispatchEvent(new CustomEvent('puzzleSolved', { detail: { puzzle: 'space_game' } }));
            }

            if (this.elements.uiContainer) this.elements.uiContainer.classList.add('hidden');
        } else if (state.status === 'playing') {
            if (this.elements.loaderOverlay) this.elements.loaderOverlay.classList.add('hidden');
            if (this.elements.uiContainer) this.elements.uiContainer.classList.remove('hidden');
        }
    }
}

// ==========================================
// 4. THREE.JS SCENE MANAGER
// ==========================================

class SceneManager {
    constructor(gameStateManager) {
        this.gameStateManager = gameStateManager;
        this.scene = new THREE.Scene();

        // ZSENIÁLIS TRÜKK: Normalizált kamera (-1-től 1-ig). 
        // Így a vászon automatikusan skálázza a hitbpxokat, nem kell számolgatni!
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
        this.camera.position.z = 1;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setClearColor(0x000000, 0); // Teljesen átlátszó
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // A vásznat abszolút pozícióba tesszük, hogy rátapadjon a képre
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';

        // Beillesztjük a vásznat a kép fölé (feltételezve, hogy a képnek van konténere)
        const bgImage = document.getElementById('bg-image');
        if (bgImage && bgImage.parentElement) {
            bgImage.parentElement.style.position = 'relative'; // Fontos a fedéshez
            bgImage.parentElement.appendChild(this.renderer.domElement);
        } else {
            document.body.appendChild(this.renderer.domElement);
        }

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hitboxes = {};

        this.setupEvents();

        // Beállítjuk a kezdeti méretet a kép alapján
        setTimeout(() => this.onWindowResize(), 100);

        this.animate();
    }

    setupEvents() {
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // Kattintás érzékelése
        this.renderer.domElement.addEventListener('pointerdown', (e) => {
            const rect = this.renderer.domElement.getBoundingClientRect();

            // Kiszámoljuk az egeret a vászon méretéhez képest
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Normalizáljuk -1 és +1 közé
            this.mouse.x = (x / rect.width) * 2 - 1;
            this.mouse.y = -(y / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.scene.children);

            for (let i = 0; i < intersects.length; i++) {
                const object = intersects[i].object;
                if (object.userData && object.userData.isHitbox) {
                    this.gameStateManager.dispatchIntent('ITEM_CLICKED', object.userData.id);
                    break;
                }
            }
        });
    }

    initializeScene(objectsConfig) {
        // A normalizált sík pontosan 2 egység széles és 2 egység magas
        const planeWidth = 2;
        const planeHeight = 2;

        for (const key in objectsConfig) {
            const config = objectsConfig[key];

            const w = planeWidth * config.pctWidth;
            const h = planeHeight * config.pctHeight;

            // Pozíció a bal felső sarokból (-1, 1) számolva
            const x = -1 + (planeWidth * config.pctX) + (w / 2);
            const y = 1 - (planeHeight * config.pctY) - (h / 2);

            const hitboxGeo = new THREE.PlaneGeometry(w, h);
            const hitboxMat = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                transparent: true,
                opacity: 0.0 // TIPP: Állítsd 0.4-re ideiglenesen, ha látni akarod a zónákat!
            });

            const hitboxMesh = new THREE.Mesh(hitboxGeo, hitboxMat);
            hitboxMesh.position.set(x, y, 0);
            hitboxMesh.userData = { isHitbox: true, id: config.id };

            this.scene.add(hitboxMesh);
            this.hitboxes[config.id] = hitboxMesh;
        }

        this.gameStateManager.dispatchIntent('START_GAME');
    }

    onWindowResize() {
        const bgImage = document.getElementById('bg-image');
        if (!bgImage) return;

        // A Three.js vászon PONTOSAN felveszi a HTML kép aktuális pixelméretét
        const w = bgImage.clientWidth;
        const h = bgImage.clientHeight;

        this.renderer.setSize(w, h);

        // A kamerához nem kell nyúlni, mert a -1..1 arány miatt automatikusan nyúlik!
    }

    update(state) {
        // Dobozok eltüntetése, ha megvannak
        for (const key in state.objects) {
            if (state.objects[key].found && this.hitboxes[key]) {
                this.hitboxes[key].visible = false;
            }
        }

        // Hint karika
        if (state.lastHintTarget && state.lastHintTarget.id !== this.lastPulseTargetId) {
            this.lastPulseTargetId = state.lastHintTarget.id;
            this.createHintPulse(state.lastHintTarget);
        } else if (!state.lastHintTarget) {
            this.lastPulseTargetId = null;
        }
    }

    createHintPulse(objData) {
        const hitbox = this.hitboxes[objData.id];
        if (!hitbox) return;

        // Karika a normalizált méretekhez igazítva
        const radius = 0.05;
        const ringGeo = new THREE.RingGeometry(radius * 0.8, radius, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xff003c, transparent: true, opacity: 1, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);

        ring.position.copy(hitbox.position);
        ring.position.z = 0.1;
        this.scene.add(ring);

        if (!this.pulses) this.pulses = [];
        this.pulses.push({
            mesh: ring,
            startTime: Date.now(),
            duration: 1500
        });
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));

        if (this.pulses) {
            const now = Date.now();
            for (let i = this.pulses.length - 1; i >= 0; i--) {
                const p = this.pulses[i];
                const elapsed = now - p.startTime;
                const progress = elapsed / p.duration;

                if (progress >= 1) {
                    this.scene.remove(p.mesh);
                    this.pulses.splice(i, 1);
                } else {
                    const scale = 1 + progress * 5;
                    p.mesh.scale.set(scale, scale, 1);
                    p.mesh.material.opacity = 1 - progress;
                }
            }
        }

        this.renderer.render(this.scene, this.camera);
    }
}

// ==========================================
// 5. APPLICATION BOOTSTRAP
// ==========================================

window.addEventListener('DOMContentLoaded', () => {
    // Initialize Core Components
    const gameStateManager = new GameStateManager(hiddenObjects);
    const uiController = new UIController();
    const sceneManager = new SceneManager(gameStateManager);

    // Initial UI setup
    uiController.initList(hiddenObjects);

    // Wire up Unidirectional Data Flow
    // State -> UI & Scene
    gameStateManager.subscribe((state) => {
        uiController.update(state);
        sceneManager.update(state);
    });

    // UI -> Intents
    document.getElementById('hintBtn').addEventListener('click', () => {
        gameStateManager.dispatchIntent('HINT_REQUESTED');
    });

    document.getElementById('restartBtn').addEventListener('click', () => {
        window.parent.postMessage({ type: 'EXIT_GAME' }, '*');
        location.reload();
    });

    // Initialize scene directly (bypassing CORS local load)
    sceneManager.initializeScene(hiddenObjects);
});
