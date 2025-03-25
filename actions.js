import * as THREE from 'https://unpkg.com/three/build/three.module.js';
import { scene, camera, rubyCube, cubieSize, gap, numPerAxis, offset } from './init.js';

// Global flags, history, and queues for rotations.
let isRotating = false;
const rotationQueue = [];
let moveHistory = [];
let isUndoing = false;
let currentLayers = 1;

function rotateFace(face, angle, layersCount = 1) {
    if (isRotating) {
        rotationQueue.push({ face, angle, layersCount });
        return;
    }
    isRotating = true;
    const eps = 0.001;
    const rotatingCubies = [];
    let boundary;
    switch (face) {
        case 'front':
            boundary = offset - ((layersCount - 1) * (cubieSize + gap));
            rubyCube.children.forEach(cubie => { 
                if (cubie.position.z > boundary - eps) { rotatingCubies.push(cubie); }
            });
            break;
        case 'back':
            boundary = -offset + ((layersCount - 1) * (cubieSize + gap));
            rubyCube.children.forEach(cubie => { 
                if (cubie.position.z < boundary + eps) { rotatingCubies.push(cubie); }
            });
            break;
        case 'right':
            boundary = offset - ((layersCount - 1) * (cubieSize + gap));
            rubyCube.children.forEach(cubie => {
                if (cubie.position.x > boundary - eps) { rotatingCubies.push(cubie); }
            });
            break;
        case 'left':
            boundary = -offset + ((layersCount - 1) * (cubieSize + gap));
            rubyCube.children.forEach(cubie => {
                if (cubie.position.x < boundary + eps) { rotatingCubies.push(cubie); }
            });
            break;
        case 'top':
            boundary = offset - ((layersCount - 1) * (cubieSize + gap));
            rubyCube.children.forEach(cubie => {
                if (cubie.position.y > boundary - eps) { rotatingCubies.push(cubie); }
            });
            break;
        case 'bottom':
            boundary = -offset + ((layersCount - 1) * (cubieSize + gap));
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
                rubyCube.add(cubie);
            });
            scene.remove(tempGroup);
            isRotating = false;
            if (!isUndoing) {
                moveHistory.push({ face, angle, layersCount });
            }
            if (rotationQueue.length > 0) {
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
            isUndoing = true;
            rotateFace(lastMove.face, -lastMove.angle, lastMove.layersCount);
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