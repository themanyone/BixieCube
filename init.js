import * as THREE from 'three';
import { OrbitControls } from 'orbit';
import { RoundedBoxGeometry } from 'addons/geometries/RoundedBoxGeometry.js';

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

// Default material for unlabelled (inner) faces
//export const defaultMaterial = new THREE.MeshBasicMaterial({ color: 0x111111 });

// Initialize scene, camera, and renderer with transparency enabled
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
export const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setClearColor(0x000000, 0);  // Set alpha to 0 for a transparent background
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Add OrbitControls for interaction
export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;  // increased damping for tighter rotation
controls.rotateSpeed = 0.7;    // reduced rotation speed for a more controlled feel

// Add an emissive material to make the cube glow from within
const defaultMaterial = new THREE.MeshStandardMaterial({
    emissive: 0x222222, // White glow
    emissiveIntensity: 0.01, // Adjust intensity as needed
    color: 0x000000 // Base color
});

// Hide wavetext element
wt = document.querySelector(".wavetext");
wt.style.display = "none";

// Create group for cube pieces (cubies)
export const bixieCube = new THREE.Group();
scene.add(bixieCube);

// Parameters
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
    // Clear previous cubies from bixieCube group
    while (bixieCube.children.length > 0) {
        const child = bixieCube.children[0];
        bixieCube.remove(child);
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
    const colors = ['#00ff00',
                    '#0000ff',
                    '#f8f8f8',
                    '#ffff00',
                    '#ff00a5',
                    '#a50000'];
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
                if (i === numPerAxis - 1) {
                    materials[0] = createFaceMaterial(colors[0], "");
                }
                // Left face
                if (i === 0) {
                    materials[1] = createFaceMaterial(colors[1], "");
                }
                // Top face
                if (j === numPerAxis - 1) {
                    materials[2] = createFaceMaterial(colors[2], "");
                }
                // Bottom face
                if (j === 0) {
                    materials[3] = createFaceMaterial(colors[3], "");
                }
                // Front face
                if (k === numPerAxis - 1) {
                    materials[4] = createFaceMaterial(colors[4], "");
                }
                // Back face
                if (k === 0) {
                    materials[5] = createFaceMaterial(colors[5], "");
                }

                const cubie = new THREE.Mesh(geometry, materials);
                cubie.position.set(x, y, z);
                // Store the grid indices so we can update positions later
                cubie.userData = { i, j, k };
                bixieCube.add(cubie);
            }
        }
    }
}

// New function to update the cubies' bevel based on the current value
function updateCubeBevel(newBevel) {
    bevel = newBevel;
    bixieCube.children.forEach(cubie => {
        if (cubie.geometry) {
            cubie.geometry.dispose();
        }
        cubie.geometry = new RoundedBoxGeometry(cubieSize, cubieSize, cubieSize, 2, cubieSize * bevel);
    });
}

// New function to update the cubies' positions based on the current gap
function updateCubePositions(gap) {
    const currentOffset = ((numPerAxis - 1) * (cubieSize + gap)) / 2;
    bixieCube.children.forEach(cubie => {
        const { i, j, k } = cubie.userData;
        cubie.position.set(
            i * (cubieSize + gap) - currentOffset,
            j * (cubieSize + gap) - currentOffset,
            k * (cubieSize + gap) - currentOffset
        );
    });
}

// New function to update the cubies' alpha based on the current value
function updateCubeAlpha(newAlpha) {
    bixieCube.children.forEach(cubie => {
        if (cubie.material) {
            const materials = Array.isArray(cubie.material)
                ? cubie.material
                : [cubie.material];
            materials.forEach(mat => {
                mat.opacity = newAlpha;
                mat.transparent = newAlpha < 1;
                // mat.depthWrite = newAlpha === 1;
                // Render both sides to fix back-face culling issues
                mat.side = newAlpha < 1 ? THREE.DoubleSide : THREE.FrontSide;
                // Also increase emissiveIntensity inversely with alpha
                mat.emissiveIntensity = 0.3 - newAlpha;
                mat.needsUpdate = true;
            });
        }
    });
}

// Initial cube build
buildCube();

