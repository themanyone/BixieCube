import * as THREE from 'three';
import { scene, camera, renderer, controls, bixieCube, cubieSize, gap, numPerAxis, getOffset } from './init.js';

// Global flags, history, and queues for rotations.
let isRotating = false;
const rotationQueue = [];
let undoQueue = [];  // <-- new undo queue
let moveHistory = [];
let isUndoing = false;
let turningLayers = 1;
const eps = 0.001;
let difficulty = 5;

function rotateFace(face, angle, layersCount = 1, sound = true) {
    if (isRotating) {
        rotationQueue.push({ face, angle, layersCount });
        return;
    }
    isRotating = true;
    // Play twist_sound.
    if (sound) {
        const audio = document.getElementById('twist_sound');
        try {
            audio.play();
        } catch (error) {
            // console.error('Error playing audio:', error);
        }
    }
    const rotatingCubies = [];
    let boundary;
    switch (face) {
        case 'front':
            boundary = getOffset() - ((layersCount - 1) * (cubieSize + gap));
            bixieCube.children.forEach(cubie => { 
                if (cubie.position.z > boundary - eps) { rotatingCubies.push(cubie); }
            });
            break;
        case 'back':
            boundary = -getOffset() + ((layersCount - 1) * (cubieSize + gap));
            bixieCube.children.forEach(cubie => { 
                if (cubie.position.z < boundary + eps) { rotatingCubies.push(cubie); }
            });
            break;
        case 'right':
            boundary = getOffset() - ((layersCount - 1) * (cubieSize + gap));
            bixieCube.children.forEach(cubie => {
                if (cubie.position.x > boundary - eps) { rotatingCubies.push(cubie); }
            });
            break;
        case 'left':
            boundary = -getOffset() + ((layersCount - 1) * (cubieSize + gap));
            bixieCube.children.forEach(cubie => {
                if (cubie.position.x < boundary + eps) { rotatingCubies.push(cubie); }
            });
            break;
        case 'top':
            boundary = getOffset() - ((layersCount - 1) * (cubieSize + gap));
            bixieCube.children.forEach(cubie => {
                if (cubie.position.y > boundary - eps) { rotatingCubies.push(cubie); }
            });
            break;
        case 'bottom':
            boundary = -getOffset() + ((layersCount - 1) * (cubieSize + gap));
            bixieCube.children.forEach(cubie => {
                if (cubie.position.y < boundary + eps) { rotatingCubies.push(cubie); }
            });
            break;
    }
    
    const tempGroup = new THREE.Group();
    scene.add(tempGroup);
    rotatingCubies.forEach(cubie => {
        bixieCube.remove(cubie);
        tempGroup.add(cubie);
    });
    
    let rotationAxis = new THREE.Vector3();
    if (face === 'front' || face === 'back') {
        rotationAxis.set(0, 0, 1);
    } else if (face === 'left' || face === 'right') {
        rotationAxis.set(1, 0, 0);
    } else if (face === 'top' || face === 'bottom') {
        rotationAxis.set(0, 1, 0);
    }
    
    const duration = 200; // duration in milliseconds
    const startTime = performance.now();
    const initialQuat = tempGroup.quaternion.clone();
    const deltaQuat = new THREE.Quaternion().setFromAxisAngle(rotationAxis, angle);
    const targetQuat = deltaQuat.multiply(initialQuat);
    
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
                // Recalculate grid indices based on the new position
                const currentOffset = getOffset();
                cubie.userData.i = Math.round((cubie.position.x + currentOffset) / (cubieSize + gap));
                cubie.userData.j = Math.round((cubie.position.y + currentOffset) / (cubieSize + gap));
                cubie.userData.k = Math.round((cubie.position.z + currentOffset) / (cubieSize + gap));
                bixieCube.add(cubie);
            });
            scene.remove(tempGroup);
            isRotating = false;
            
            if (!isUndoing) {
                
                // if finalizing a twist, store the whole move
                if (Math.abs(angle) === twist * 3) {
                    angle = twist * 4 * Math.sign(angle);
                }
                // but don't store preview twists
                if (Math.abs(angle) !== twist) {
                    moveHistory.push({ face, angle, layersCount });
                    if (checkCubeSolved() && startGameBtn.textContent != 'Start Game') {
                        console.log("Cube solved!");
                        celebrateWin(); // <-- Trigger the celebration.
                        stopGame();
                        startGameBtn.textContent = 'Start Game';
                        return;
                    }
                }
            }

            if (undoQueue.length > 0) {
                const nextUndo = undoQueue.shift();
                rotateFace(nextUndo.face, nextUndo.angle, nextUndo.layersCount);
            } else if (rotationQueue.length > 0) {
                const next = rotationQueue.shift();
                rotateFace(next.face, next.angle, next.layersCount);
            } else {
                // End the undo chain only when no more undo moves are queued.
                isUndoing = false;
            }
            // turningLayers = 1; 
        }
    }
    requestAnimationFrame(animateRotation);
}

