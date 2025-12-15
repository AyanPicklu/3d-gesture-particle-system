import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.Fog(0x000000, 10, 50);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 15;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('canvas-container').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Particle system
let particles, particleGeometry, particleMaterial;
let particleCount = 10000;
let currentTemplate = 'sphere';
let baseColor = new THREE.Color(0x00ffff);

// Gesture state
let gestureState = {
    expansion: 1.0,
    rotation: 0,
    colorShift: 0,
    detected: 'none'
};

// Hand tracking
let hands, camera_utils;
const videoElement = document.getElementById('video');
const statusElement = document.getElementById('status');
const loadingElement = document.getElementById('loading');

// Particle templates
const templates = {
    sphere: (i, total) => {
        const phi = Math.acos(-1 + (2 * i) / total);
        const theta = Math.sqrt(total * Math.PI) * phi;
        const radius = 5;
        return new THREE.Vector3(
            radius * Math.cos(theta) * Math.sin(phi),
            radius * Math.sin(theta) * Math.sin(phi),
            radius * Math.cos(phi)
        );
    },
    
    heart: (i, total) => {
        const t = (i / total) * Math.PI * 2;
        const u = (i % 100) / 100;
        const x = 5 * (16 * Math.pow(Math.sin(t), 3));
        const y = 5 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        const z = (u - 0.5) * 3;
        return new THREE.Vector3(x * 0.3, y * 0.3, z);
    },
    
    flower: (i, total) => {
        const angle = (i / total) * Math.PI * 2;
        const layer = Math.floor(i / (total / 5));
        const radius = 3 + Math.sin(angle * 5) * 2;
        const height = (layer - 2.5) * 1.5;
        return new THREE.Vector3(
            radius * Math.cos(angle),
            height,
            radius * Math.sin(angle)
        );
    },
    
    saturn: (i, total) => {
        const ringParticles = total * 0.6;
        if (i < ringParticles) {
            const angle = (i / ringParticles) * Math.PI * 2;
            const radius = 5 + Math.random() * 2;
            return new THREE.Vector3(
                radius * Math.cos(angle),
                (Math.random() - 0.5) * 0.5,
                radius * Math.sin(angle)
            );
        } else {
            const phi = Math.acos(-1 + (2 * (i - ringParticles)) / (total - ringParticles));
            const theta = Math.sqrt((total - ringParticles) * Math.PI) * phi;
            const radius = 3;
            return new THREE.Vector3(
                radius * Math.cos(theta) * Math.sin(phi),
                radius * Math.sin(theta) * Math.sin(phi),
                radius * Math.cos(phi)
            );
        }
    },
    
    fireworks: (i, total) => {
        const burstCount = 8;
        const particlesPerBurst = total / burstCount;
        const burstIndex = Math.floor(i / particlesPerBurst);
        const particleInBurst = i % particlesPerBurst;
        
        const burstAngle = (burstIndex / burstCount) * Math.PI * 2;
        const burstRadius = 3;
        const burstCenter = new THREE.Vector3(
            burstRadius * Math.cos(burstAngle),
            (Math.random() - 0.5) * 4,
            burstRadius * Math.sin(burstAngle)
        );
        
        const phi = Math.acos(-1 + (2 * particleInBurst) / particlesPerBurst);
        const theta = Math.sqrt(particlesPerBurst * Math.PI) * phi;
        const explosionRadius = 1.5;
        
        return new THREE.Vector3(
            burstCenter.x + explosionRadius * Math.cos(theta) * Math.sin(phi),
            burstCenter.y + explosionRadius * Math.sin(theta) * Math.sin(phi),
            burstCenter.z + explosionRadius * Math.cos(phi)
        );
    },
    
    spiral: (i, total) => {
        const t = (i / total) * Math.PI * 8;
        const radius = t * 0.5;
        const height = (i / total - 0.5) * 10;
        return new THREE.Vector3(
            radius * Math.cos(t),
            height,
            radius * Math.sin(t)
        );
    },
    
    cube: (i, total) => {
        const side = Math.cbrt(total);
        const x = (i % side) - side / 2;
        const y = (Math.floor(i / side) % side) - side / 2;
        const z = (Math.floor(i / (side * side))) - side / 2;
        const spacing = 10 / side;
        return new THREE.Vector3(x * spacing, y * spacing, z * spacing);
    },
    
    wave: (i, total) => {
        const gridSize = Math.sqrt(total);
        const x = (i % gridSize) - gridSize / 2;
        const z = (Math.floor(i / gridSize)) - gridSize / 2;
        const spacing = 10 / gridSize;
        const y = Math.sin(x * 0.5) * Math.cos(z * 0.5) * 2;
        return new THREE.Vector3(x * spacing, y, z * spacing);
    }
};