// Position camera so the whole cube is visible.
camera.position.z = 5 + numPerAxis;

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
popover.style.display = 'none';  // <-- Initialize as hidden
popover.innerHTML = `<h1><a href="/" target="_blank">Home</a>
PC and Electronic Repair
</h1>
<h3>Unlock Premium Access</h3>

<p>Unlock exclusive features and support the development of BixieCube by becoming a Premium Member.</p>

<ul>
<li>BixieCube <a href="https://github.com/themanyone/BixieCube"><span>project on GitHub</span></a></li>
<li>YouTube <a href="https://www.youtube.com/themanyone"><span>https://www.youtube.com/themanyone</span></a></li>
<li>Mastodon <a href="https://mastodon.social/@themanyone"><span>https://mastodon.social/@themanyone</span></a></li>
<li>Linkedin <a href="https://www.linkedin.com/in/henry-kroll-iii-93860426/"><span>https://www.linkedin.com/in/henry-kroll-iii-93860426/</span></a></li>
<li>Buy me a coffee <a href="https://buymeacoffee.com/isreality"><span>https://buymeacoffee.com/isreality</span></a></li>
<li><a href="http://thenerdshow.com/" target="_blank">TheNerdShow.com</a></li>
</ul>

<h2>Try <a href="../cube.html">BixieCube Classic</a></h2>
<h3>Fewer features, but faster loading.</h3>

<h2>LICENSE</h2>

<pre><code>BixieCube
Copyright (C) 2025 by Henry Kroll III, DBA [TheNerdShow.com](http://thenerdshow.com/)

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You may obtain a complete copy of the GNU General Public License along
with this <a href="https://github.com/themanyone/BixieCube"><span>project on GitHub</span></a>, or write to the Free Software Foundation, Inc.,
51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
</code></pre>
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
configPopover.style.display = 'none';  // <-- Initialize as hidden
configPopover.innerHTML = `
    <h3>Configuration Options</h3>
    <p>Adjust settings as needed.</p>
    <p><strong>Gap:</strong> <input type="range" id="gapSize" min="0" max="3.0" step="0.01" value="${gap}" /></p>
    <p><strong>Bevel:</strong> <input type="range" id="bevelInput" min="0.0" max="0.5" step="0.05" value="${bevel}" /></p>
    <p><strong>Alpha:</strong> <input type="range" id="alphaInput" min="0" max="1" step="0.01" value="1" /></p>
    <p><strong>2x2</strong> <input id="numPerAxisInput" type="range" min="2" max="9" step="1" value="${numPerAxis}" /><strong>9x9</strong></p>
    <p><strong>Easy</strong> <input id="difficulty" type="range" min="5" max="15" step="1" value="5" /><strong>Hard</strong></p>
    <p><button id="resetCube">Reset Cube</button></p>
`;
document.body.appendChild(configPopover);

// Create help icon element
const helpIcon = document.createElement('div');
helpIcon.innerHTML = '&#x2753;'; // Unicode for a question mark help icon
helpIcon.classList.add('icon', 'help-icon');
document.body.appendChild(helpIcon);

// Create help popover element
const helpPopover = document.createElement('div');
helpPopover.classList.add('popover');
helpPopover.style.top = '60px';
helpPopover.style.right = '60px'; // Position it next to the gear icon
helpPopover.style.display = 'none';  // Initialize as hidden
helpPopover.innerHTML = `
    <h3>Help</h3>
    <p>Touch (click) & drag faces to turn them.</p>
    <p>Adjust settings using the configuration panel (gear icon).</p>
    <p>Drag and drop an image on background to change wallpaper.</p>
    <p>Drop images on cube faces to change their texture.</p>
    <p>Right-click: Pan the camera</p>
    <p>Click or drag to rotate scene</p>
    <p>Scroll to zoom in/out</p>
    <p>Click anywhere outside the popover to close it.</p>
    <hr>
    <h3>Keyboard Help</h3>
    <p>f - Rotate (f)ront face counter-clockwise</p>
    <p>u - Rotate (u)pper face counter-clockwise</p>
    <p>r - Rotate (r)ight face counter-clockwise</p>
    <p>d - Rotate (d)own face counter-clockwise</p>
    <p>l - Rotate (l)eft face counter-clockwise</p>
    <p>k - Rotate bac(k) face counter-clockwise</p>
    <p>FURDLK - Rotate faces clockwise</p>
    <p>1-9   - Layers to rotate</p>
    <p>z - undo last move</p>
    <p>r - redo last move</p>
    <p>Space - Shuffle cube</p>
    <p>Enter - Solve cube</p>
