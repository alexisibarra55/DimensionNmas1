/**
 * Archivo principal para la aplicación 3D de "Dimensión N+1" (inspirado en Homer³).
 * Utiliza Three.js para crear una escena interactiva con movimiento en primera persona, 
 * objetos flotantes y una cuadrícula estilo Tron.
 */

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let camera, scene, renderer, controls;
const objects = [];
let prevTime = performance.now();

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let moveUp = false;
let moveDown = false;
let canJump = true;
let isRunning = false;
let isZoomed = false;

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

// --- Double-Tap Shift for Turbo ---
let lastShiftPressTime = 0;
const doubleTapThreshold = 300; // ms para el doble toque

// --- Zoom ---
const defaultFov = 75;
const zoomFov = 35;

// --- Turbo ---
let turboActive = false;
let turboCooldown = false;
let turboTimeout, turboCooldownTimeout;
const turboMultiplier = 6.0;
const turboDuration = 3.0;
const turboCooldownTime = 5.0;
let turboMsg;

// --- Música de fondo synthwave ---
const audio = new Audio('https://cdn.pixabay.com/download/audio/2022/08/11/audio_2bb1671e07.mp3?filename=neon-vibes-10571.mp3');
audio.loop = true;
audio.volume = 0.4;
let musicPaused = false;

// Mensaje visual de música
let musicMsg = document.getElementById('music-msg');
if (!musicMsg) {
    musicMsg = document.createElement('div');
    musicMsg.id = 'music-msg';
    musicMsg.style.position = 'fixed';
    musicMsg.style.bottom = '32px';
    musicMsg.style.left = '50%';
    musicMsg.style.transform = 'translateX(-50%)';
    musicMsg.style.fontSize = '1.2em';
    musicMsg.style.color = '#0ff';
    musicMsg.style.fontWeight = 'bold';
    musicMsg.style.textShadow = '0 0 8px #0ff, 0 0 16px #000';
    musicMsg.style.zIndex = '1000';
    musicMsg.style.display = 'none';
    document.body.appendChild(musicMsg);
}

// Declaración global de los mensajes (sin crear los elementos todavía)
let pickupMsg;
let congratsMsg;
let timerUI;
let startTime;
let lastTime = 0; // Para guardar el último tiempo
let bestTime = parseFloat(localStorage.getItem('bestTimeAlex3D')); // Leer como número

// --- Textos bilingües ---
const TEXTS = {
  es: {
    start: 'Click para jugar',
    move: 'Mover: WASD',
    up: 'Arriba: SPACE',
    down: 'Abajo: L-CTRL',
    look: 'Mirar: MOUSE',
    run: 'Correr: SHIFT',
    turbo: 'Turbo: Doble toque SHIFT',
    turboActive: 'TURBO',
    turboCooldown: 'Turbo en Enfriamiento...',
    collected: nombre => `¡Recogiste un ${nombre}!`,
    congrats: (time, best) => `<b>¡FELICITACIONES!</b><br>Tiempo: ${time}<br>Mejor tiempo: ${best}`,
    noBestTime: 'N/A',
    collectiblesCounter: (n, total) => `Coleccionables: ${n} / ${total}`
  },
  en: {
    start: 'Click to Play',
    move: 'Move: WASD',
    up: 'Up: SPACE',
    down: 'Down: L-CTRL',
    look: 'Look: MOUSE',
    run: 'Run: SHIFT',
    turbo: 'Turbo: Double-Tap SHIFT',
    turboActive: 'TURBO',
    turboCooldown: 'Turbo Cooling Down...',
    collected: name => `You collected a ${name}!`,
    congrats: (time, best) => `<b>CONGRATULATIONS!</b><br>Time: ${time}<br>Best Time: ${best}`,
    noBestTime: 'N/A',
    collectiblesCounter: (n, total) => `Collectibles: ${n} / ${total}`
  }
};
let currentLang = 'es';