// Initialize particles
function createParticles() {
    if (particles) {
        scene.remove(particles);
        particleGeometry.dispose();
        particleMaterial.dispose();
    }

    particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const templateFunc = templates[currentTemplate];

    for (let i = 0; i < particleCount; i++) {
        const pos = templateFunc(i, particleCount);
        positions[i * 3] = pos.x;
        positions[i * 3 + 1] = pos.y;
        positions[i * 3 + 2] = pos.z;

        const color = baseColor.clone();
        color.offsetHSL((i / particleCount) * 0.1, 0, 0);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        sizes[i] = Math.random() * 2 + 1;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    particleMaterial = new THREE.PointsMaterial({
        size: 0.1,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true
    });

    particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);
}

// Update particles based on gestures
function updateParticles() {
    if (!particles) return;

    particles.scale.setScalar(gestureState.expansion);
    particles.rotation.y += gestureState.rotation * 0.01;

    const colors = particleGeometry.attributes.color.array;
    const positions = particleGeometry.attributes.position.array;

    for (let i = 0; i < particleCount; i++) {
        const color = new THREE.Color();
        color.setHSL(
            (gestureState.colorShift + (i / particleCount) * 0.1) % 1,
            0.8,
            0.5
        );
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        // Add subtle animation
        const time = Date.now() * 0.001;
        positions[i * 3 + 1] += Math.sin(time + i * 0.1) * 0.002;
    }

    particleGeometry.attributes.color.needsUpdate = true;
    particleGeometry.attributes.position.needsUpdate = true;
}

// Hand tracking setup
async function setupHandTracking() {
    try {
        hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        hands.onResults(onHandResults);

        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement.srcObject = stream;

        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                videoElement.play();
                resolve();
            };
        });

        const camera = new Camera(videoElement, {
            onFrame: async () => {
                await hands.send({ image: videoElement });
            },
            width: 640,
            height: 480
        });

        camera.start();
        loadingElement.style.display = 'none';
        statusElement.textContent = 'Hand tracking active';
    } catch (error) {
        console.error('Hand tracking error:', error);
        loadingElement.textContent = 'Camera access denied';
        statusElement.textContent = 'Using mouse controls';
    }
}

// Detect gestures
function detectGesture(landmarks) {
    const fingers = [];
    
    // Thumb
    fingers.push(landmarks[4].x < landmarks[3].x);
    
    // Other fingers
    for (let i = 0; i < 4; i++) {
        const tip = landmarks[8 + i * 4];
        const pip = landmarks[6 + i * 4];
        fingers.push(tip.y < pip.y);
    }

    const extendedCount = fingers.filter(f => f).length;

    if (extendedCount === 5) return 'open_hand';
    if (extendedCount === 0) return 'fist';
    if (extendedCount === 1 && fingers[1]) return 'point';
    if (extendedCount === 2 && fingers[1] && fingers[2]) return 'peace';
    
    return 'unknown';
}

// Handle hand results
function onHandResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        const gesture = detectGesture(landmarks);
        gestureState.detected = gesture;

        switch (gesture) {
            case 'open_hand':
                gestureState.expansion = Math.min(gestureState.expansion + 0.02, 2.0);
                statusElement.textContent = '✋ Expanding';
                break;
            case 'fist':
                gestureState.expansion = Math.max(gestureState.expansion - 0.02, 0.3);
                statusElement.textContent = '✊ Contracting';
                break;
            case 'point':
                gestureState.rotation += 1;
                statusElement.textContent = '👆 Rotating';
                break;
            case 'peace':
                gestureState.colorShift = (gestureState.colorShift + 0.01) % 1;
                statusElement.textContent = '✌️ Color Shifting';
                break;
            default:
                statusElement.textContent = 'Hand detected';
        }
    } else {
        statusElement.textContent = 'No hands detected';
    }
}

// UI Controls
document.getElementById('template-select').addEventListener('change', (e) => {
    currentTemplate = e.target.value;
    createParticles();
});

document.getElementById('particle-count').addEventListener('input', (e) => {
    particleCount = parseInt(e.target.value);
    document.getElementById('count-value').textContent = particleCount;
    createParticles();
});

document.getElementById('color-picker').addEventListener('input', (e) => {
    baseColor = new THREE.Color(e.target.value);
    createParticles();
});

document.getElementById('reset-btn').addEventListener('click', () => {
    camera.position.set(0, 0, 15);
    controls.reset();
    gestureState = { expansion: 1.0, rotation: 0, colorShift: 0, detected: 'none' };
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    updateParticles();
    controls.update();
    renderer.render(scene, camera);
}

// Window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize
createParticles();
setupHandTracking();
animate();