// helper to check if the cube is solved.
function checkCubeSolved() {
    const faceColors = {
        front: new Set(),
        back: new Set(),
        left: new Set(),
        right: new Set(),
        top: new Set(),
        bottom: new Set(),
    };
    const checkFaces = [
        { test: cubie => Math.abs(cubie.position.z - getOffset()) < eps, face: 'front',  materialIndex: 4 },
        { test: cubie => Math.abs(cubie.position.z + getOffset()) < eps, face: 'back',   materialIndex: 5 },
        { test: cubie => Math.abs(cubie.position.x + getOffset()) < eps, face: 'left',   materialIndex: 1 },
        { test: cubie => Math.abs(cubie.position.x - getOffset()) < eps, face: 'right',  materialIndex: 0 },
        { test: cubie => Math.abs(cubie.position.y - getOffset()) < eps, face: 'top',    materialIndex: 2 },
        { test: cubie => Math.abs(cubie.position.y + getOffset()) < eps, face: 'bottom', materialIndex: 3 }
    ];
    // Tally up the material colors of each face
    bixieCube.children.forEach(cubie => {
        checkFaces.forEach(({ test, face, materialIndex }) => {
            if (test(cubie)) {
                faceColors[face].add(cubie.material[materialIndex].color.getHex());
            }
        });
    });
    // If faceColors set.size === 1, every set of faces is one, uniform color
    return Object.values(faceColors).every(set => set.size === 1);
}

// Find (t)opmost, (l)eftmost, (r)ightmost, or (b)ottommost face.
function findFace(direction = 't') {
    // 1. Define the center points of each face in world space.
    const faceCenters = {
        front: new THREE.Vector3(0, 0, getOffset()),
        back: new THREE.Vector3(0, 0, -getOffset()),
        left: new THREE.Vector3(-getOffset(), 0, 0),
        right: new THREE.Vector3(getOffset(), 0, 0),
        top: new THREE.Vector3(0, getOffset(), 0),
        bottom: new THREE.Vector3(0, -getOffset(), 0),
    };

    // 2. Project each face center to screen space.
    const screenPositions = {};
    for (const face in faceCenters) {
        const center = faceCenters[face].clone();
        center.project(camera);
        screenPositions[face] = {
            x: (center.x + 1) / 2 * renderer.domElement.clientWidth,
            y: (-center.y + 1) / 2 * renderer.domElement.clientHeight,
            z: center.z
        };
    }

    // 3. Find the face closest to direction.
    let bestFace = null;
    let bestValue = "bd".includes(direction) ? -Infinity : Infinity; // Initialize for bottommost or topmost
    if (direction === 'r') {
        bestValue = -Infinity;
    }
    if (direction === 'k') {
        bestValue = -Infinity;
    }
    for (const face in screenPositions) {
        let currentValue;
        //FIXME: It can't find the frontmost face because screenPositions is two dimensional
        switch (direction) {
            case 'f':
                currentValue = screenPositions[face].z;
                if (currentValue < bestValue) {
                    bestValue = currentValue;
                    bestFace = face;
                }
                break;
            case 'u':
            case 't':
                currentValue = screenPositions[face].y;
                if (currentValue < bestValue) {
                    bestValue = currentValue;
                    bestFace = face;
                }
                break;
            case 'b':
            case 'd':
                currentValue = screenPositions[face].y;
                if (currentValue > bestValue) {
                    bestValue = currentValue;
                    bestFace = face;
                }
                break;
            case 'l':
                currentValue = screenPositions[face].x;
                if (currentValue < bestValue) {
                    bestValue = currentValue;
                    bestFace = face;
                }
                break;
            case 'r':
                currentValue = screenPositions[face].x;
                if (currentValue > bestValue) {
                    bestValue = currentValue;
                    bestFace = face;
                }
                break;
            case 'k':
                currentValue = screenPositions[face].z;
                if (currentValue > bestValue) {
                    bestValue = currentValue;
                    bestFace = face;
                }
                break;
            default:
                console.error("Invalid direction:", direction);
                return null;
        }
    }

    return bestFace;
}

