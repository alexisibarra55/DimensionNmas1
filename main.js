/**
 * Archivo principal para la aplicación 3D de "Dimensión N+1" (inspirado en Homer³).
 * Utiliza Three.js para crear una escena interactiva con movimiento en primera persona, 
 * objetos flotantes y una cuadrícula estilo Tron.
 */

// Mensaje de inicio en la consola del navegador
console.log('Iniciando aplicación 3D...');

// --- Configuración Básica de la Escena 3D ---

// Crea la escena donde se añadirán todos los objetos, cámaras y luces
const scene = new THREE.Scene();

// Configura la cámara de perspectiva (FOV, Aspecto, Near, Far)
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.y = 2; // Posiciona la cámara a una altura inicial sobre la cuadrícula

// Crea el renderizador WebGL y establece su tamaño al de la ventana del navegador
const renderer = new THREE.WebGLRenderer({ antialias: true }); // antialias mejora la calidad visual
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement); // Añade el canvas al cuerpo del documento HTML

// Cuadrícula verde estilo Tron (visualización de la "superficie")
const gridHelper = new THREE.GridHelper(1000, 200, 0x00ff00, 0x00ff00); // Tamaño: 1000x1000, divisiones: 200, colores: verde
scene.add(gridHelper);

// --- Iluminación de la Escena ---

// Luz ambiental: ilumina uniformemente todos los objetos en la escena, sin fuente direccional
const ambientLight = new THREE.AmbientLight(0x404040); // Luz tenue grisácea
scene.add(ambientLight);

// Luz de punto: una luz que emite desde un único punto en todas direcciones (simula una bombilla)
const pointLight = new THREE.PointLight(0x00ff00, 1, 100); // Color verde, intensidad 1, distancia 100
pointLight.position.set(10, 10, 10); // Posición de la luz
scene.add(pointLight);

// --- Controles de Movimiento en Primera Persona ---

// Crea los controles de bloqueo de puntero para movimiento en primera persona
const controls = new THREE.PointerLockControls(camera, document.body);
scene.add(controls.getObject()); // Añade el objeto que controla la cámara a la escena

// Elemento HTML para mostrar información al usuario (ej. "Haz clic para comenzar")
const infoElement = document.getElementById('info');

// Eventos para mostrar/ocultar el mensaje de información al bloquear/desbloquear los controles
controls.addEventListener('lock', () => {
    infoElement.style.display = 'none'; // Oculta el mensaje cuando los controles están activos
});

controls.addEventListener('unlock', () => {
    infoElement.style.display = 'block'; // Muestra el mensaje cuando los controles están inactivos
});

// Evento para activar los controles al hacer clic en cualquier parte del documento
document.addEventListener('click', () => {
    controls.lock(); // Bloquea el puntero y activa los controles
});

// --- Variables de Estado para el Movimiento del Jugador ---

// Vector de velocidad para aplicar al movimiento de la cámara
const velocity = new THREE.Vector3();
// Vector de dirección para determinar el movimiento basado en las teclas pulsadas
const direction = new THREE.Vector3();

// Banderas para el estado de movimiento (WASD)
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let isRunning = false;      // Indica si el jugador está corriendo (Shift presionado)
let canJump = true;         // Controla si el jugador puede saltar (evita saltos múltiples en el aire)
let isRightMouseDown = false; // Indica si el botón derecho del ratón está presionado (para zoom)

// Tiempo para calcular el delta (diferencia de tiempo entre fotogramas) para un movimiento consistente
let prevTime = performance.now();

// --- Parámetros de Movimiento y Cámara ---

const baseMoveSpeed = 200.0;     // Velocidad base de movimiento del jugador
const runSpeedMultiplier = 3.0; // Multiplicador de velocidad al correr
const jumpStrength = 150.0;     // Fuerza aplicada al saltar
const gravity = 9.8 * 10;       // Simulación de gravedad (ajustada para el entorno 3D)

const defaultFOV = 75; // Campo de visión (Field of View) por defecto de la cámara
const zoomFOV = 35;    // Campo de visión cuando se hace zoom (clic derecho)
const zoomSpeed = 5;   // Velocidad de interpolación del zoom

// --- Manejo de Eventos de Teclado ---

