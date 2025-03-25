import * as THREE from 'https://unpkg.com/three/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'https://unpkg.com/three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Get rid of the loading screen
const fc = document.querySelector("#game-container");
fc.parentElement.removeChild(fc);

// Create a canvas texture for a colored face with a letter label
function createFaceTexture(color, letter) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    context.fillStyle = color;
    context.fillRect(0, 0, size, size);
    context.font = 'bold 150px Arial';
    context.fillStyle = '#000000';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(letter, size / 2, size / 2);
    return new THREE.CanvasTexture(canvas);
}
export function createFaceMaterial(color, letter) {
    return new THREE.MeshBasicMaterial({ map: createFaceTexture(color, letter) });
}

// Colors and letters for each side:
// Right: 'D', Left: 'C',
// Top: 'E', Bottom: 'F',
// Front: 'A', Back: 'B'
export const faceDefinitions = [
    { color: '#00ff00', letter: 'D' },
    { color: '#0000ff', letter: 'C' },
    { color: '#ffffff', letter: 'E' },
    { color: '#ffff00', letter: 'F' },
    { color: '#ff00a5', letter: 'A' },
    { color: '#a50000', letter: 'B' }
];

// Default material for unlabelled (inner) faces
export const defaultMaterial = new THREE.MeshBasicMaterial({ color: 0x111111 });

// Initialize scene, camera, and renderer
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
export const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Add OrbitControls for interaction
export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Create group for cube pieces (cubies)
export const rubyCube = new THREE.Group();
scene.add(rubyCube);

// Parameters for a Rubik's cube
export const cubieSize = 1;
export const gap = 0.05;
// Change this value between 3 and 9 as desired.
export const numPerAxis = 5;
export const offset = ((numPerAxis - 1) * (cubieSize + gap)) / 2;

// Helper function to check if an index is in the center region 
function isCenter(index) {
    if (numPerAxis % 2 === 1) {
        return index === Math.floor(numPerAxis / 2);
    } else {
        return index === numPerAxis / 2 - 1 || index === numPerAxis / 2;
    }
}

// Create cubies with per-face materials
for (let i = 0; i < numPerAxis; i++) {
    for (let j = 0; j < numPerAxis; j++) {
        for (let k = 0; k < numPerAxis; k++) {
            const geometry = new RoundedBoxGeometry(cubieSize, cubieSize, cubieSize, 2, cubieSize * 0.1);
            const materials = geometry.groups.map(() => defaultMaterial);
            const x = i * (cubieSize + gap) - offset;
            const y = j * (cubieSize + gap) - offset;
            const z = k * (cubieSize + gap) - offset;
            const eps = 0.001;
            // Label the center cubie(s) for each face
            if (i === numPerAxis - 1 && isCenter(j) && isCenter(k)) { // right face
                materials[0] = createFaceMaterial(faceDefinitions[0].color, faceDefinitions[0].letter);
            }
            else if (Math.abs(x - offset) < eps) { // right faceOh. 
                materials[0] = createFaceMaterial(faceDefinitions[0].color, "");
            }
            if (i === 0 && isCenter(j) && isCenter(k)) { // left face
                materials[1] = createFaceMaterial(faceDefinitions[1].color, faceDefinitions[1].letter);
            }
            else if (Math.abs(x + offset) < eps) { // left face
                materials[1] = createFaceMaterial(faceDefinitions[1].color, "");
            }
            if (j === numPerAxis - 1 && isCenter(i) && isCenter(k)) { // top face
                materials[2] = createFaceMaterial(faceDefinitions[2].color, faceDefinitions[2].letter);
            }
            else if (Math.abs(y - offset) < eps) { // top face
                materials[2] = createFaceMaterial(faceDefinitions[2].color, "");
            }
            if (j === 0 && isCenter(i) && isCenter(k)) { // bottom face
                materials[3] = createFaceMaterial(faceDefinitions[3].color, faceDefinitions[3].letter);
            }
            else if (Math.abs(y + offset) < eps) { // bottom face
                materials[3] = createFaceMaterial(faceDefinitions[3].color, "");
            }
            if (k === numPerAxis - 1 && isCenter(i) && isCenter(j)) { // front face
                materials[4] = createFaceMaterial(faceDefinitions[4].color, faceDefinitions[4].letter);
            }
            else if (Math.abs(z - offset) < eps) { // front face
                materials[4] = createFaceMaterial(faceDefinitions[4].color, "");
            }
            if (k === 0 && isCenter(i) && isCenter(j)) { // back face
                materials[5] = createFaceMaterial(faceDefinitions[5].color, faceDefinitions[5].letter);
            }
            else if (Math.abs(z + offset) < eps) { // back face
                materials[5] = createFaceMaterial(faceDefinitions[5].color, "");
            }
            
            const cubie = new THREE.Mesh(geometry, materials);
            cubie.position.set(x, y, z);
            rubyCube.add(cubie);
        }
    }
}

// Position camera so the whole cube is visible.
camera.position.z = 2 + numPerAxis;

// Animation loop to render the scene continuously.
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();