// Key event handler for hotkeys
window.addEventListener('keydown', e => {
    // If a number key 2-9 is pressed, set the layer mode.
    if (e.key >= '1' && e.key <= '9') {
        const n = parseInt(e.key, 10);
        turningLayers = Math.max(1, Math.min(n, Math.floor(numPerAxis / 2)));
        console.log('Rotate layers set to:', turningLayers);
        document.getElementById("layersInput").value = turningLayers;
        return;
    }
    // Hotkey for undo (last move)
    if (e.key === 'z') {
        if (moveHistory.length > 0) {
            const lastMove = moveHistory.pop();
            const undoMove = { face: lastMove.face, angle: -lastMove.angle, layersCount: lastMove.layersCount };
            // If rotation is underway or queued then push it to the undo queue.
            if (isRotating || rotationQueue.length > 0 || undoQueue.length > 0) {
                undoQueue.push(undoMove);
            } else {
                isUndoing = true;
                rotateFace(undoMove.face, undoMove.angle, undoMove.layersCount);
            }
        }
        return;
    }
    // Process face rotation "fublr" keys.
    let angle = -Math.PI / 2;
    const theKey = e.key.toLowerCase();
    if ("dfutblrk".includes(theKey)){        
        const face = findFace(theKey);
        if (['front', 'top', 'right'].includes(face)) angle = -angle;
        if ("DFUTBLRK".includes(e.key)) {
            angle = -angle;
        }
        rotateFace(face, angle, turningLayers);
    }
});

// Global variables for face dragging.
let dragStart = null;
let currentFace = null;
let dragCubie = null;
let faceCenterScreen = null;
const raycaster = new THREE.Raycaster();
// Face dragging handles
let selectedFace = null;
let dragDirection = 0;
const twist = Math.PI / 8;

function projectToScreen(pos3D) {
    const pos = pos3D.clone().project(camera);
    return {
        x: (pos.x + 1) / 2 * renderer.domElement.clientWidth,
        y: (-pos.y + 1) / 2 * renderer.domElement.clientHeight
    };
}

function getFaceCandidates(intersection, box) {
    const diffRight  = Math.abs(intersection.point.x - box.max.x);
    const diffLeft   = Math.abs(intersection.point.x - box.min.x);
    const diffTop    = Math.abs(intersection.point.y - box.max.y);
    const diffBottom = Math.abs(intersection.point.y - box.min.y);
    const diffFront  = Math.abs(intersection.point.z - box.max.z);
    const diffBack   = Math.abs(intersection.point.z - box.min.z);
    const faceCandidates = [
        { face: 'right', diff: diffRight },
        { face: 'left',  diff: diffLeft },
        { face: 'top',   diff: diffTop },
        { face: 'bottom',diff: diffBottom },
        { face: 'front', diff: diffFront },
        { face: 'back',  diff: diffBack }
    ];
    faceCandidates.sort((a, b) => a.diff - b.diff);
    selectedFace = faceCandidates[0].face;
    return faceCandidates;
}

function computeFaceCenterScreen(box, face, camera, renderer) {
    const centerX = (box.min.x + box.max.x) / 2;
    const centerY = (box.min.y + box.max.y) / 2;
    const centerZ = (box.min.z + box.max.z) / 2;
    const faceCenter3D = new THREE.Vector3();
    switch (face) {
        case 'right':  faceCenter3D.set(box.max.x, centerY, centerZ); break;
        case 'left':   faceCenter3D.set(box.min.x, centerY, centerZ); break;
        case 'top':    faceCenter3D.set(centerX, box.max.y, centerZ); break;
        case 'bottom': faceCenter3D.set(centerX, box.min.y, centerZ); break;
        case 'front':  faceCenter3D.set(centerX, centerY, box.max.z); break;
        case 'back':   faceCenter3D.set(centerX, centerY, box.min.z); break;
    }
    const pos = faceCenter3D.clone().project(camera);
    return {
        x: (pos.x + 1) / 2 * renderer.domElement.clientWidth,
        y: (-pos.y + 1) / 2 * renderer.domElement.clientHeight
    };
}

function getCanvasRelativePosition(event) {
    const canvasRect = renderer.domElement.getBoundingClientRect();
    const devicePixelRatio = window.devicePixelRatio || 1
    if (event.changedTouches){
        event = event.changedTouches[0];
    }
    let clientX = event.clientX;
    let clientY = event.clientY;
    // Adjust for canvas offset and device pixel ratio
    const x = clientX - canvasRect.left / devicePixelRatio;
    const y = clientY - canvasRect.top  / devicePixelRatio;
    return { x, y };
}