`;
document.body.appendChild(helpPopover);

// Create a circle with a line through it element
const cheatIcon = document.createElement('div');
cheatIcon.innerHTML = "&#128369;";
cheatIcon.classList.add('icon', 'cheat-icon');
document.body.appendChild(cheatIcon);

// Create cheat popover element
const cheatPopover = document.createElement('pre');
cheatPopover.classList.add('popover');
cheatPopover.style.top = '60px';
cheatPopover.style.left = '20px'; // Position it next to the gear icon
cheatPopover.style.display = 'none';  // Initialize as hidden
cheatPopover.innerHTML = `
countercounter-clockwise: f = front,
u = up, l = left, r = right
    clockwise: shift key

    flip mid         f U l u

    flip corner      r d R D

    rot mid left     u l U L U F u f

    rot mid right:   U R u r u f U F

    "L" upper-left:  F R U r u f

    cross up right:  R U r U R U U r

    solve corners:   U R u l U r u L

    rotate top face counterclockwise
    left clockwise:  v h V U v H V u`;
document.body.appendChild(cheatPopover);

// Toggle cheat popover on click
cheatIcon.addEventListener('click', () => {
    cheatPopover.style.display = (cheatPopover.style.display === 'none') ? 'block' : 'none';
});


// Toggle help popover on help icon click
helpIcon.addEventListener('click', () => {
    helpPopover.style.display = (helpPopover.style.display === 'none') ? 'block' : 'none';
});

// Close popovers when clicking outside popover or icon elements
document.addEventListener('click', (event) => {
    if (!event.target.closest('.popover') && !event.target.closest('.icon')) {
        document.querySelectorAll('.popover').forEach(popover => {
            popover.style.display = 'none';
        });
    }
});


// Toggle configuration popover on gear icon click
gearIcon.addEventListener('click', () => {
    configPopover.style.display = (configPopover.style.display === 'none') ? 'block' : 'none';
});

document.getElementById('bevelInput').addEventListener('input', (event) => {
    bevel = parseFloat(event.target.value);
    updateCubeBevel(bevel);
});

document.getElementById('gapSize').addEventListener('input', (event) => {
    gap = parseFloat(event.target.value);
    // Instead of rebuilding the cube, just reposition the cubies
    updateCubePositions(gap);
});

document.getElementById('alphaInput').addEventListener('input', (event) => {
    const alpha = parseFloat(event.target.value);
    updateCubeAlpha(alpha);
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

// Add drag and drop functionality to update the page background image
document.addEventListener('dragover', (event) => {
    event.preventDefault();
});

// Create Start Game button
const startGameBtn = document.createElement('button');
startGameBtn.textContent = 'Start Game';
startGameBtn.id = 'startGameBtn';
startGameBtn.classList.add('icon', 'start-game-button');
document.body.appendChild(startGameBtn);

startGameBtn.addEventListener('click', () => {
    if (startGameBtn.textContent !== 'Start Game') {
        buildCube();
    }
});

// Create clock timer popover
const timerBox = document.createElement('div');
timerBox.id = 'timerBox';
startGameBtn.style.display = 'block';
timerBox.innerHTML = `
    <h1 id="timerDisplay">01:00</h1>
`;
document.body.appendChild(timerBox);

// Create audio play button
const playbutton = document.createElement('div');
playbutton.innerHTML = '&#9654;'; // Unicode play icon
playbutton.classList.add('icon', 'play-button');
document.body.appendChild(playbutton);
playbutton.addEventListener('click', () => {
    const audio = document.getElementById('videogame');
    audio.play();
}
);

// Create number input for turningLayers
const turnBox = document.createElement('div');
turnBox.id = 'turnBox';
turnBox.innerHTML = `Layers:
    <input type="text" id="layersInput" value="1">
    <span class="spinner">
        <button id="increment">▲</button>
        <button id="decrement">▼</button>
    </span>
`;
document.body.appendChild(turnBox);
const layersInput = document.getElementById('layersInput');

document.getElementById('increment').addEventListener('click', 
    (e)=>{
        const layersInput = document.getElementById('layersInput');
        const val = parseInt(layersInput.value);
        if (val < 9){
            layersInput.value = val + 1;
        }
    });
document.getElementById('decrement').addEventListener('click', 
    (e)=>{
        const input = document.getElementById('layersInput');
        const val = parseInt(layersInput.value);
        if (val > 1){
            layersInput.value = val - 1;
        }
    });