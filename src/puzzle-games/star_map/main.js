/**
 * STAR MAP PROTOCOL - FINALIZED PRODUCTION BUILD
 */

let retryCount = 0;
const startApp = () => {
    const container = document.getElementById('game-viewport');
    if (!container || container.clientWidth === 0) {
        if (retryCount < 15) { retryCount++; setTimeout(startApp, 100); return; }
        return;
    }
    if (typeof THREE === 'undefined') return;
    initGame(container);
};

window.addEventListener('load', startApp);

function initGame(container) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02060c);
    
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 15;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    window.addEventListener('resize', () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        if (composer) composer.setSize(width, height);
    });

    let composer = null;
    if (typeof THREE.EffectComposer !== 'undefined') {
        composer = new THREE.EffectComposer(renderer);
        composer.addPass(new THREE.RenderPass(scene, camera));
        const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(container.clientWidth, container.clientHeight), 1.5, 0.4, 0.85);
        composer.addPass(bloom);
    }

    const starGroup = new THREE.Group();
    scene.add(starGroup);

    const starData = [
        { id: 'AT2', pos: [-6, 3, 0] }, { id: 'Orion3', pos: [1, 5, 0] },
        { id: 'Sys1', pos: [-5, -4, 0] }, { id: 'SysX', pos: [6, -3, 0] },
        { id: 'Sys0', pos: [5, 2, 0] }, { id: 'Rigel', pos: [-2, 1, 0] },
        { id: 'Vega', pos: [3, -1, 0] }, { id: 'Sirius', pos: [-3, 4, 0] },
        { id: 'Altair', pos: [0, -5, 0] }, 
        { id: 'HIDDEN', pos: [0.5, 0.5, 0], isTarget: true } 
    ];

    const starMeshes = starData.map(data => {
        const group = new THREE.Group();
        const color = data.isTarget ? 0xffaa00 : 0xf0f8ff;
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), new THREE.MeshBasicMaterial({ color: color }));
        
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(32,32,0, 32,32,32);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad; ctx.fillRect(0,0,64,64);

        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ 
            map: new THREE.CanvasTexture(canvas), 
            blending: THREE.AdditiveBlending, 
            transparent: true, 
            opacity: 0.8,
            color: color
        }));
        sprite.scale.set(data.isTarget ? 3.5 : 2, data.isTarget ? 3.5 : 2, 1);
        
        group.add(core); group.add(sprite);
        group.position.set(...data.pos);
        group.userData = data;
        starGroup.add(group);
        return group;
    });

    let selection = null;
    let adjacencyList = {}; 
    let isGameWon = false;

    function getPosById(id) {
        const star = starData.find(s => s.id === id);
        return { x: star.pos[0], y: star.pos[1] };
    }

    function isPointInPolygon(point, polygonPoints) {
        let x = point.x, y = point.y;
        let inside = false;
        for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
            let xi = polygonPoints[i].x, yi = polygonPoints[i].y;
            let xj = polygonPoints[j].x, yj = polygonPoints[j].y;
            const isBetweenY = ((yi > y) !== (yj > y));
            const intersectX = (xj - xi) * (y - yi) / (yj - yi) + xi;
            if (isBetweenY && x < intersectX) inside = !inside;
        }
        return inside;
    }

    function getClosedPolygons() {
        const cycles = [];
        const nodes = Object.keys(adjacencyList);
        function findCycles(curr, visited, path) {
            visited[curr] = true;
            path.push(curr);
            const neighbors = adjacencyList[curr] || [];
            for (const neighbor of neighbors) {
                if (neighbor === path[path.length - 2]) continue;
                if (path.includes(neighbor)) {
                    const cycleNodes = path.slice(path.indexOf(neighbor));
                    if (cycleNodes.length >= 3) cycles.push(cycleNodes.map(id => getPosById(id)));
                } else if (!visited[neighbor]) {
                    findCycles(neighbor, { ...visited }, [...path]);
                }
            }
        }
        nodes.forEach(node => findCycles(node, {}, []));
        return cycles;
    }

    function checkWinConditions() {
        const polygons = getClosedPolygons();
        const targetMesh = starMeshes.find(m => m.userData.isTarget);
        if (!targetMesh) return "PENDING";
        const targetPos = { x: targetMesh.position.x, y: targetMesh.position.y };
        let trapped = false;
        for (let poly of polygons) {
            if (isPointInPolygon(targetPos, poly)) {
                trapped = true;
                break;
            }
        }
        const otherStars = starData.filter(s => !s.isTarget);
        const allOthersConnected = otherStars.every(s => adjacencyList[s.id] && adjacencyList[s.id].length > 0);

        if (trapped && allOthersConnected) {
            targetMesh.children[0].material.color.set(0x00ff00);
            targetMesh.children[1].material.color.set(0x00ff00);
            return "WIN";
        } else if (trapped) {
            targetMesh.children[0].material.color.set(0xffff00);
            targetMesh.children[1].material.color.set(0xffff00);
            return "PARTIAL";
        } else {
            targetMesh.children[0].material.color.set(0xff4444);
            targetMesh.children[1].material.color.set(0xff4444);
            return "PENDING";
        }
    }

    container.addEventListener('mousedown', (e) => {
        if (isGameWon) return;
        const canvasElement = renderer.domElement;
        const rect = canvasElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / canvasElement.clientWidth) * 2 - 1,
            -((e.clientY - rect.top) / canvasElement.clientHeight) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(starGroup.children, true);

        if (intersects.length > 0) {
            let star = intersects[0].object;
            while(star.parent !== starGroup) star = star.parent;
            const data = star.userData;

            if (data.isTarget) {
                const winStatus = checkWinConditions();
                if (winStatus === "WIN") {
                    isGameWon = true;
                    document.getElementById('game-status').innerHTML = 
                        `SYSTEM_CLEARED // ACCESS_KEY: <span style="color:#fff; text-shadow: 0 0 10px #fff;">PLUTO</span>`;
                    
                    const winLight = new THREE.PointLight(0x00ff00, 10, 50);
                    winLight.position.copy(star.position);
                    scene.add(winLight);

                    // Notify parent lobby
                    window.parent.postMessage({ type: 'PUZZLE_SOLVED', puzzle: 'star_map' }, '*');
                    window.dispatchEvent(new CustomEvent('puzzleSolved', { detail: { puzzle: 'star_map' } }));
                } 
                else if (winStatus === "PARTIAL") {
                    isGameWon = true; 
                    document.getElementById('game-status').innerHTML = 
                        `FAILURE: UNSTABLE_LINK <button onclick="location.reload()" style="margin-left:10px; background:none; border:1px solid #ff4444; color:#ff4444; cursor:pointer; font-family:inherit; font-size:0.7rem; padding: 2px 5px;">[RESTART]</button>`;
                    star.children[0].material.color.set(0xff0000);
                    star.children[1].material.color.set(0xff0000);
                } 
                else {
                    star.position.x += 0.1;
                    setTimeout(() => star.position.x -= 0.1, 50);
                }
                return;
            }

            if (!selection) {
                selection = star;
                star.children[0].material.color.set(0x70d1f4);
            } else {
                if (selection !== star) {
                    const s1Id = selection.userData.id, s2Id = data.id;
                    if (!adjacencyList[s1Id]) adjacencyList[s1Id] = [];
                    if (!adjacencyList[s2Id]) adjacencyList[s2Id] = [];
                    if (!adjacencyList[s1Id].includes(s2Id)) {
                        adjacencyList[s1Id].push(s2Id);
                        adjacencyList[s2Id].push(s1Id);
                        const lineGeo = new THREE.BufferGeometry().setFromPoints([selection.position.clone(), star.position.clone()]);
                        scene.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x70d1f4, transparent: true, opacity: 0.6 })));
                        const li = document.createElement('li');
                        li.innerHTML = `<span style="color:#70d1f4">SYNC:</span> ${s1Id} ➔ ${s2Id}`;
                        document.getElementById('log-list').prepend(li);
                        checkWinConditions();
                    }
                }
                selection.children[0].material.color.set(0xf0f8ff);
                selection = null;
            }
        }
    });

    function animate() {
        requestAnimationFrame(animate);
        const currentWinStatus = checkWinConditions();

        starGroup.children.forEach(s => { 
            if(s.type === "Group") {
                const isTarget = s.userData.isTarget;
                
                // SPEED LOGIC: If game is won, target blinks at 0.03 (Very fast)
                // Otherwise blinks at 0.005 or 0.002
                let speed = 0.002;
                if (isTarget) {
                    if (isGameWon) {
                        speed = 0.03; // Rapid blink on success
                    } else {
                        speed = (currentWinStatus === "WIN" || currentWinStatus === "PARTIAL") ? 0.01 : 0.005;
                    }
                }

                const opacityBase = isTarget ? 0.7 : 0.4;
                s.children[1].material.opacity = opacityBase + Math.sin(Date.now() * speed) * 0.3;
            }
        });

        if (composer) composer.render(); else renderer.render(scene, camera);
    }
    animate();
}