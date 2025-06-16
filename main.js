// Mensaje de inicio
console.log('Iniciando aplicación 3D...');

// Configuración inicial
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.y = 2;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Cuadrícula verde estilo Tron
const gridHelper = new THREE.GridHelper(1000, 200, 0x00ff00, 0x00ff00);
scene.add(gridHelper);

// Iluminación
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0x00ff00, 1, 100);
pointLight.position.set(10, 10, 10);
scene.add(pointLight);

// Controles en primera persona
const controls = new THREE.PointerLockControls(camera, document.body);
scene.add(controls.getObject());

// Elemento de información
const infoElement = document.getElementById('info');

// Eventos de los controles
controls.addEventListener('lock', () => {
    infoElement.style.display = 'none';
});

controls.addEventListener('unlock', () => {
    infoElement.style.display = 'block';
});

// Evento para activar controles
document.addEventListener('click', () => {
    controls.lock();
});

// Variables de movimiento
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let isRunning = false;
let canJump = true;
let isRightMouseDown = false;

let prevTime = performance.now();

const baseMoveSpeed = 200.0;
const runSpeedMultiplier = 3.0;
const jumpStrength = 150.0;
const gravity = 9.8 * 10;
const defaultFOV = 75;
const zoomFOV = 35;
const zoomSpeed = 5;

// Eventos de teclado
document.addEventListener('keydown', (event) => {
    switch (event.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyD': moveRight = true; break;
        case 'ShiftLeft':
        case 'ShiftRight': isRunning = true; break;
        case 'Space':
            if (canJump === true) {
                velocity.y += jumpStrength;
                canJump = false;
            }
            break;
    }
});

document.addEventListener('keyup', (event) => {
    switch (event.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyD': moveRight = false; break;
        case 'ShiftLeft':
        case 'ShiftRight': isRunning = false; break;
    }
});

// Eventos del ratón para el zoom
document.addEventListener('mousedown', (event) => {
    if (event.button === 2) {
        isRightMouseDown = true;
    }
});

document.addEventListener('mouseup', (event) => {
    if (event.button === 2) {
        isRightMouseDown = false;
    }
});

// Crear objetos geométricos flotantes
const geometries = [
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.SphereGeometry(0.5, 32, 32),
    new THREE.ConeGeometry(0.5, 1, 32)
];

const materials = [
    new THREE.MeshPhongMaterial({ color: 0x00ff00, wireframe: true }),
    new THREE.MeshPhongMaterial({ color: 0x00ffff, wireframe: true }),
    new THREE.MeshPhongMaterial({ color: 0xff00ff, wireframe: true }),
    // Materiales sólidos
    new THREE.MeshPhongMaterial({ color: 0x00ff00, flatShading: true }),
    new THREE.MeshPhongMaterial({ color: 0x00ffff, flatShading: true }),
    new THREE.MeshPhongMaterial({ color: 0xff00ff, flatShading: true })
];

const objects = [];
const numTotalObjects = 30;
const numGiantObjects = 4;
const numSurfaceObjects = 5;

for (let i = 0; i < numTotalObjects; i++) {
    const geometry = geometries[Math.floor(Math.random() * geometries.length)];
    const material = materials[Math.floor(Math.random() * materials.length)];
    const mesh = new THREE.Mesh(geometry, material);
    
    const maxRange = 500;

    if (i < numGiantObjects) {
        const scaleFactor = Math.random() * 10 + 10;
        mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
        mesh.position.set(
            Math.random() * maxRange - (maxRange / 2),
            Math.random() * 100 + 30,
            Math.random() * maxRange - (maxRange / 2)
        );
    } else if (i < numGiantObjects + numSurfaceObjects) {
        const desiredHeightForSurfaceObjects = 2.0;
        let baseGeometryHeight = 1; 
        if (geometry instanceof THREE.SphereGeometry) {
            baseGeometryHeight = geometry.parameters.radius * 2; 
        } else if (geometry instanceof THREE.ConeGeometry) {
             baseGeometryHeight = geometry.parameters.height; 
        }
        const scaleFactor = (desiredHeightForSurfaceObjects / baseGeometryHeight) * (0.9 + Math.random() * 0.2); 
        mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
        let surfaceY = 0; 
        if (geometry instanceof THREE.BoxGeometry) {
            surfaceY = (geometry.parameters.height / 2) * scaleFactor; 
        } else if (geometry instanceof THREE.SphereGeometry) {
            surfaceY = geometry.parameters.radius * scaleFactor; 
        } else if (geometry instanceof THREE.ConeGeometry) {
            surfaceY = (geometry.parameters.height / 2) * scaleFactor; 
        }
        mesh.position.set(
            Math.random() * maxRange - (maxRange / 2),
            surfaceY, 
            Math.random() * maxRange - (maxRange / 2)
        );
    } else {
        mesh.position.set(
            Math.random() * maxRange - (maxRange / 2),
            Math.random() * 50 + 10,
            Math.random() * maxRange - (maxRange / 2)
        );
    }
    
    mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
    );
    
    objects.push({
        mesh: mesh,
        rotationSpeed: {
            x: Math.random() * 0.02 - 0.01,
            y: Math.random() * 0.02 - 0.01,
            z: Math.random() * 0.02 - 0.01
        }
    });
    
    scene.add(mesh);
}

// Función de animación
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    // Actualizar movimiento
    if (controls.isLocked) {
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        const currentMoveSpeed = baseMoveSpeed * (isRunning ? runSpeedMultiplier : 1.0);

        if (moveForward || moveBackward) {
            velocity.z += direction.z * currentMoveSpeed * delta;
        }
        if (moveLeft || moveRight) {
            velocity.x += direction.x * currentMoveSpeed * delta;
        }

        controls.moveForward(velocity.z * delta);
        controls.moveRight(velocity.x * delta);

        // Aplicar gravedad
        velocity.y -= gravity * delta;
        controls.getObject().position.y += velocity.y * delta;

        if (controls.getObject().position.y < 2) {
            velocity.y = 0;
            controls.getObject().position.y = 2;
            canJump = true;
        }

        const targetFOV = isRightMouseDown ? zoomFOV : defaultFOV;
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFOV, zoomSpeed * delta);
        camera.updateProjectionMatrix();
    }

    // Animar objetos flotantes
    objects.forEach(obj => {
        obj.mesh.rotation.x += obj.rotationSpeed.x;
        obj.mesh.rotation.y += obj.rotationSpeed.y;
        obj.mesh.rotation.z += obj.rotationSpeed.z;
    });

    renderer.render(scene, camera);
    prevTime = time;
}

// Manejar redimensionamiento de ventana
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Iniciar la animación
console.log('Iniciando animación...');
animate(); 