function pressDown(event) {
    event.preventDefault();
    const devicePixelRatio = window.devicePixelRatio || 1
    const { x, y } = getCanvasRelativePosition(event);

    const mouse = new THREE.Vector2(
        (x / renderer.domElement.clientWidth) * 2 - 1,
        -(y / renderer.domElement.clientHeight) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);
    // Intersect with the cube's children to get a hit point on the cube.
    const intersects = raycaster.intersectObjects(bixieCube.children, true);
    if (intersects.length > 0) {
        const intersection = intersects[0];
        // Create a bounding box around the entire cube.
        const box = new THREE.Box3().setFromObject(bixieCube);
        // Compare the intersection point to each face of the box.
        const faceCandidates = getFaceCandidates(intersection, box);
        selectedFace = faceCandidates[0].face;
        
        // Compute the 3D center of the selected face.
        faceCenterScreen = computeFaceCenterScreen(box, selectedFace, camera, renderer);
        dragStart = { x, y };
        controls.enabled = false;
    }
}
renderer.domElement.addEventListener('mousedown', pressDown);
renderer.domElement.addEventListener('touchstart', pressDown);



function turnDirection(start, end){
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    // Only proceed if the drag is significant.
    if (distance > 100) {
        // Compute vectors from the face center (screen coords) to the drag start and end.
        const v1 = { x: start.x - faceCenterScreen.x, y: start.y - faceCenterScreen.y };
        const v2 = { x: end.x - faceCenterScreen.x,   y: end.y - faceCenterScreen.y };
        // use z-component of the cross product to get direction.
        const cross = v1.x * v2.y - v1.y * v2.x;
        let angle = cross > 0 ? -1: 1;
        if (selectedFace === 'bottom' || selectedFace === 'left' || selectedFace === 'back') {
            angle = -angle;
        }
        return angle;
    }
    return null;
}
function release(event) {
    event.preventDefault();
    const { x, y } = getCanvasRelativePosition(event);
    if (selectedFace && faceCenterScreen && dragStart) {
        const dragEnd = { x, y };
        const angle = 3 * twist * dragDirection;
        if (angle) {
            rotateFace(selectedFace, angle, turningLayers);
        }
    }
    // Reset state and re-enable OrbitControls.
    selectedFace = null;
    faceCenterScreen = null;
    dragStart = null;
    dragDirection = 0;
    controls.enabled = true;
}

renderer.domElement.addEventListener('mouseup', release);
renderer.domElement.addEventListener('touchend', release);
// renderer.domElement.addEventListener('mouseleave', release);
// renderer.domElement.addEventListener('touchcancel', release);

function dragFace(event){
    if (isRotating || !dragStart) return;
    const { x, y } = getCanvasRelativePosition(event);
    if (selectedFace && faceCenterScreen) {
        const dragCurrent = { x, y };
        let direction = turnDirection(dragStart, dragCurrent, false);
        if (direction === dragDirection) return; // ignore subsequent dragging
        // dragDirection has changed, so we restore face rotation
        if (dragDirection) {
            rotateFace(selectedFace, (-twist) * dragDirection, turningLayers, false);
            dragDirection = 0;
            return;
        }
        if (direction) {
            dragDirection = direction;
            rotateFace(selectedFace, twist * dragDirection, turningLayers, false);
        }
    }
}
// Provide visual feedback with a small twist in dragDirection
renderer.domElement.addEventListener('mousemove', dragFace);
renderer.domElement.addEventListener('touchmove', dragFace);

// Add drop event handlers and helper function to paint a face with a dropped image

renderer.domElement.addEventListener('dragover', (event) => {
    event.preventDefault();
});

renderer.domElement.addEventListener('drop', (event) => {
    event.preventDefault();
    if (event.dataTransfer.files.length === 0) return;
    const file = event.dataTransfer.files[0];
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const imgUrl = e.target.result;
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(imgUrl, (texture) => {
            const mouse = new THREE.Vector2(
                (event.clientX / renderer.domElement.clientWidth) * 2 - 1,
                -(event.clientY / renderer.domElement.clientHeight) * 2 + 1
            );
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(bixieCube.children, true);
            if (intersects.length > 0) {
                const intersection = intersects[0];
                const box = new THREE.Box3().setFromObject(bixieCube);
                const faceCandidates = getFaceCandidates(intersection, box);
                const targetFace = faceCandidates[0].face;
                paintFacesWithImage(targetFace, texture);
            } else {
                // Drop occurred outside the cube's bounding box: paint the body.
                paintBody(imgUrl);
            }
        });
    };
    reader.readAsDataURL(file);
});

