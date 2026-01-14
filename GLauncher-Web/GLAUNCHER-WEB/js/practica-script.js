document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos Comunes ---
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const practiceLayout = document.querySelector('.practice-layout');
    const exerciseItems = document.querySelectorAll('.exercise-item');
    const exerciseContents = document.querySelectorAll('.exercise-content');
    const hitSound = document.getElementById('hit-sound');
    const placeBlockSound = document.getElementById('place-block-sound');
    const levelUpSound = document.getElementById('level-up-sound');

    // --- Lógica de Navegación de Ejercicios ---
    exerciseItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('data-target');
            if (cpsTestRunning) endCpsTest();
            if (aimGameRunning) endAimGame();
            if (blockPlacerRunning) endBlockPlacerGame();
            exerciseItems.forEach(i => i.classList.remove('active'));
            exerciseContents.forEach(c => c.classList.remove('active'));
            item.classList.add('active');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('active');
                if (targetId === 'block-placer') {
                    initBlockPlacer();
                }
            }
        });
    });
    sidebarToggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        practiceLayout.classList.toggle('sidebar-collapsed');
    });

    // ==================================================
    // --- TEST DE CPS (CLICS POR SEGUNDO) ---
    // ==================================================
    const timeSelect = document.getElementById('time-select');
    const customTimeInput = document.getElementById('custom-time-input');
    const cpsTimerDisplay = document.getElementById('cps-timer');
    const liveCpsDisplay = document.getElementById('live-cps');
    const clickArea = document.getElementById('click-area');
    const startText = document.getElementById('start-text');
    const cpsResultsModal = document.getElementById('cps-results-modal-overlay');
    const cpsRating = document.getElementById('cps-rating');
    const finalCpsSpan = document.querySelector('#final-cps span');
    const totalClicksSpan = document.querySelector('#total-clicks span');
    const cpsRestartBtn = document.getElementById('cps-restart-btn');
    let cpsClicks = 0, cpsIntervalId = null, cpsTestDuration = 10, cpsTestRunning = false, cpsStartTime = 0;
    timeSelect.addEventListener('change', () => { if (cpsTestRunning) return; customTimeInput.classList.toggle('hidden', timeSelect.value !== 'custom'); if (timeSelect.value === 'custom') { customTimeInput.focus(); cpsTestDuration = parseInt(customTimeInput.value, 10) || 10; } else { cpsTestDuration = parseInt(timeSelect.value, 10); } resetCpsTestUI(); });
    customTimeInput.addEventListener('change', () => { if (cpsTestRunning) return; const val = parseInt(customTimeInput.value, 10); if (val > 0 && val <= 60) { cpsTestDuration = val; resetCpsTestUI(); } });
    clickArea.addEventListener('click', e => { if (!cpsTestRunning && !cpsIntervalId) { startCpsTest(); } if (cpsTestRunning) { cpsClicks++; createClickFeedback(e.clientX, e.clientY); } });
    cpsRestartBtn.addEventListener('click', () => { cpsResultsModal.classList.add('hidden'); resetCpsTestUI(); });
    function startCpsTest() { resetCpsState(); cpsTestRunning = true; clickArea.classList.add('running'); startText.textContent = '¡Clica!'; cpsStartTime = Date.now(); cpsIntervalId = setInterval(() => { const elapsedTime = (Date.now() - cpsStartTime) / 1000; if (elapsedTime >= cpsTestDuration) { endCpsTest(); } else { cpsTimerDisplay.textContent = (cpsTestDuration - elapsedTime).toFixed(2); liveCpsDisplay.textContent = (cpsClicks / elapsedTime || 0).toFixed(2); } }, 10); }
    function endCpsTest() { clearInterval(cpsIntervalId); cpsIntervalId = null; if (!cpsTestRunning) return; cpsTestRunning = false; const finalTime = (Date.now() - cpsStartTime) / 1000; showCpsResults((cpsClicks / finalTime).toFixed(2), cpsClicks); startText.textContent = 'Haz Clic para Empezar'; }
    function showCpsResults(cps, totalClicks) { finalCpsSpan.textContent = cps; totalClicksSpan.textContent = totalClicks; setCpsRating(cps); cpsResultsModal.classList.remove('hidden'); }
    function setCpsRating(cps) { const r = { s: { i: 'fa-turtle', t: 'Lento...' }, a: { i: 'fa-walking', t: 'Promedio' }, f: { i: 'fa-running', t: '¡Rápido!' }, c: { i: 'fa-cheetah', t: '¡Velocidad de Chita!' } }; const k = cps < 5 ? 's' : cps < 8 ? 'a' : cps < 12 ? 'f' : 'c'; cpsRating.innerHTML = `<i class="fas ${r[k].i}"></i><span>${r[k].t}</span>`; cpsRating.className = 'cps-rating rating-' + k; }
    function resetCpsState() { if (cpsIntervalId) clearInterval(cpsIntervalId); cpsIntervalId = null; cpsTestRunning = false; cpsClicks = 0; }
    function resetCpsTestUI() { resetCpsState(); cpsTimerDisplay.textContent = cpsTestDuration.toFixed(2); liveCpsDisplay.textContent = '0.00'; clickArea.classList.remove('running'); startText.textContent = 'Haz Clic para Empezar'; }
    function createClickFeedback(x, y) { const f = document.createElement('div'); f.className = 'click-feedback'; f.style.left = `${x}px`; f.style.top = `${y}px`; document.body.appendChild(f); f.addEventListener('animationend', () => f.remove()); }

    // ==================================================
    // --- AIM TRAINER ---
    // ==================================================
    const aimTimerDisplay = document.getElementById('aim-timer');
    const aimHitsDisplay = document.getElementById('aim-hits');
    const aimMissesDisplay = document.getElementById('aim-misses');
    const aimGameArea = document.getElementById('aim-game-area');
    const aimStartText = document.getElementById('aim-start-text');
    const aimResultsModal = document.getElementById('aim-results-modal-overlay');
    const aimRating = document.getElementById('aim-rating');
    const finalHitsSpan = document.getElementById('final-hits');
    const finalMissesSpan = document.getElementById('final-misses');
    const finalAccuracySpan = document.getElementById('final-accuracy');
    const aimRestartBtn = document.getElementById('aim-restart-btn');
    let aimHits = 0, aimMisses = 0, aimIntervalId = null, aimGameRunning = false, aimGameDuration = 30;
    aimStartText.addEventListener('click', startAimGame);
    aimGameArea.addEventListener('click', (e) => { if (aimGameRunning && e.target === aimGameArea) { aimMisses++; aimMissesDisplay.textContent = aimMisses; } });
    aimRestartBtn.addEventListener('click', () => { aimResultsModal.classList.add('hidden'); resetAimGameUI(); });
    function startAimGame() { resetAimGameUI(); aimGameRunning = true; aimStartText.classList.add('hidden'); const s = Date.now(); aimIntervalId = setInterval(() => { const e = (Date.now() - s) / 1000; if (e >= aimGameDuration) { endAimGame(); } else { aimTimerDisplay.textContent = (aimGameDuration - e).toFixed(2); } }, 10); spawnTarget(); }
    function endAimGame() { if (!aimGameRunning) return; clearInterval(aimIntervalId); aimIntervalId = null; aimGameRunning = false; aimGameArea.innerHTML = ''; aimGameArea.appendChild(aimStartText); showAimResults(); }
    function showAimResults() { const t = aimHits + aimMisses; const a = t > 0 ? ((aimHits / t) * 100) : 0; finalHitsSpan.textContent = aimHits; finalMissesSpan.textContent = aimMisses; finalAccuracySpan.textContent = `${a.toFixed(1)}%`; setAimRating(a); aimResultsModal.classList.remove('hidden'); }
    function setAimRating(acc) { const m = { b: ["¿Estás bien?", "¿Le das a la pantalla?", "Mi abuela apunta mejor..."], o: ["No está mal, pero mejora.", "Sigue practicando.", "Casi..."], g: ["¡Buena puntería!", "¡Eres rápido!", "Se nota la práctica."], gr: ["¡Impresionante!", "¡Eres una máquina!", "¡LEYENDA!"] }; let c = 'b'; if (acc >= 95) c = 'gr'; else if (acc >= 80) c = 'g'; else if (acc >= 60) c = 'o'; const rM = m[c][Math.floor(Math.random() * m[c].length)]; aimRating.innerHTML = `<span>${rM}</span>`; aimRating.className = 'cps-rating rating-' + c; }
    function resetAimGameUI() { aimGameRunning = false; if (aimIntervalId) clearInterval(aimIntervalId); aimHits = 0; aimMisses = 0; aimTimerDisplay.textContent = aimGameDuration.toFixed(2); aimHitsDisplay.textContent = '0'; aimMissesDisplay.textContent = '0'; aimGameArea.innerHTML = ''; aimStartText.classList.remove('hidden'); aimGameArea.appendChild(aimStartText); }
    function spawnTarget() { if (!aimGameRunning) return; aimGameArea.querySelector('.aim-target')?.remove(); const t = document.createElement('div'); t.classList.add('aim-target'); t.addEventListener('click', onTargetHit); t.style.left = `${Math.floor(Math.random() * (aimGameArea.clientWidth - 50))}px`; t.style.top = `${Math.floor(Math.random() * (aimGameArea.clientHeight - 50))}px`; aimGameArea.appendChild(t); void t.offsetWidth; t.classList.add('visible'); }
    function onTargetHit(e) { e.stopPropagation(); if (!aimGameRunning) return; aimHits++; aimHitsDisplay.textContent = aimHits; hitSound.currentTime = 0; hitSound.play().catch(e => {}); e.target.remove(); spawnTarget(); }

    // ==================================================
    // --- BLOCK PLACER ---
    // ==================================================
    const blockPlacerArea = document.getElementById('block-placer-area');
    const blockStartText = document.getElementById('block-start-text');
    const blockTimerDisplay = document.getElementById('block-timer');
    const blockScoreDisplay = document.getElementById('block-score');
    const objectiveSelect = document.getElementById('objective-select');
    const hotbarContainer = document.getElementById('hotbar-container');
    const hotbarSlots = document.getElementById('hotbar-slots');
    const hotbarSelection = document.getElementById('hotbar-selection');
    const blockResultsModal = document.getElementById('block-results-modal-overlay');
    const blockResultTitle = document.getElementById('block-result-title');
    const blockRating = document.getElementById('block-rating');
    const blockFinalStats = document.getElementById('block-final-stats');
    const blockRestartBtn = document.getElementById('block-restart-btn');

    let blockPlacerRunning = false, blockTimerId = null, blockStartTime = 0;
    let currentObjective = 'freestyle', score = 0, totalToBuild = 0;
    let scene, camera, renderer, raycaster, mouse;
    let materials = {}, cubeGeo, rollOverMesh, cubes = [], hologramGroup = new THREE.Group();
    let isThreeJsInitialized = false;
    let hotbarItems = [], currentHotbarSlot = 0;

    const BLOCK_SIZE = 100;
    const blueprints = {
        beacon: {
            blocks: ['iron_block', 'beacon'],
            structure: [
                { pos: [-1, 0, -1], type: 'iron_block' }, { pos: [0, 0, -1], type: 'iron_block' }, { pos: [1, 0, -1], type: 'iron_block' },
                { pos: [-1, 0, 0], type: 'iron_block' }, { pos: [0, 0, 0], type: 'iron_block' }, { pos: [1, 0, 0], type: 'iron_block' },
                { pos: [-1, 0, 1], type: 'iron_block' }, { pos: [0, 0, 1], type: 'iron_block' }, { pos: [1, 0, 1], type: 'iron_block' },
                { pos: [0, 1, 0], type: 'beacon' }
            ]
        },
        villager_house: {
            blocks: ['cobblestone', 'oak_planks', 'glass'], // Simplificado
            structure: [
                { pos: [0, 0, 0], type: 'cobblestone' }, { pos: [1, 0, 0], type: 'cobblestone' }, { pos: [2, 0, 0], type: 'cobblestone' },
                { pos: [0, 0, 1], type: 'cobblestone' }, { pos: [2, 0, 1], type: 'cobblestone' },
                { pos: [0, 0, 2], type: 'cobblestone' }, { pos: [1, 0, 2], type: 'cobblestone' }, { pos: [2, 0, 2], type: 'cobblestone' },
                { pos: [0, 1, 0], type: 'oak_planks' }, { pos: [2, 1, 0], type: 'oak_planks' },
                { pos: [0, 1, 1], type: 'oak_planks' }, { pos: [2, 1, 1], type: 'oak_planks' },
                { pos: [0, 1, 2], type: 'oak_planks' }, { pos: [1, 1, 2], type: 'glass' }, { pos: [2, 1, 2], type: 'oak_planks' },
            ]
        },
        herobrine_shrine: {
            blocks: ['gold_block', 'cobblestone', 'netherrack'],
            structure: [
                { pos: [-1, 0, -1], type: 'gold_block' }, { pos: [1, 0, -1], type: 'gold_block' },
                { pos: [-1, 0, 1], type: 'gold_block' }, { pos: [1, 0, 1], type: 'gold_block' },
                { pos: [0, 0, 0], type: 'cobblestone' }, { pos: [0, 1, 0], type: 'cobblestone' },
                { pos: [0, 2, 0], type: 'netherrack' } // Con fuego imaginario
            ]
        },
        freestyle: {
            blocks: ['blue_wool', 'iron_block', 'beacon', 'gold_block', 'netherrack', 'cobblestone', 'oak_planks', 'glass'],
            structure: []
        }
    };
    
    function initBlockPlacer() {
        if (isThreeJsInitialized || typeof THREE === 'undefined') return;
        isThreeJsInitialized = true;

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1f1f1f);
        camera = new THREE.PerspectiveCamera(50, blockPlacerArea.clientWidth / blockPlacerArea.clientHeight, 1, 10000);
        camera.position.set(500, 800, 1300);
        camera.lookAt(0, 0, 0);

        const textureLoader = new THREE.TextureLoader();
        textureLoader.setPath('images/hotbar/blocks/');
        const allBlockTypes = new Set();
        Object.values(blueprints).forEach(bp => bp.blocks.forEach(b => allBlockTypes.add(b)));

        allBlockTypes.forEach(blockType => {
            const texture = textureLoader.load(`${blockType}.png`);
            texture.magFilter = THREE.NearestFilter;
            materials[blockType] = new THREE.MeshLambertMaterial({ map: texture });
        });
        
        cubeGeo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        const rollOverMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, opacity: 0.5, transparent: true });
        rollOverMesh = new THREE.Mesh(cubeGeo, rollOverMaterial);
        scene.add(rollOverMesh);

        const ambientLight = new THREE.AmbientLight(0x808080);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 0.75, 0.5).normalize();
        scene.add(directionalLight);

        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(blockPlacerArea.clientWidth, blockPlacerArea.clientHeight);
        blockPlacerArea.appendChild(renderer.domElement);
        scene.add(hologramGroup);

        renderer.domElement.addEventListener('mousemove', onDocumentMouseMove, false);
        renderer.domElement.addEventListener('mousedown', onDocumentMouseDown, false);
        window.addEventListener('resize', onWindowResize, false);
        document.addEventListener('keydown', onKeyDown, false);
        hotbarSlots.addEventListener('click', onHotbarClick, false);
        objectiveSelect.addEventListener('change', resetBlockPlacerGame);
        blockStartText.addEventListener('click', startBlockPlacerGame);
        blockRestartBtn.addEventListener('click', resetBlockPlacerGame);
        
        animate();
        resetBlockPlacerGame();
    }

    function animate() { requestAnimationFrame(animate); if(renderer) renderer.render(scene, camera); }
    function onWindowResize() { if (!isThreeJsInitialized) return; camera.aspect = blockPlacerArea.clientWidth / blockPlacerArea.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(blockPlacerArea.clientWidth, blockPlacerArea.clientHeight); }
    function onKeyDown(event) { if (!blockPlacerRunning) return; if (event.keyCode >= 49 && event.keyCode <= 57) { const slotIndex = event.keyCode - 49; if (slotIndex < hotbarItems.length) { setHotbarSelection(slotIndex); } } }
    function onHotbarClick(event) { if (event.target.classList.contains('hotbar-slot')) { const slotIndex = parseInt(event.target.dataset.slot, 10); if (slotIndex < hotbarItems.length) { setHotbarSelection(slotIndex); } } }

    function loadObjective(objectiveName) {
        currentObjective = objectiveName;
        const blueprint = blueprints[objectiveName];
        hotbarItems = blueprint.blocks;
        updateHotbar();
        setHotbarSelection(0);

        hologramGroup.clear();
        blueprint.structure.forEach(hologram => {
            const hologramMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff, opacity: 0.3, transparent: true });
            const hologramCube = new THREE.Mesh(cubeGeo, hologramMaterial);
            hologramCube.position.set(hologram.pos[0] * BLOCK_SIZE, hologram.pos[1] * BLOCK_SIZE, hologram.pos[2] * BLOCK_SIZE);
            hologramCube.userData.originalPos = hologram.pos.join(',');
            hologramCube.userData.blockType = hologram.type;
            hologramGroup.add(hologramCube);
        });
        
        totalToBuild = blueprint.structure.length;
        if (objectiveName === 'freestyle') {
            const startPlane = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ visible: false }));
            cubes = [startPlane];
            scene.add(startPlane);
        }
    }

    function updateHotbar() {
        hotbarSlots.innerHTML = '';
        hotbarItems.forEach((item, index) => {
            const slot = document.createElement('img');
            slot.src = `images/hotbar/blocks/${item}.png`;
            slot.classList.add('hotbar-slot');
            slot.dataset.slot = index;
            slot.title = item.replace(/_/g, ' ');
            hotbarSlots.appendChild(slot);
        });
    }

    function setHotbarSelection(index) {
        currentHotbarSlot = index;
        hotbarSelection.style.left = `${4 + index * 40}px`; // 4px initial offset + 40px per slot
        const currentBlockType = hotbarItems[currentHotbarSlot];
        rollOverMesh.material = materials[currentBlockType] ? new THREE.MeshBasicMaterial({ map: materials[currentBlockType].map, opacity: 0.5, transparent: true }) : new THREE.MeshBasicMaterial({ color: 0xff00ff, opacity: 0.5, transparent: true });
    }

    function startBlockPlacerGame() {
        if (blockPlacerRunning) return;
        blockPlacerRunning = true;
        blockStartText.style.display = 'none';
        rollOverMesh.visible = true;
        hotbarContainer.style.opacity = 1;
        objectiveSelect.disabled = true;

        blockStartTime = Date.now();
        blockTimerId = setInterval(() => {
            const elapsedTime = (Date.now() - blockStartTime) / 1000;
            blockTimerDisplay.textContent = elapsedTime.toFixed(2);
        }, 10);
    }
    
    function endBlockPlacerGame(completed = false) {
        if (!blockPlacerRunning) return;
        blockPlacerRunning = false;
        clearInterval(blockTimerId);
        rollOverMesh.visible = false;
        objectiveSelect.disabled = false;
        showBlockPlacerResults(completed);
    }

    function showBlockPlacerResults(completed) {
        const finalTime = (Date.now() - blockStartTime) / 1000;
        blockResultsModal.classList.remove('hidden');
        if (currentObjective === 'freestyle') {
            blockResultTitle.textContent = '¡Modo Libre!';
            blockRating.innerHTML = '<span>¡Sigue construyendo!</span>';
            blockFinalStats.innerHTML = `<div class="final-stat"><p>Bloques Colocados</p><span>${score}</span></div><div class="final-stat"><p>Tiempo</p><span>${finalTime.toFixed(2)}s</span></div>`;
        } else {
            if (completed) {
                levelUpSound.play();
                blockResultTitle.textContent = '¡Objetivo Completado!';
                blockRating.innerHTML = `<span>¡Excelente trabajo!</span>`;
                blockFinalStats.innerHTML = `<div class="final-stat"><p>Tiempo Final</p><span>${finalTime.toFixed(2)}s</span></div>`;
            } else {
                blockResultTitle.textContent = '¡Tiempo!';
                blockRating.innerHTML = '<span>¡La próxima vez será!</span>';
                blockFinalStats.innerHTML = `<div class="final-stat"><p>Progreso</p><span>${score}/${totalToBuild}</span></div><div class="final-stat"><p>Tiempo</p><span>${finalTime.toFixed(2)}s</span></div>`;
            }
        }
    }

    function resetBlockPlacerGame() {
        if (blockTimerId) clearInterval(blockTimerId);
        blockPlacerRunning = false;
        score = 0;
        
        cubes.forEach(c => scene.remove(c));
        cubes = [];
        hologramGroup.clear();
        
        currentObjective = objectiveSelect.value;
        loadObjective(currentObjective);

        blockScoreDisplay.textContent = currentObjective === 'freestyle' ? '0' : `0 / ${totalToBuild}`;
        blockTimerDisplay.textContent = '0.00';
        blockStartText.style.display = 'block';
        hotbarContainer.style.opacity = 0.5;
        objectiveSelect.disabled = false;
        blockResultsModal.classList.add('hidden');
    }

    function getMouseCanvasPosition(domElement, x, y) {
        const rect = domElement.getBoundingClientRect();
        return { x: ((x - rect.left) / rect.width) * 2 - 1, y: -((y - rect.top) / rect.height) * 2 + 1 };
    }

    function onDocumentMouseMove(event) {
        if (!isThreeJsInitialized || !rollOverMesh.visible) return;
        const pos = getMouseCanvasPosition(renderer.domElement, event.clientX, event.clientY);
        mouse.set(pos.x, pos.y);
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(cubes.concat(hologramGroup.children), false);
        if (intersects.length > 0) {
            const intersect = intersects[0];
            rollOverMesh.position.copy(intersect.point).add(intersect.face.normal);
            rollOverMesh.position.divideScalar(BLOCK_SIZE).floor().multiplyScalar(BLOCK_SIZE).addScalar(BLOCK_SIZE / 2);
        }
    }

    function onDocumentMouseDown(event) {
        if (!blockPlacerRunning || !rollOverMesh.visible) return;
        const pos = getMouseCanvasPosition(renderer.domElement, event.clientX, event.clientY);
        mouse.set(pos.x, pos.y);
        raycaster.setFromCamera(mouse, camera);
        
        const currentBlockType = hotbarItems[currentHotbarSlot];
        const newBlockPosition = new THREE.Vector3();
        newBlockPosition.copy(rollOverMesh.position);
        
        // Evitar colocar bloques sobre sí mismos
        if (cubes.some(c => c.position.equals(newBlockPosition))) return;

        if (currentObjective === 'freestyle') {
            placeBlock(newBlockPosition, currentBlockType);
            score++;
            blockScoreDisplay.textContent = score;
        } else {
            const targetHologram = hologramGroup.children.find(h => h.position.equals(newBlockPosition));
            if (targetHologram && targetHologram.userData.blockType === currentBlockType) {
                placeBlock(newBlockPosition, currentBlockType);
                score++;
                blockScoreDisplay.textContent = `${score} / ${totalToBuild}`;
                targetHologram.visible = false; // Ocultar el holograma
                if (score === totalToBuild) {
                    endBlockPlacerGame(true);
                }
            } else {
                // Sonido de error o feedback visual (opcional)
            }
        }
    }
    
    function placeBlock(position, type) {
        const newCube = new THREE.Mesh(cubeGeo, materials[type]);
        newCube.position.copy(position);
        scene.add(newCube);
        cubes.push(newCube);
        placeBlockSound.currentTime = 0;
        placeBlockSound.play();
    }

    // Inicialización al cargar la página
    resetCpsTestUI();
    resetAimGameUI();
    // initBlockPlacer se llama al cambiar de pestaña
});