// --- Nombres de geometría bilingües ---
const geometryNamesMulti = [
  { es: 'Toroide Enlazado', en: 'Torus Knot' },
  { es: 'Octaedro', en: 'Octahedron' },
  { es: 'Dodecaedro', en: 'Dodecahedron' },
  { es: 'Icosaedro', en: 'Icosahedron' },
  { es: 'Tetraedro', en: 'Tetrahedron' },
  { es: 'Cápsula', en: 'Capsule' },
  { es: 'Toroide', en: 'Torus' },
  { es: 'Cono', en: 'Cone' },
  { es: 'Cilindro', en: 'Cylinder' },
  { es: 'Esfera', en: 'Sphere' }
];

// --- Botón de reinicio ---
let restartBtn;
function showRestartButton() {
  if (!restartBtn) {
    restartBtn = document.createElement('button');
    restartBtn.style.cssText = 'display:block;margin:32px auto 0 auto;font-size:1.1em;padding:10px 32px;border-radius:8px;background:#0ff;color:#000;font-family:monospace;border:none;cursor:pointer;';
    restartBtn.onclick = () => {
      congratsMsg.style.display = 'none';
      resetStage();
    };
    congratsMsg.appendChild(restartBtn);
  }
  restartBtn.textContent = currentLang === 'es' ? 'Reiniciar' : 'Restart';
  restartBtn.style.display = 'block';
}