function paintFacesWithImage(face, texture) {

    bixieCube.children.forEach(cubie => {
    const currentOffset = getOffset();
        let qualifies = false;
        let i, j;
        // Use cubieSize as a tolerance threshold.
        switch (face) {
            case 'front':
                qualifies = Math.abs(cubie.position.z - currentOffset) < cubieSize / 2;
                if (qualifies) {
                    i = cubie.userData.i !== undefined ? cubie.userData.i :
                    Math.round((cubie.position.x + currentOffset) / (cubieSize + gap));
                    j = cubie.userData.j !== undefined ? cubie.userData.j :
                        Math.round((cubie.position.y + currentOffset) / (cubieSize + gap));
                    applyTextureToCubie(cubie, face, texture, i, j);
                }
                break;
            case 'back':
                qualifies = Math.abs(cubie.position.z + currentOffset) < cubieSize / 2;
                if (qualifies) {
                    i = cubie.userData.i !== undefined ? cubie.userData.i :
                    Math.round((cubie.position.x + currentOffset) / (cubieSize + gap));
                    j = cubie.userData.j !== undefined ? cubie.userData.j :
                        Math.round((cubie.position.y + currentOffset) / (cubieSize + gap));
                    applyTextureToCubie(cubie, face, texture, numPerAxis - i - 1, j);
                }
                break;
            case 'right':
                qualifies = Math.abs(cubie.position.x - currentOffset) < cubieSize / 2;
                if (qualifies) {
                    j = cubie.userData.k !== undefined ? cubie.userData.k :
                        Math.round((cubie.position.z + currentOffset) / (cubieSize + gap));
                    i = cubie.userData.j !== undefined ? cubie.userData.j :
                        Math.round((cubie.position.y + currentOffset) / (cubieSize + gap));
                        applyTextureToCubie(cubie, face, texture, numPerAxis - j - 1, i);
                }
                break;
            case 'left':
                qualifies = Math.abs(cubie.position.x + currentOffset) < cubieSize / 2;
                if (qualifies) {
                    j = cubie.userData.k !== undefined ? cubie.userData.k :
                        Math.round((cubie.position.z + currentOffset) / (cubieSize + gap));
                    i = cubie.userData.j !== undefined ? cubie.userData.j :
                        Math.round((cubie.position.y + currentOffset) / (cubieSize + gap));
                    applyTextureToCubie(cubie, face, texture, j, i);
                }
                break;
            case 'top':
                qualifies = Math.abs(cubie.position.y - currentOffset) < cubieSize / 2;
                if (qualifies) {
                    i = cubie.userData.i !== undefined ? cubie.userData.i :
                        Math.round((cubie.position.x + currentOffset) / (cubieSize + gap));
                    j = cubie.userData.k !== undefined ? cubie.userData.k :
                        Math.round((cubie.position.z + currentOffset) / (cubieSize + gap));
                        applyTextureToCubie(cubie, face, texture, i, numPerAxis - j - 1);
                }
                break;
            case 'bottom':
                qualifies = Math.abs(cubie.position.y + currentOffset) < cubieSize / 2;
                if (qualifies) {
                    i = cubie.userData.i !== undefined ? cubie.userData.i :
                        Math.round((cubie.position.x + currentOffset) / (cubieSize + gap));
                    j = cubie.userData.k !== undefined ? cubie.userData.k :
                        Math.round((cubie.position.z + currentOffset) / (cubieSize + gap));
                        applyTextureToCubie(cubie, face, texture, i, j);
                }
                break;
        }
    });
}


