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
    camera.position.set(0, 10, 20);

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
    });

    controls.addEventListener('unlock', () => {
        blocker.style.display = 'block';
        instructions.style.display = '';
    });
    
    scene.add(controls.getObject());

    // Lights
    scene.add(new THREE.AmbientLight(0x606060));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);
    
    // Grid
    const gridHelper = new THREE.GridHelper(2000, 200, 0x00ff00, 0x00ff00);
    scene.add(gridHelper);

    // Stars
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = [];
    for (let i = 0; i < 10000; i++) {
        starPositions.push(
            THREE.MathUtils.randFloatSpread(2000),
            THREE.MathUtils.randFloatSpread(2000),
            THREE.MathUtils.randFloatSpread(2000)
        );
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xffffff }));
    scene.add(stars);

    // Neon Objects
    const geometries = [ new THREE.BoxGeometry(1, 1, 1), new THREE.SphereGeometry(1, 32, 32), new THREE.ConeGeometry(1, 2, 32) ];
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

        objects.push({ 
            mesh, 
            rotationSpeed: { x: Math.random() * 0.005, y: Math.random() * 0.005 },
            velocity: velocity
        });
        scene.add(mesh);
    }

    // Turbo UI
    turboMsg = document.createElement('div');
    turboMsg.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);font-size:1.5em;color:#0ff;font-weight:bold;text-shadow:0 0 5px #0ff;z-index:100;display:none;';
    document.body.appendChild(turboMsg);

    // Event Listeners
    document.addEventListener('contextmenu', (event) => event.preventDefault()); // Evita el menú contextual
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onWindowResize);
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
    turboMsg.textContent = 'TURBO';
    turboMsg.style.display = 'block';

    turboTimeout = setTimeout(() => {
        turboActive = false;
        turboMsg.textContent = 'Turbo en Enfriamiento...';
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
        // --- Lógica de Vuelo 6-DOF ---
        
        // 1. Vector de aceleración basado en la entrada
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

        // 2. Aplicar velocidad a la posición
        controls.getObject().position.addScaledVector(velocity, delta);

        // 3. Aplicar fricción/amortiguación
        velocity.multiplyScalar(1 - (3 * delta));

        // Zoom con click derecho
        const targetFov = isZoomed ? zoomFov : defaultFov;
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 10 * delta);
        camera.updateProjectionMatrix();
    }

    objects.forEach(obj => {
        // Rotación
        obj.mesh.rotation.x += obj.rotationSpeed.x * delta;
        obj.mesh.rotation.y += obj.rotationSpeed.y * delta;

        // Movimiento y rebote en los límites
        obj.mesh.position.addScaledVector(obj.velocity, delta);

        const boundary = 1000;
        if (Math.abs(obj.mesh.position.x) > boundary) obj.velocity.x *= -1;
        if (Math.abs(obj.mesh.position.y) > boundary) obj.velocity.y *= -1;
        if (Math.abs(obj.mesh.position.z) > boundary) obj.velocity.z *= -1;
    });

    renderer.render(scene, camera);
    prevTime = time;
}

document.addEventListener('keydown', function(event) {
    if (event.code === 'KeyM') {
        if (audio.paused) {
            audio.play();
            musicPaused = false;
            musicMsg.style.display = 'none';
        } else {
            audio.pause();
            musicPaused = true;
            musicMsg.textContent = 'Música en pausa (M para reanudar)';
            musicMsg.style.display = 'block';
        }
    }
});

// Reproducir música al primer click del usuario (por políticas del navegador)
document.body.addEventListener('click', () => {
    if (audio.paused && !musicPaused) {
        audio.play();
    }
}, { once: true });

init();
animate(); 