// --- Formateador de tiempo ---
function formatTime(seconds) {
  if (isNaN(seconds) || seconds === null) return TEXTS[currentLang].noBestTime;
  const ms = Math.floor((seconds * 1000) % 1000);
  const s = Math.floor(seconds % 60);
  const m = Math.floor(seconds / 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(ms).padStart(3, '0')}`;
}

// --- Reset stage ---
function resetStage() {
  // Elimina coleccionables viejos
  window.collectibles.forEach(obj => {
    if (!obj.collected) scene.remove(obj.mesh);
  });
  // Crea nuevos coleccionables
  const collectibleGeometries = [
    new THREE.TorusKnotGeometry(1, 0.3, 100, 16),
    new THREE.OctahedronGeometry(1),
    new THREE.DodecahedronGeometry(1),
    new THREE.IcosahedronGeometry(1),
    new THREE.TetrahedronGeometry(1),
    new THREE.CapsuleGeometry(0.7, 1.5, 8, 16),
    new THREE.TorusGeometry(1, 0.4, 16, 100),
    new THREE.ConeGeometry(1, 2, 16),
    new THREE.CylinderGeometry(0.7, 0.7, 2, 24),
    new THREE.SphereGeometry(1, 24, 24)
  ];
  const collectibleMaterial = new THREE.MeshPhongMaterial({ color: 0xff00ff, emissive: 0xaa00aa, shininess: 200 }); // Magenta vibrante
  const collectibles = [];
  for (let i = 0; i < 10; i++) {
    const geometry = collectibleGeometries[i % collectibleGeometries.length];
    const mesh = new THREE.Mesh(geometry, collectibleMaterial.clone());
    mesh.scale.set(6, 6, 6);
    mesh.position.set(
      Math.random() * 1800 - 900,
      Math.random() * 400 + 20,
      Math.random() * 1800 - 900
    );
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    collectibles.push({ mesh, collected: false });
    scene.add(mesh);
  }
  window.collectibles = collectibles;
  window.collectedCount = 0;
  collectibleCounter.textContent = TEXTS[currentLang].collectiblesCounter(0, collectibles.length);
  startTime = null;
  lastTime = 0;
  timerUI.textContent = formatTime(0);
  
  controls.unlock(); // Forzar desbloqueo para volver al menú
}

function init() {
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 4000);
    camera.position.set(-900, 10, -900); // Extremo de la grid

    // --- Selector de idioma ---
    const langSelector = document.createElement('select');
    langSelector.style.cssText = 'position:fixed;top:20px;left:30px;z-index:500;font-size:1.1em;padding:4px 10px;border-radius:6px;background:#111;color:#0ff;border:1px solid #0ff;';
    langSelector.innerHTML = '<option value="es">Español</option><option value="en">English</option>';
    langSelector.value = currentLang;
    document.body.appendChild(langSelector);
    langSelector.addEventListener('change', () => {
      currentLang = langSelector.value;
      updateTexts();
    });

    // Controls
    controls = new PointerLockControls(camera, document.body);
    const blocker = document.getElementById('blocker');
    const instructions = document.getElementById('instructions');

    instructions.addEventListener('click', () => {
        controls.lock();
    });

    controls.addEventListener('lock', () => {
        instructions.style.display = 'none';
        blocker.style.display = 'none';
        langSelector.style.display = 'none'; // Ocultar selector
        if (!startTime) {
            startTime = performance.now();
        }
    });

    controls.addEventListener('unlock', () => {
        if (congratsMsg.style.display !== 'block') {
            blocker.style.display = 'block';
            instructions.style.display = '';
            langSelector.style.display = ''; // Mostrar selector
        }
    });
    
    scene.add(controls.getObject());

    // Lights
    scene.add(new THREE.AmbientLight(0x606060));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);
    
    // Grid fija clásica
    const gridHelper = new THREE.GridHelper(2000, 200, 0x00ff00, 0x00ff00);
    scene.add(gridHelper);

    // Stars
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = [];
    for (let i = 0; i < 10000; i++) {
        starPositions.push(
            THREE.MathUtils.randFloatSpread(6000), // X más amplio
            THREE.MathUtils.randFloatSpread(4000), // Y más alto
            THREE.MathUtils.randFloatSpread(6000)  // Z más profundo
        );
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xffffff }));
    scene.add(stars);

    // Neon Objects
    const geometries = [
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.SphereGeometry(1, 32, 32),
        new THREE.ConeGeometry(1, 2, 32),
        new THREE.TorusGeometry(0.7, 0.3, 16, 100),
        new THREE.OctahedronGeometry(1),
        new THREE.DodecahedronGeometry(1),
        new THREE.IcosahedronGeometry(1),
        new THREE.CylinderGeometry(1, 1, 2, 32),
        new THREE.TetrahedronGeometry(1)
    ];
    const materials = [
        new THREE.MeshPhongMaterial({ color: 0x00ffff, emissive: 0x006666, shininess: 100 }), // Cian
        new THREE.MeshPhongMaterial({ color: 0x9400D3, emissive: 0x4B0082, shininess: 100 }), // Violeta
        new THREE.MeshPhongMaterial({ color: 0x0077ff, emissive: 0x002277, shininess: 100 }), // Azul
    ];

    for (let i = 0; i < 50; i++) {
        const geometry = geometries[Math.floor(Math.random() * geometries.length)];
        const material = materials[Math.floor(Math.random() * materials.length)];
        const mesh = new THREE.Mesh(geometry, material);
        const scale = Math.random() * 25 + 15; // Tamaño grande
        mesh.scale.set(scale, scale, scale);
        mesh.position.set(
            Math.random() * 1800 - 900,
            Math.random() * 400 + scale / 2,
            Math.random() * 1800 - 900
        );
        mesh.rotation.set( Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI );
        
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10
        );
        // Eje de rotación local aleatorio
        const axis = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize();
        const angularSpeed = Math.random() * 0.7 + 0.2; // radianes/seg

        objects.push({ 
            mesh, 
            velocity: velocity,
            axis: axis,
            angularSpeed: angularSpeed
        });
        scene.add(mesh);
    }

    // Turbo UI
    turboMsg = document.createElement('div');
    turboMsg.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);font-size:1.1em;color:#00ff00;font-family:monospace;background:#000;padding:8px 18px;border-radius:0;z-index:100;display:none;box-shadow:none;font-weight:normal;text-shadow:none;';
    document.body.appendChild(turboMsg);

    // Event Listeners
    document.addEventListener('contextmenu', (event) => event.preventDefault()); // Evita el menú contextual
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onWindowResize);

    // Coleccionables
    const collectibleGeometries = [
        new THREE.TorusKnotGeometry(1, 0.3, 100, 16),
        new THREE.OctahedronGeometry(1),
        new THREE.DodecahedronGeometry(1),
        new THREE.IcosahedronGeometry(1),
        new THREE.TetrahedronGeometry(1),
        new THREE.CapsuleGeometry(0.7, 1.5, 8, 16),
        new THREE.TorusGeometry(1, 0.4, 16, 100),
        new THREE.ConeGeometry(1, 2, 16),
        new THREE.CylinderGeometry(0.7, 0.7, 2, 24),
        new THREE.SphereGeometry(1, 24, 24)
    ];
    const collectibleMaterial = new THREE.MeshPhongMaterial({ color: 0xff00ff, emissive: 0xaa00aa, shininess: 200 }); // Magenta vibrante
    const collectibles = [];
    for (let i = 0; i < 10; i++) {
        const geometry = collectibleGeometries[i % collectibleGeometries.length];
        const mesh = new THREE.Mesh(geometry, collectibleMaterial.clone());
        mesh.scale.set(6, 6, 6);
        mesh.position.set(
            Math.random() * 1800 - 900,
            Math.random() * 400 + 20,
            Math.random() * 1800 - 900
        );
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        collectibles.push({ mesh, collected: false });
        scene.add(mesh);
    }

    // UI del contador de coleccionables
    const collectibleCounter = document.createElement('div');
    collectibleCounter.style.cssText = 'position:fixed;top:20px;right:30px;font-size:1.3em;color:#fff;font-family:monospace;background:rgba(0,0,0,0.7);padding:6px 14px;border-radius:6px;z-index:100;';
    collectibleCounter.textContent = TEXTS[currentLang].collectiblesCounter(0, collectibles.length);
    document.body.appendChild(collectibleCounter);

    // Guardar en window para acceso global
    window.collectibles = collectibles;
    window.collectibleCounter = collectibleCounter;
    window.collectedCount = 0;

    // Polvo espacial (partículas)
    const dustGeometry = new THREE.BufferGeometry();
    const dustCount = 6000;
    const dustPositions = [];
    for (let i = 0; i < dustCount; i++) {
        dustPositions.push(
            Math.random() * 2000 - 1000,
            Math.random() * 800 - 200,
            Math.random() * 2000 - 1000
        );
    }
    dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
    const dustMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, opacity: 0.5, transparent: true });
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    scene.add(dust);

    // Blackhole (Agujero negro visual como esfera)
    const blackholeGeometry = new THREE.SphereGeometry(22, 64, 64);
    const blackholeMaterial = new THREE.MeshPhongMaterial({ color: 0x000000, emissive: 0x111111, shininess: 10 });
    const blackhole = new THREE.Mesh(blackholeGeometry, blackholeMaterial);
    blackhole.position.set(0, 0.5, 0);
    scene.add(blackhole);

    // Plano con gradiente (simulación de pozo)
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(0,0,0,0.8)');
    gradient.addColorStop(0.5, 'rgba(0,0,0,0.5)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    const texture = new THREE.CanvasTexture(canvas);
    const pitGeometry = new THREE.CircleGeometry(60, 64);
    const pitMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const pit = new THREE.Mesh(pitGeometry, pitMaterial);
    pit.rotation.x = -Math.PI / 2;
    pit.position.set(0, 0.01, 0);
    scene.add(pit);

    // --- UI para mensajes de recogida y felicitación ---
    pickupMsg = document.createElement('div');
    pickupMsg.style.cssText = 'position:fixed;bottom:32px;left:32px;font-size:1.2em;color:#ffe066;font-family:monospace;background:rgba(0,0,0,0.8);padding:8px 18px;border-radius:8px;z-index:200;display:none;text-shadow:0 0 8px #000;';
    document.body.appendChild(pickupMsg);

    congratsMsg = document.createElement('div');
    congratsMsg.style.cssText = 'position:fixed;bottom:90px;left:32px;font-size:2.2em;color:#0ff;font-family:monospace;background:rgba(0,0,0,0.92);padding:32px 48px;border-radius:18px;z-index:300;display:none;text-align:left;text-shadow:0 0 16px #000,0 0 32px #0ff;';
    congratsMsg.innerHTML = '<b>¡FELICITACIONES!</b><br>Has recolectado todos los coleccionables.<br>¡Eres un explorador de la Dimensión N+1!';
    document.body.appendChild(congratsMsg);

    // --- UI del temporizador ---
    timerUI = document.createElement('div');
    timerUI.style.cssText = 'position:fixed;top:60px;right:30px;font-size:1.3em;color:#fff;font-family:monospace;background:rgba(0,0,0,0.7);padding:6px 14px;border-radius:6px;z-index:100;';
    timerUI.textContent = formatTime(0);
    document.body.appendChild(timerUI);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
    switch (event.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyD': moveRight = true; break;
        case 'ShiftLeft': 
        case 'ShiftRight':
            isRunning = true;
            const currentTime = performance.now();
            if (currentTime - lastShiftPressTime < doubleTapThreshold) {
                if (!turboActive && !turboCooldown) {
                    activateTurbo();
                }
            }
            lastShiftPressTime = currentTime;
            break;
        case 'Space': moveUp = true; break;
        case 'ControlLeft': moveDown = true; break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyD': moveRight = false; break;
        case 'ShiftLeft': case 'ShiftRight': isRunning = false; break;
        case 'Space': moveUp = false; break;
        case 'ControlLeft': moveDown = false; break;
    }
}

function onMouseDown(event) {
    if (event.button === 2) { // Click derecho
        isZoomed = true;
    }
}

function onMouseUp(event) {
    if (event.button === 2) { // Click derecho
        isZoomed = false;
    }
}

function activateTurbo() {
    turboActive = true;
    turboCooldown = true;
    turboMsg.textContent = TEXTS[currentLang].turboActive;
    turboMsg.style.display = 'block';

    turboTimeout = setTimeout(() => {
        turboActive = false;
        turboMsg.textContent = TEXTS[currentLang].turboCooldown;
        turboCooldownTimeout = setTimeout(() => {
            turboCooldown = false;
            turboMsg.style.display = 'none';
        }, turboCooldownTime * 1000);
    }, turboDuration * 1000);
}

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (controls.isLocked) {
        // --- Lógica de Vuelo 6-DOF (flotante clásico) ---
        const speedMultiplier = (isRunning ? 3.5 : 1.0) * (turboActive ? turboMultiplier : 1.0);
        const acceleration = 400.0 * speedMultiplier;
        const forwardVector = new THREE.Vector3();
        camera.getWorldDirection(forwardVector);
        const rightVector = new THREE.Vector3().crossVectors(forwardVector, camera.up);
        const inputVector = new THREE.Vector3();
        if (moveForward) inputVector.add(forwardVector);
        if (moveBackward) inputVector.sub(forwardVector);
        if (moveRight) inputVector.add(rightVector);
        if (moveLeft) inputVector.sub(rightVector);
        if (moveUp) inputVector.y += 1;
        if (moveDown) inputVector.y -= 1;
        if (inputVector.length() > 0) {
            inputVector.normalize();
            velocity.addScaledVector(inputVector, acceleration * delta);
        }
        // Aplicar velocidad a la posición
        controls.getObject().position.addScaledVector(velocity, delta);
        // Aplicar fricción/amortiguación
        velocity.multiplyScalar(1 - (3 * delta));
        // Zoom con click derecho
        const targetFov = isZoomed ? zoomFov : defaultFov;
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 10 * delta);
        camera.updateProjectionMatrix();
    }

    objects.forEach(obj => {
        // Rotación sobre eje local
        obj.mesh.rotateOnAxis(obj.axis, obj.angularSpeed * delta);
        // Movimiento y rebote en los límites
        obj.mesh.position.addScaledVector(obj.velocity, delta);

        const boundary = 1000;
        if (Math.abs(obj.mesh.position.x) > boundary) obj.velocity.x *= -1;
        if (Math.abs(obj.mesh.position.y) > boundary) obj.velocity.y *= -1;
        if (Math.abs(obj.mesh.position.z) > boundary) obj.velocity.z *= -1;
    });

    // --- Lógica de recogida de coleccionables ---
    collectibles.forEach((obj, idx) => {
        if (obj.collected) return;
        // Animación de rotación
        obj.mesh.rotation.x += 0.7 * delta;
        obj.mesh.rotation.y += 1.1 * delta;
        // Detección de proximidad
        const dist = controls.getObject().position.distanceTo(obj.mesh.position);
        if (dist < 18) {
            obj.collected = true;
            scene.remove(obj.mesh);
            window.collectedCount++;
            collectibleCounter.textContent = TEXTS[currentLang].collectiblesCounter(window.collectedCount, collectibles.length);
            // Mensaje breve de recogida
            const nombre = geometryNamesMulti[idx % geometryNamesMulti.length][currentLang];
            pickupMsg.textContent = TEXTS[currentLang].collected(nombre);
            pickupMsg.style.display = 'block';
            setTimeout(() => { pickupMsg.style.display = 'none'; }, 1400);
            // Mensaje de felicitación personalizado y centrado
            if (window.collectedCount === collectibles.length) {
                const finalTime = (performance.now() - startTime) / 1000;
                lastTime = finalTime; // Guardar tiempo
                startTime = null; // Detiene el contador

                if (isNaN(bestTime) || finalTime < bestTime) {
                    bestTime = finalTime;
                    localStorage.setItem('bestTimeAlex3D', bestTime);
                }
                setTimeout(() => { showCongratsMsg(finalTime, bestTime); }, 800);
            }
        }
    });

    if (controls.isLocked && startTime) {
        const elapsedTime = (performance.now() - startTime) / 1000;
        timerUI.textContent = formatTime(elapsedTime);
    }

    renderer.render(scene, camera);
    prevTime = time;
}

document.addEventListener('keydown', function(event) {
    // Aquí no hay más lógica de música
});

// --- Animación de tipeo retro para el menú ---
function typeWriter(text, element, speed, callback) {
    let i = 0;
    function type() {
        if (i <= text.length) {
            element.textContent = text.slice(0, i);
            i++;
            setTimeout(type, speed);
        } else if (callback) {
            callback();
        }
    }
    type();
}

document.addEventListener('DOMContentLoaded', () => {
    updateTexts();
});

function updateTexts() {
  // Instrucciones del menú
  const titleEl = document.getElementById('type-title');
  const instrEl = document.getElementById('type-instructions');
  if (titleEl && instrEl) {
    titleEl.textContent = '';
    instrEl.textContent = '';
    typeWriter(TEXTS[currentLang].start, titleEl, 32, () => {
      setTimeout(() => {
        typeWriter([
          TEXTS[currentLang].move,
          TEXTS[currentLang].up,
          TEXTS[currentLang].down,
          TEXTS[currentLang].look,
          TEXTS[currentLang].run,
          TEXTS[currentLang].turbo
        ].join('\n'), instrEl, 12);
      }, 200);
    });
  }
  // Mensaje de felicitación
  if (congratsMsg && congratsMsg.style.display !== 'none') {
    const currentBest = parseFloat(localStorage.getItem('bestTimeAlex3D'));
    const bestTimeText = isNaN(currentBest) ? TEXTS[currentLang].noBestTime : formatTime(currentBest);
    congratsMsg.innerHTML = TEXTS[currentLang].congrats(formatTime(lastTime), bestTimeText);
    if (restartBtn) restartBtn.textContent = currentLang === 'es' ? 'Reiniciar' : 'Restart';
  }
  if (collectibleCounter) {
    collectibleCounter.textContent = TEXTS[currentLang].collectiblesCounter(window.collectedCount, window.collectibles.length);
  }
  if (turboMsg && turboMsg.style.display !== 'none') {
    if (turboActive) {
      turboMsg.textContent = TEXTS[currentLang].turboActive;
    } else if (turboCooldown) {
      turboMsg.textContent = TEXTS[currentLang].turboCooldown;
    }
  }
}

// Mensaje de felicitación genérico y centrado
function showCongratsMsg(currentTime, bestTimeValue) {
  const bestTimeText = isNaN(bestTimeValue) ? TEXTS[currentLang].noBestTime : formatTime(bestTimeValue);
  congratsMsg.innerHTML = TEXTS[currentLang].congrats(formatTime(currentTime), bestTimeText);
  congratsMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);font-size:2.2em;color:#0ff;font-family:monospace;background:rgba(0,0,0,0.92);padding:32px 48px;border-radius:18px;z-index:300;display:block;text-align:center;text-shadow:0 0 16px #000,0 0 32px #0ff;';
  showRestartButton();
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && restartBtn && congratsMsg.style.display !== 'none') {
        restartBtn.click();
    }
});

init();
animate(); 