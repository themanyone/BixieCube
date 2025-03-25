import * as THREE from 'https://unpkg.com/three/build/three.module.js';
import { scene, camera, rubyCube, cubieSize, gap, numPerAxis, getOffset } from './init.js';

// Global flags, history, and queues for rotations.
let isRotating = false;
const rotationQueue = [];
const undoQueue = [];  // <-- new undo queue
let moveHistory = [];
let isUndoing = false;
let currentLayers = 1;
const eps = 0.001;

function rotateFace(face, angle, layersCount = 1) {
    if (isRotating) {
        rotationQueue.push({ face, angle, layersCount });
        return;
    }
    isRotating = true;
    const rotatingCubies = [];
    let boundary;
    switch (face) {
        case 'front':
            boundary = getOffset() - ((layersCount - 1) * (cubieSize + gap));
            rubyCube.children.forEach(cubie => { 
                if (cubie.position.z > boundary - eps) { rotatingCubies.push(cubie); }
            });
            break;
        case 'back':
            boundary = -getOffset() + ((layersCount - 1) * (cubieSize + gap));
            rubyCube.children.forEach(cubie => { 
                if (cubie.position.z < boundary + eps) { rotatingCubies.push(cubie); }
            });
            break;
        case 'right':
            boundary = getOffset() - ((layersCount - 1) * (cubieSize + gap));
            rubyCube.children.forEach(cubie => {
                if (cubie.position.x > boundary - eps) { rotatingCubies.push(cubie); }
            });
            break;
        case 'left':
            boundary = -getOffset() + ((layersCount - 1) * (cubieSize + gap));
            rubyCube.children.forEach(cubie => {
                if (cubie.position.x < boundary + eps) { rotatingCubies.push(cubie); }
            });
            break;
        case 'top':
            boundary = getOffset() - ((layersCount - 1) * (cubieSize + gap));
            rubyCube.children.forEach(cubie => {
                if (cubie.position.y > boundary - eps) { rotatingCubies.push(cubie); }
            });
            break;
        case 'bottom':
            boundary = -getOffset() + ((layersCount - 1) * (cubieSize + gap));
            rubyCube.children.forEach(cubie => {
                if (cubie.position.y < boundary + eps) { rotatingCubies.push(cubie); }
            });
            break;
    }
    
    const tempGroup = new THREE.Group();
    scene.add(tempGroup);
    rotatingCubies.forEach(cubie => {
        rubyCube.remove(cubie);
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
    
    const duration = 150; // duration in milliseconds
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
                rubyCube.add(cubie);
            });
            scene.remove(tempGroup);
            isRotating = false;
            if (!isUndoing) {
                moveHistory.push({ face, angle, layersCount });
                if (checkCubeSolved()) {
                    console.log("Cube solved!");
                }
            }
            if (undoQueue.length > 0) {
                const nextUndo = undoQueue.shift();
                isUndoing = true;
                rotateFace(nextUndo.face, nextUndo.angle, nextUndo.layersCount);
            } else if (rotationQueue.length > 0) {
                const next = rotationQueue.shift();
                rotateFace(next.face, next.angle, next.layersCount);
            }
            currentLayers = 1;
            if (isUndoing) {
                isUndoing = false;
            }
        }
    }
    requestAnimationFrame(animateRotation);
}

// New helper to check if the cube is solved.
// You can replace the content of this function with your own solved-state logic.
function checkCubeSolved() {
    // Check if faces on each side are the same color.
    const faceColors = {
        front: new Set(),
        back: new Set(),
        left: new Set(),
        right: new Set(),
        top: new Set(),
        bottom: new Set(),
    };
    window.rc = rubyCube.children;
    rubyCube.children.forEach(cubie => {
        const { x, y, z } = cubie.position;  
        // Front face
        if (Math.abs(z - getOffset()) < eps) {
            faceColors.front.add(cubie.material[4].color.getHex());
        }
        // Back face
        if (Math.abs(z + getOffset()) < eps) {
            faceColors.back.add(cubie.material[5].color.getHex());
        }
        // Left face
        if (Math.abs(x + getOffset()) < eps) {
            faceColors.left.add(cubie.material[1].color.getHex());
        }
        // Right face
        if (Math.abs(x - getOffset()) < eps) {
            faceColors.right.add(cubie.material[0].color.getHex());
        }
        // Top face
        if (Math.abs(y - getOffset()) < eps) {
            faceColors.top.add(cubie.material[2].color.getHex());
        }
        // Bottom face
        if (Math.abs(y + getOffset()) < eps) {
            faceColors.bottom.add(cubie.material[3].color.getHex());
        }
    });
    const solved = Object.values(faceColors).every(set => set.size === 1);
    // Check if all faces have only one unique color.
    return solved;
}

// Key event handler for hotkeys
window.addEventListener('keydown', e => {
    // If a number key 2-9 is pressed, set the layer mode.
    if (e.key >= '2' && e.key <= '9') {
        const n = parseInt(e.key, 10);
        currentLayers = Math.max(1, Math.min(n, Math.floor(numPerAxis / 2)));
        console.log('Rotate layers mode set to:', currentLayers);
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
    // Process face rotation keys.
    let angle;
    switch (e.key) {
        case 'a': angle = Math.PI / 2; rotateFace('front', angle, currentLayers); break;
        case 'A': angle = -Math.PI / 2; rotateFace('front', angle, currentLayers); break;
        case 'b': angle = Math.PI / 2; rotateFace('back', angle, currentLayers); break;
        case 'B': angle = -Math.PI / 2; rotateFace('back', angle, currentLayers); break;
        case 'c': angle = Math.PI / 2; rotateFace('left', angle, currentLayers); break;
        case 'C': angle = -Math.PI / 2; rotateFace('left', angle, currentLayers); break;
        case 'd': angle = Math.PI / 2; rotateFace('right', angle, currentLayers); break;
        case 'D': angle = -Math.PI / 2; rotateFace('right', angle, currentLayers); break;
        case 'e': angle = Math.PI / 2; rotateFace('top', angle, currentLayers); break;
        case 'E': angle = -Math.PI / 2; rotateFace('top', angle, currentLayers); break;
        case 'f': angle = Math.PI / 2; rotateFace('bottom', angle, currentLayers); break;
        case 'F': angle = -Math.PI / 2; rotateFace('bottom', angle, currentLayers); break;
        default: break;
    }
});