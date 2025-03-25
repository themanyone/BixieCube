import * as THREE from 'https://unpkg.com/three/build/three.module.js';
import { scene, camera, renderer, controls, rubyCube, cubieSize, gap, numPerAxis, getOffset } from './init.js';

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

// Global variables for face dragging.
let isFaceDragging = false;
let dragStart = null;
let currentFace = null;
let dragCubie = null;
let faceCenterScreen = null;
const raycaster = new THREE.Raycaster();

function projectToScreen(pos3D) {
    const pos = pos3D.clone().project(camera);
    return {
        x: (pos.x + 1) / 2 * renderer.domElement.clientWidth,
        y: (-pos.y + 1) / 2 * renderer.domElement.clientHeight
    };
}

// Replace the previous mousedown/mouseup face dragging handlers for rubyCube.

let selectedFace = null;

renderer.domElement.addEventListener('mousedown', (event) => {
    const mouse = new THREE.Vector2(
        (event.clientX / renderer.domElement.clientWidth) * 2 - 1,
        -(event.clientY / renderer.domElement.clientHeight) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);
    // Intersect with the cube's children to get a hit point on the cube.
    const intersects = raycaster.intersectObjects(rubyCube.children, true);
    if (intersects.length > 0) {
        const intersection = intersects[0];
        // Create a bounding box around the entire cube.
        const box = new THREE.Box3().setFromObject(rubyCube);
        // Compare the intersection point to each face of the box.
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
        
        // Compute the 3D center of the selected face.
        const centerX = (box.min.x + box.max.x) / 2;
        const centerY = (box.min.y + box.max.y) / 2;
        const centerZ = (box.min.z + box.max.z) / 2;
        let faceCenter3D = new THREE.Vector3();
        switch (selectedFace) {
            case 'right':  faceCenter3D.set(box.max.x, centerY, centerZ); break;
            case 'left':   faceCenter3D.set(box.min.x, centerY, centerZ); break;
            case 'top':    faceCenter3D.set(centerX, box.max.y, centerZ); break;
            case 'bottom': faceCenter3D.set(centerX, box.min.y, centerZ); break;
            case 'front':  faceCenter3D.set(centerX, centerY, box.max.z); break;
            case 'back':   faceCenter3D.set(centerX, centerY, box.min.z); break;
        }
        // Project the face center to screen coordinates.
        const pos = faceCenter3D.clone().project(camera);
        faceCenterScreen = {
            x: (pos.x + 1) / 2 * renderer.domElement.clientWidth,
            y: (-pos.y + 1) / 2 * renderer.domElement.clientHeight
        };
        dragStart = { x: event.clientX, y: event.clientY };
        controls.enabled = false;
    }
});

renderer.domElement.addEventListener('mouseup', (event) => {
    if (selectedFace && faceCenterScreen && dragStart) {
        const dragEnd = { x: event.clientX, y: event.clientY };
        const dx = dragEnd.x - dragStart.x;
        const dy = dragEnd.y - dragStart.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        // Only proceed if the drag is significant.
        if (distance > 5) {
            // Compute vectors from the face center (screen coords) to the drag start and end.
            const v1 = { x: dragStart.x - faceCenterScreen.x, y: dragStart.y - faceCenterScreen.y };
            const v2 = { x: dragEnd.x - faceCenterScreen.x,   y: dragEnd.y - faceCenterScreen.y };
            // Use the z-component of the cross product to decide rotation direction.
            const cross = v1.x * v2.y - v1.y * v2.x;
            let angle = cross > 0 ? -Math.PI / 2 : Math.PI / 2;
            if (selectedFace === 'bottom' || selectedFace === 'left' || selectedFace === 'back') {
                angle = -angle;
            }
            rotateFace(selectedFace, angle, currentLayers);
        }
    }
    // Reset state and re-enable OrbitControls.
    selectedFace = null;
    faceCenterScreen = null;
    dragStart = null;
    controls.enabled = true;
});