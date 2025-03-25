import * as THREE from 'https://unpkg.com/three/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'https://unpkg.com/three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Create a canvas texture for a colored face with a letter label
function createFaceTexture(color, letter) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    // Fill the background
    context.fillStyle = color;
    context.fillRect(0, 0, size, size);
    // Draw the letter
    context.font = 'bold 150px Arial';
    context.fillStyle = '#000000';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(letter, size / 2, size / 2);
    return new THREE.CanvasTexture(canvas);
}

function createFaceMaterial(color, letter) {
    return new THREE.MeshBasicMaterial({ map: createFaceTexture(color, letter) });
}

// Colors and letters for each side:
// Right (index 0): letter 'D', Left (index 1): 'C',
// Top (index 2): 'E', Bottom (index 3): 'F',
// Front (index 4): 'A', Back (index 5): 'B'
const faceDefinitions = [
    { color: '#00ff00', letter: 'D' }, // right
    { color: '#0000ff', letter: 'C' }, // left
    { color: '#ffffff', letter: 'E' }, // top
    { color: '#ffff00', letter: 'F' }, // bottom
    { color: '#ff00a5', letter: 'A' }, // front
    { color: '#a50000', letter: 'B' }  // back
];

// Default material happens to be shadows, cracks, and between cubies
const defaultMaterial = new THREE.MeshBasicMaterial({ color: 0x111111});

// Initialize the scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Add OrbitControls to allow cube rotation via gestures
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Create a group to contain all cube pieces (cubies)
const rubyCube = new THREE.Group();
scene.add(rubyCube);

// Parameters for a Rubik's cube - adjust numPerAxis (3-9) to change cube dimension
const cubieSize = 1;
const gap = 0.05;
// Change this value to a number between 3 and 9 as desired
const numPerAxis = 5;
const offset = ((numPerAxis - 1) * (cubieSize + gap)) / 2;

// Create cubies with per-face materials
for (let i = 0; i < numPerAxis; i++) {
    for (let j = 0; j < numPerAxis; j++) {
        for (let k = 0; k < numPerAxis; k++) {
            const geometry = new RoundedBoxGeometry(cubieSize, cubieSize, cubieSize, 2, cubieSize * 0.1);            // Prepare an array of six materials for this cubie.
            const materials = geometry.groups.map(() => defaultMaterial);
            
            // Compute cubie position
            const x = i * (cubieSize + gap) - offset;
            const y = j * (cubieSize + gap) - offset;
            const z = k * (cubieSize + gap) - offset;
            
            // For each face, check if this cubie is on the outer boundary.
            // Note: BoxGeometry face order:
            // 0: right, 1: left, 2: top, 3: bottom, 4: front, 5: back.
            // Use an epsilon for floating point comparisons.
            const eps = 0.001;
            if (Math.abs(x - offset) < eps) { // right
                materials[0] = createFaceMaterial(faceDefinitions[0].color, faceDefinitions[0].letter);
            }
            if (Math.abs(x + offset) < eps) { // left
                materials[1] = createFaceMaterial(faceDefinitions[1].color, faceDefinitions[1].letter);
            }
            if (Math.abs(y - offset) < eps) { // top
                materials[2] = createFaceMaterial(faceDefinitions[2].color, faceDefinitions[2].letter);
            }
            if (Math.abs(y + offset) < eps) { // bottom
                materials[3] = createFaceMaterial(faceDefinitions[3].color, faceDefinitions[3].letter);
            }
            if (Math.abs(z - offset) < eps) { // front
                materials[4] = createFaceMaterial(faceDefinitions[4].color, faceDefinitions[4].letter);
            }
            if (Math.abs(z + offset) < eps) { // back
                materials[5] = createFaceMaterial(faceDefinitions[5].color, faceDefinitions[5].letter);
            }
            
            const cubie = new THREE.Mesh(geometry, materials);
            cubie.position.set(x, y, z);
            rubyCube.add(cubie);
        }
    }
}

// Position the camera so that the whole cube is visible
camera.position.z = 2 + numPerAxis;

// Global queue and flag for rotations
let isRotating = false;
const rotationQueue = [];

