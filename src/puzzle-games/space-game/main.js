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
            loaderOverlay: document.getElementById('loaderOverlay'),
            endOverlay: document.getElementById('endOverlay'),
            endTitle: document.getElementById('endTitle'),
            endScore: document.getElementById('endScore'),
            secretKeyword: document.getElementById('secretKeyword'),
            uiContainer: document.getElementById('uiContainer'),
            uiLayer: document.body // For hint pulses
        };
        
        // Ensure UI elements exist before continuing (skip in case of errors)
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
        
        // Orthographic Camera for 2D mapping
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 100);
        this.camera.position.z = 1;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setClearColor(0x000000, 0); // Transparent background
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        document.body.insertBefore(this.renderer.domElement, document.body.firstChild);

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.hitboxes = {}; // Store hitboxes to update their state
        
        this.setupEvents();
        this.animate();
    }

    setupEvents() {
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Raycasting click event
        this.renderer.domElement.addEventListener('pointerdown', (e) => {
            // Calculate mouse position in normalized device coordinates (-1 to +1)
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.scene.children);

            for (let i = 0; i < intersects.length; i++) {
                const object = intersects[i].object;
                if (object.userData && object.userData.isHitbox) {
                    // Dispatch intent to GameStateManager instead of mutating locally
                    this.gameStateManager.dispatchIntent('ITEM_CLICKED', object.userData.id);
                    break; // Only click top-most or first valid
                }
            }
        });
    }

    initializeScene(objectsConfig) {
        // Calculate hitbox positions
        const planeWidth = 2 * this.camera.right;
        const planeHeight = 2 * this.camera.top;
        
        for (const key in objectsConfig) {
            const config = objectsConfig[key];
            
            const w = planeWidth * config.pctWidth;
            const h = planeHeight * config.pctHeight;
            
            // Position relative to top-left
            const x = -planeWidth/2 + (planeWidth * config.pctX) + (w/2);
            const y = planeHeight/2 - (planeHeight * config.pctY) - (h/2);

            const hitboxGeo = new THREE.PlaneGeometry(w, h);
            // Invisible material for hitbox
            const hitboxMat = new THREE.MeshBasicMaterial({ 
                color: 0x00ff00, 
                transparent: true, 
                opacity: 0.0 // Set to 0.0 for invisible
            });
            
            const hitboxMesh = new THREE.Mesh(hitboxGeo, hitboxMat);
            hitboxMesh.position.set(x, y, 0);
            hitboxMesh.userData = { isHitbox: true, id: config.id };
            
            this.scene.add(hitboxMesh);
            this.hitboxes[config.id] = hitboxMesh;
        }

        // Game is ready to start
        this.gameStateManager.dispatchIntent('START_GAME');
    }

    onWindowResize() {
        // To keep logic simple and background filling screen, we reset camera aspect
        const aspect = window.innerWidth / window.innerHeight;
        this.camera.left = -aspect;
        this.camera.right = aspect;
        this.camera.top = 1;
        this.camera.bottom = -1;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Note: For a true responsive game, we would re-scale the background plane 
        // and hitboxes here based on new dimensions. For simplicity in this demo,
        // assume fixed window size after start or minor adjustments.
    }

    update(state) {
        // Disable hitboxes for found objects so they can't be clicked again
        for (const key in state.objects) {
            if (state.objects[key].found && this.hitboxes[key]) {
                this.hitboxes[key].visible = false;
            }
        }

        // Show hint pulse if requested
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

        // Base ring radius relative to camera frustum size
        const radius = this.camera.top * 0.05; 
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
        location.reload(); // Simple reload for reboot
    });

    // Initialize scene directly (bypassing CORS local load)
    sceneManager.initializeScene(hiddenObjects);
});