document.addEventListener('keydown', (event) => {
    switch (event.code) {
        case 'KeyW': moveForward = true; break; // Mover hacia adelante
        case 'KeyA': moveLeft = true; break;     // Mover hacia la izquierda
        case 'KeyS': moveBackward = true; break; // Mover hacia atrás
        case 'KeyD': moveRight = true; break;    // Mover hacia la derecha
        case 'ShiftLeft':
        case 'ShiftRight': isRunning = true; break; // Activar el modo correr
        case 'Space':
            if (canJump === true) {
                velocity.y += jumpStrength; // Aplica una fuerza vertical para el salto
                canJump = false;            // Evita saltos repetidos en el aire
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
        case 'ShiftRight': isRunning = false; break; // Desactivar el modo correr
    }
});

// --- Manejo de Eventos del Ratón (para el Zoom) ---

document.addEventListener('mousedown', (event) => {
    if (event.button === 2) { // Botón derecho del ratón (0: Izquierdo, 1: Rueda, 2: Derecho)
        isRightMouseDown = true;
    }
});

document.addEventListener('mouseup', (event) => {
    if (event.button === 2) { // Botón derecho del ratón
        isRightMouseDown = false;
    }
});

// --- Creación y Configuración de Objetos Geométricos Flotantes ---

// Define los tipos de geometrías que se usarán para los objetos
const geometries = [
    new THREE.BoxGeometry(1, 1, 1),     // Cubo
    new THREE.SphereGeometry(0.5, 32, 32), // Esfera
    new THREE.ConeGeometry(0.5, 1, 32)   // Cono
];

// Define los materiales para los objetos (wireframe y sólidos)
const materials = [
    new THREE.MeshPhongMaterial({ color: 0x00ff00, wireframe: true }), // Verde wireframe
    new THREE.MeshPhongMaterial({ color: 0x00ffff, wireframe: true }), // Cian wireframe
    new THREE.MeshPhongMaterial({ color: 0xff00ff, wireframe: true }), // Magenta wireframe
    // Materiales sólidos (con sombreado plano para un estilo más geométrico)
    new THREE.MeshPhongMaterial({ color: 0x00ff00, flatShading: true }),
    new THREE.MeshPhongMaterial({ color: 0x00ffff, flatShading: true }),
    new THREE.MeshPhongMaterial({ color: 0xff00ff, flatShading: true })
];

const objects = []; // Array para almacenar las mallas de los objetos y sus propiedades de animación

// Parámetros para la generación de objetos
const numTotalObjects = 30;    // Número total de objetos en la escena
const numGiantObjects = 4;     // Cuántos de esos objetos serán gigantes
const numSurfaceObjects = 5; // Cuántos objetos se colocarán en la superficie de la cuadrícula

// Bucle para crear y posicionar los objetos en la escena
for (let i = 0; i < numTotalObjects; i++) {
    // Selecciona una geometría y un material aleatorio para cada objeto
    const geometry = geometries[Math.floor(Math.random() * geometries.length)];
    const material = materials[Math.floor(Math.random() * materials.length)];
    const mesh = new THREE.Mesh(geometry, material);
    
    const maxRange = 500; // Rango máximo de dispersión de los objetos en X y Z

    // Lógica para determinar el tipo y la posición del objeto (gigante, en superficie o flotante normal)
    if (i < numGiantObjects) {
        // Objetos gigantes: flotan a mayor altura y son escalados
        const scaleFactor = Math.random() * 10 + 10; // Escala grande aleatoria (entre 10 y 20)
        mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
        mesh.position.set(
            Math.random() * maxRange - (maxRange / 2), // Posición X aleatoria dentro del rango
            Math.random() * 100 + 30,                 // Altura aleatoria (entre 30 y 130)
            Math.random() * maxRange - (maxRange / 2)  // Posición Z aleatoria dentro del rango
        );
    } else if (i < numGiantObjects + numSurfaceObjects) {
        // Objetos en la superficie de la cuadrícula: ajustados para sentarse sobre ella
        const desiredHeightForSurfaceObjects = 2.0; // Altura deseada sobre el suelo para el punto más bajo del objeto
        let baseGeometryHeight = 1; 
        // Determina la altura base de la geometría para calcular la escala correcta
        if (geometry instanceof THREE.SphereGeometry) {
            baseGeometryHeight = geometry.parameters.radius * 2; 
        } else if (geometry instanceof THREE.ConeGeometry) {
             baseGeometryHeight = geometry.parameters.height; 
        }
        // Calcula el factor de escala para que el objeto tenga la altura deseada y se vea proporcionado
        const scaleFactor = (desiredHeightForSurfaceObjects / baseGeometryHeight) * (0.9 + Math.random() * 0.2); 
        mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
        let surfaceY = 0; 
        // Calcula la posición Y para que la base del objeto esté en la superficie de la cuadrícula
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
        // Objetos de tamaño normal: flotan a una altura media
        mesh.position.set(
            Math.random() * maxRange - (maxRange / 2),
            Math.random() * 50 + 10,  // Altura aleatoria (entre 10 y 60)
            Math.random() * maxRange - (maxRange / 2)
        );
    }
    
    // Establece una rotación inicial aleatoria para cada objeto
    mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
    );
    
    // Almacena la malla y sus velocidades de rotación para la animación
    objects.push({
        mesh: mesh,
        rotationSpeed: {
            x: Math.random() * 0.02 - 0.01,
            y: Math.random() * 0.02 - 0.01,
            z: Math.random() * 0.02 - 0.01
        }
    });
    
    scene.add(mesh); // Añade el objeto a la escena
}