function rotateFace(face, angle) {
    // If a rotation is already in progress, queue the new request and exit.
    if (isRotating) {
        rotationQueue.push({ face, angle });
        return;
    }
    isRotating = true;

    const threshold = (cubieSize + gap) / 2;
    const rotatingCubies = [];
    console.log(`Rotating face ${face} by ${angle} radians`);
    // Select cubies on the target face
    rubyCube.children.forEach(cubie => {
        if (
            (face === 'front'  && cubie.position.z > offset - threshold) ||
            (face === 'back'   && cubie.position.z < -offset + threshold) ||
            (face === 'left'   && cubie.position.x < -offset + threshold) ||
            (face === 'right'  && cubie.position.x > offset - threshold) ||
            (face === 'top'    && cubie.position.y > offset - threshold) ||
            (face === 'bottom' && cubie.position.y < -offset + threshold)
        ) {
            rotatingCubies.push(cubie);
        }
    });
    
    // Create a temporary group and reparent the selected cubies
    const tempGroup = new THREE.Group();
    scene.add(tempGroup);
    rotatingCubies.forEach(cubie => {
        rubyCube.remove(cubie);
        tempGroup.add(cubie);
    });
    
    // Determine the rotation axis based on face
    let rotationAxis = new THREE.Vector3();
    if (face === 'front' || face === 'back') {
        rotationAxis.set(0, 0, 1);
    } else if (face === 'left' || face === 'right') {
        rotationAxis.set(1, 0, 0);
    } else if (face === 'top' || face === 'bottom') {
        rotationAxis.set(0, 1, 0);
    }
    
    // Set up for smooth rotation using quaternion interpolation (slerp)
    const duration = 150; // duration in milliseconds
    const startTime = performance.now();
    const initialQuat = tempGroup.quaternion.clone();    
    // Compute target quaternion (rotation about axis by given angle)
    const deltaQuat = new THREE.Quaternion().setFromAxisAngle(rotationAxis, angle);
    const targetQuat = deltaQuat.multiply(initialQuat);
    
    // Animation function for smooth rotation transition
    function animateRotation(now) {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        tempGroup.quaternion.copy(initialQuat);
        tempGroup.quaternion.slerp(targetQuat, t);
        if (t < 1) {
            requestAnimationFrame(animateRotation);
        } else {
            tempGroup.updateMatrixWorld();
            rotatingCubies.forEach(cubie => {
                tempGroup.remove(cubie);
                cubie.applyMatrix4(tempGroup.matrixWorld);
                rubyCube.add(cubie);
            });
            scene.remove(tempGroup);
            isRotating = false;
            // Check if any rotations are queued. If yes, trigger the next one.
            if(rotationQueue.length > 0) {
                const next = rotationQueue.shift();
                rotateFace(next.face, next.angle);
            }
        }
    }
    
    requestAnimationFrame(animateRotation);
}

// Key mapping: lowercase = +90°, uppercase = -90°
window.addEventListener('keydown', e => {
    let angle;
    switch (e.key) {
        case 'a': angle = Math.PI / 2; rotateFace('front', angle); break;
        case 'A': angle = -Math.PI / 2; rotateFace('front', angle); break;
        case 'b': angle = Math.PI / 2; rotateFace('back', angle); break;
        case 'B': angle = -Math.PI / 2; rotateFace('back', angle); break;
        case 'c': angle = Math.PI / 2; rotateFace('left', angle); break;
        case 'C': angle = -Math.PI / 2; rotateFace('left', angle); break;
        case 'd': angle = Math.PI / 2; rotateFace('right', angle); break;
        case 'D': angle = -Math.PI / 2; rotateFace('right', angle); break;
        case 'e': angle = Math.PI / 2; rotateFace('top', angle); break;
        case 'E': angle = -Math.PI / 2; rotateFace('top', angle); break;
        case 'f': angle = Math.PI / 2; rotateFace('bottom', angle); break;
        case 'F': angle = -Math.PI / 2; rotateFace('bottom', angle); break;
        default: break;
    }
});

// Animation loop to render the scene continuously
function animate() {
    requestAnimationFrame(animate);
    controls.update(); // update controls for damping
    renderer.render(scene, camera);
}

// Start the animation loop
animate();