function applyTextureToCubie(cubie, face, texture, i, j) {
    // Clone the texture so each cubie gets its own instance.
    const cubieTexture = texture.clone();
    // Force texture to use sRGB encoding to fix brightness.
    cubieTexture.encoding = THREE.sRGBEncoding;
    cubieTexture.minFilter = THREE.NearestFilter;
    cubieTexture.magFilter = THREE.NearestFilter;   
    cubieTexture.wrapS = THREE.ClampToEdgeWrapping;
    cubieTexture.wrapT = THREE.ClampToEdgeWrapping;
    // Mapping: right:0, left:1, top:2, bottom:3, front:4, back:5
    const faceMaterialIndex = { right: 0, left: 1, top: 2, bottom: 3, front: 4, back: 5 }[face];
    const currentOffset = getOffset();
    const totalCubies = numPerAxis; // number of cubies per face

    // Set the texture repeat and offset so that each cubie only shows its sub-area.
    cubieTexture.repeat.set(1 / totalCubies, 1 / totalCubies);
    cubieTexture.offset.set(i / totalCubies, j / totalCubies);
    cubieTexture.needsUpdate = true;

    const oldMat = cubie.material[faceMaterialIndex];
    const newMat = oldMat.clone();
    newMat.map = cubieTexture;
    cubie.material[faceMaterialIndex] = newMat;
}

function paintBody(imageUrl) {
    document.body.style.backgroundImage = `url(${imageUrl})`;
    document.body.style.backgroundSize = 'cover';
}

export function scrambleCube() {
    const faces = ['front', 'back', 'left', 'right', 'top', 'bottom'];
    for (let i = 0; i < difficulty; i++) {
        const randomFace = faces[Math.floor(Math.random() * faces.length)];
        const randomAngle = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        rotateFace(randomFace, randomAngle, Math.random() * Math.floor(numPerAxis / 2) + 1);
    }
}

// Format seconds as MM:SS
function formatTime(seconds) {
    const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${mins}:${secs}`;
}

let gameTime = 60; // game time in seconds (1 minute)
let timerInterval = null;

// Start game button click starts timer and shows popover
startGameBtn.addEventListener('click', (e) => {
    timerBox.style.display = 'block';
    if (e.target.textContent === 'Reset') {
        e.target.textContent = 'Start Game';
        stopGame();
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        return;
    }
    // resetCube.click();
    e.target.textContent = 'Reset';
    scrambleCube();
    setTimeout(() => {
        moveHistory.length = 0; // <-- Reset the undo queue when starting a new game.
    }, 2000);
    let gameTime = 0;
    timerBox.style.display = 'block';
    document.getElementById('timerDisplay').textContent = formatTime(gameTime);
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        gameTime++
        document.getElementById('timerDisplay').textContent = formatTime(gameTime);
    }, 1000);
});

// Hide timer popover (and stop timer) when game is over
function stopGame() {
    // timerBox.style.display = 'none';
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        // Clear all pending actions
        undoQueue.length = 0;
        rotationQueue.length = 0;
        moveHistory.length = 0;
        isRotating = false;
        isUndoing = false;
        dragStart = null;
        selectedFace = null;
        dragDirection = 0;
        controls.enabled = true;
        turningLayers = 1; // Turn one layer by default
        document.getElementById('layersInput').value = 1;
    }
}

document.getElementById('numPerAxisInput').addEventListener('change', (event) => {
    stopGame();
    timerBox.style.display = 'none';
    // timerBox.textContent = '00:00';
    startGameBtn.textContent = 'Start Game';
});

document.getElementById('resetCube').addEventListener('click', () => {
    stopGame();
    // timerBox.style.display = 'none';
    // timerBox.textContent = '00:00';
    startGameBtn.textContent = 'Start Game';
});

// New function to celebrate winning.
function celebrateWin() {
    // Play fireworks sound.
    const audio = document.getElementById('fireworks_sound');
    audio.play();
    const wt = document.querySelector(".wavetext");
    const pyro = document.querySelector(".pyro");

    wt.style.display = "block";
    pyro.style.display = "block";
    setTimeout(function(){
        pyro.style.display = "none";
        wt.style.display = "none";
    }, 8000);
}

// Respond to difficulty slider event
document.getElementById('difficulty').addEventListener('input', (e) => {
    //  Get the current difficulty value.
    difficulty = e.target.value;
  
    //  Do something with the difficulty value (e.g., update the game logic).
    //  This is a placeholder; replace with your actual game logic.
    console.log("Difficulty changed to:", difficulty); 
  });



document.getElementById('increment').addEventListener('click', 
    (e)=>{
        const input = document.getElementById('layersInput');
        const val = parseInt(input.value);
        turningLayers = val;        
        turningLayers = Math.max(1, Math.min(val, Math.floor(numPerAxis / 2)));
        input.value = turningLayers;
    });
document.getElementById('decrement').addEventListener('click', 
    (e)=>{
        const input = document.getElementById('layersInput');
        const val = parseInt(input.value);
        turningLayers = val;
    });