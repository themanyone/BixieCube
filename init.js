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
    { color: '#f8f8f8', letter: 'E' },
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
controls.dampingFactor = 0.2;  // increased damping for tighter rotation
controls.rotateSpeed = 0.7;    // reduced rotation speed for a more controlled feel

// Create group for cube pieces (cubies)
export const rubyCube = new THREE.Group();
scene.add(rubyCube);

// Parameters for a Rubik's cube
export let cubieSize = 1;
export let bevel = 0.1;
export let gap = 0.05;
// Change this value between 2 and 9 as desired.
export let numPerAxis = 5;
export const getOffset = () => ((numPerAxis - 1) * (cubieSize + gap)) / 2;

// Helper function to check if an index is in the center region 
function isCenter(index) {
    if (numPerAxis % 2 === 1) {
        return index === Math.floor(numPerAxis / 2);
    } else {
        return index === numPerAxis / 2 - 1 || index === numPerAxis / 2;
    }
}

function buildCube() {
    // Clear previous cubies from rubyCube group
    while (rubyCube.children.length > 0) {
        const child = rubyCube.children[0];
        rubyCube.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(mat => mat.dispose());
            } else {
                child.material.dispose();
            }
        }
    }
    
    // Recalculate offset based on updated numPerAxis
    const currentOffset = getOffset();
    
    for (let i = 0; i < numPerAxis; i++) {
        for (let j = 0; j < numPerAxis; j++) {
            for (let k = 0; k < numPerAxis; k++) {
                const geometry = new RoundedBoxGeometry(cubieSize, cubieSize, cubieSize, 2, cubieSize * bevel);
                const materials = geometry.groups.map(() => defaultMaterial);
                const x = i * (cubieSize + gap) - currentOffset;
                const y = j * (cubieSize + gap) - currentOffset;
                const z = k * (cubieSize + gap) - currentOffset;
                const eps = 0.001;
                // Right face
                if (i === numPerAxis - 1 && isCenter(j) && isCenter(k)) {
                    materials[0] = createFaceMaterial(faceDefinitions[0].color, faceDefinitions[0].letter);
                } else if (Math.abs(x - currentOffset) < eps) {
                    materials[0] = createFaceMaterial(faceDefinitions[0].color, "");
                }
                // Left face
                if (i === 0 && isCenter(j) && isCenter(k)) {
                    materials[1] = createFaceMaterial(faceDefinitions[1].color, faceDefinitions[1].letter);
                } else if (Math.abs(x + currentOffset) < eps) {
                    materials[1] = createFaceMaterial(faceDefinitions[1].color, "");
                }
                // Top face
                if (j === numPerAxis - 1 && isCenter(i) && isCenter(k)) {
                    materials[2] = createFaceMaterial(faceDefinitions[2].color, faceDefinitions[2].letter);
                } else if (Math.abs(y - currentOffset) < eps) {
                    materials[2] = createFaceMaterial(faceDefinitions[2].color, "");
                }
                // Bottom face
                if (j === 0 && isCenter(i) && isCenter(k)) {
                    materials[3] = createFaceMaterial(faceDefinitions[3].color, faceDefinitions[3].letter);
                } else if (Math.abs(y + currentOffset) < eps) {
                    materials[3] = createFaceMaterial(faceDefinitions[3].color, "");
                }
                // Front face
                if (k === numPerAxis - 1 && isCenter(i) && isCenter(j)) {
                    materials[4] = createFaceMaterial(faceDefinitions[4].color, faceDefinitions[4].letter);
                } else if (Math.abs(z - currentOffset) < eps) {
                    materials[4] = createFaceMaterial(faceDefinitions[4].color, "");
                }
                // Back face
                if (k === 0 && isCenter(i) && isCenter(j)) {
                    materials[5] = createFaceMaterial(faceDefinitions[5].color, faceDefinitions[5].letter);
                } else if (Math.abs(z + currentOffset) < eps) {
                    materials[5] = createFaceMaterial(faceDefinitions[5].color, "");
                }

                const cubie = new THREE.Mesh(geometry, materials);
                cubie.position.set(x, y, z);
                // Store the grid indices so we can update positions later
                cubie.userData = { i, j, k };
                rubyCube.add(cubie);
            }
        }
    }
}