// --- Bucle Principal de Animación (Render Loop) ---

/**
 * `animate()` es la función que se llama repetidamente (aproximadamente 60 veces por segundo)
 * para actualizar la lógica de la escena y renderizar cada fotograma.
 */
function animate() {
    // Solicita al navegador que llame a `animate` en el siguiente fotograma disponible
    requestAnimationFrame(animate);

    // Calcula el tiempo transcurrido (delta) desde el último fotograma para un movimiento consistente
    const time = performance.now();
    const delta = (time - prevTime) / 1000; // Convertir a segundos

    // --- Lógica de Actualización de Movimiento del Jugador ---
    if (controls.isLocked) {
        // Aplica un efecto de "damping" o frenado para que el movimiento no sea instantáneo
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        // Determina la dirección del movimiento basada en las teclas (WASD)
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize(); // Normaliza el vector para evitar movimientos más rápidos en diagonal

        // Calcula la velocidad de movimiento actual (base o corriendo)
        const currentMoveSpeed = baseMoveSpeed * (isRunning ? runSpeedMultiplier : 1.0);

        // Aplica la velocidad en las direcciones X y Z
        if (moveForward || moveBackward) {
            velocity.z += direction.z * currentMoveSpeed * delta;
        }
        if (moveLeft || moveRight) {
            velocity.x += direction.x * currentMoveSpeed * delta;
        }

        // Mueve los controles (y por ende la cámara) basados en la velocidad calculada
        controls.moveForward(velocity.z * delta);
        controls.moveRight(velocity.x * delta);

        // --- Aplicación de Gravedad y Salto ---
        velocity.y -= gravity * delta; // Reduce la velocidad vertical debido a la gravedad
        controls.getObject().position.y += velocity.y * delta; // Aplica la velocidad vertical a la cámara

        // Simula el "suelo": si la cámara está por debajo de cierta altura, la sube y resetea la velocidad vertical
        if (controls.getObject().position.y < 2) {
            velocity.y = 0; // Detiene la caída
            controls.getObject().position.y = 2; // Coloca la cámara en el "suelo"
            canJump = true; // Permite saltar de nuevo
        }

        // --- Control de Zoom de la Cámara (clic derecho) ---
        const targetFOV = isRightMouseDown ? zoomFOV : defaultFOV; // FOV objetivo (zoom o normal)
        // Interpola suavemente el FOV actual de la cámara hacia el FOV objetivo
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFOV, zoomSpeed * delta); 
        camera.updateProjectionMatrix(); // Necesario para aplicar los cambios en el FOV
    }

    // --- Animación de Objetos Flotantes ---
    objects.forEach(obj => {
        // Rotar cada objeto en sus ejes X, Y, Z según sus velocidades de rotación
        obj.mesh.rotation.x += obj.rotationSpeed.x;
        obj.mesh.rotation.y += obj.rotationSpeed.y;
        obj.mesh.rotation.z += obj.rotationSpeed.z;
    });

    // Renderiza la escena desde la perspectiva de la cámara
    renderer.render(scene, camera);
    prevTime = time; // Actualiza el tiempo para el cálculo del delta en el siguiente fotograma
}

// --- Manejo de Redimensionamiento de Ventana ---

// Escucha el evento de redimensionamiento de la ventana del navegador
window.addEventListener('resize', () => {
    // Actualiza la relación de aspecto de la cámara para que la escena no se distorsione
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix(); // Necesario para aplicar la nueva relación de aspecto
    // Ajusta el tamaño del renderizador al nuevo tamaño de la ventana
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Inicio de la Aplicación ---

// Muestra un mensaje en la consola indicando que la animación está por comenzar
console.log('Iniciando animación...');
// Llama a la función `animate` por primera vez para iniciar el bucle de renderizado
animate(); 