// New function to update the cubies' bevel based on the current value
function updateCubeBevel(newBevel) {
    bevel = newBevel;
    rubyCube.children.forEach(cubie => {
        if (cubie.geometry) {
            cubie.geometry.dispose();
        }
        cubie.geometry = new RoundedBoxGeometry(cubieSize, cubieSize, cubieSize, 2, cubieSize * bevel);
    });
}

// New function to update the cubies' positions based on the current gap
function updateCubePositions(gap) {
    const currentOffset = ((numPerAxis - 1) * (cubieSize + gap)) / 2;
    rubyCube.children.forEach(cubie => {
        const { i, j, k } = cubie.userData;
        cubie.position.set(
            i * (cubieSize + gap) - currentOffset,
            j * (cubieSize + gap) - currentOffset,
            k * (cubieSize + gap) - currentOffset
        );
    });
}

// Initial cube build
buildCube();

// Position camera so the whole cube is visible.
camera.position.z = 2 + numPerAxis;

// Animation loop to render the scene continuously.
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// Create hamburger icon element
const hamburger = document.createElement('div');
hamburger.innerHTML = '&#9776;'; // Unicode hamburger icon
hamburger.classList.add('icon', 'hamburger-icon');
document.body.appendChild(hamburger);

// Create popover element
const popover = document.createElement('div');
popover.classList.add('popover');
popover.style.top = '60px';
popover.style.left = '20px';
popover.innerHTML = `
    <h3>Keyboard Help</h3>
    <p>Right-click: Move camera</p>
    <p>Click or drag to rotate scene</p>
    <p>abcdf - Rotate face clockwise</p>
    <p>ABCDF - Rotate face counterclockwise</p>
    <p>2a 3b - Rotate face + layers</p>
    <p>z - undo last move</p>
    <p>r - redo last move</p>
    <p>Space - Shuffle cube</p>
    <p>Enter - Solve cube</p>
    <p>Click the hamburger icon to show/hide this popover.</p>
    <p>Click anywhere outside the popover to close it.</p>
    <hr>
    <p><strong>Project Info:</strong> RubyCubie</p>
    <p><strong>Updates:</strong> v1.0 - initial release</p>
`;
document.body.appendChild(popover);

// Toggle popover on hamburger click
hamburger.addEventListener('click', () => {
    popover.style.display = (popover.style.display === 'none') ? 'block' : 'none';
});

// Create gear icon element for configuration
const gearIcon = document.createElement('div');
gearIcon.innerHTML = '&#9881;'; // Unicode gear icon ⚙
gearIcon.classList.add('icon', 'gear-icon');
document.body.appendChild(gearIcon);

// Create configuration popover element
const configPopover = document.createElement('div');
configPopover.classList.add('popover');
configPopover.style.top = '60px';
configPopover.style.right = '20px';
configPopover.innerHTML = `
    <h3>Configuration Options</h3>
    <p>Adjust settings as needed.</p>
    <p><strong>Gap:</strong> <input type="range" id="gapSize" min="0" max="1.0" step="0.01" value="${gap}" /></p>
    <p><strong>Bevel:</strong> <input type="range" id="bevelInput" min="0.0" max="0.5" step="0.05" value="${bevel}" /></p>
    <p><strong>Number per Axis:</strong> <input id="numPerAxisInput" type="range" min="2" max="9" step="1" value="${numPerAxis}" /></p>
    <p><button id="resetCube">Reset Cube</button></p>
    <hr>
    <p>Add more options here.</p>
`;
document.body.appendChild(configPopover);

// Toggle configuration popover on gear icon click
gearIcon.addEventListener('click', () => {
    configPopover.style.display = (configPopover.style.display === 'none') ? 'block' : 'none';
});

document.getElementById('bevelInput').addEventListener('input', (event) => {
    console.log(event.target.value);
    bevel = parseFloat(event.target.value);
    updateCubeBevel(bevel);
});

document.getElementById('gapSize').addEventListener('input', (event) => {
    console.log(event.target.value);
    gap = parseFloat(event.target.value);
    // Instead of rebuilding the cube, just reposition the cubies
    updateCubePositions(gap);
});

document.getElementById('numPerAxisInput').addEventListener('change', (event) => {
    numPerAxis = parseInt(event.target.value, 10);
    camera.position.z = 2 + numPerAxis;
    buildCube();
});

document.getElementById('resetCube').addEventListener('click', () => {
    camera.position.z = 2 + numPerAxis;
    buildCube();
});