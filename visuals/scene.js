// visuals/scene.js
import * as THREE from 'three'; // Assuming THREE is globally available via CDN
import { getNoteFromPosition } from '../music/musicLogic.js';
import { mapRange } from '../utils.js';
// import { appState } from '../main.js'; // appState might not be needed here if getNoteFromPosition handles its own state access

export let scene, camera, renderer;

export function setupThreeJS() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000a14);

  camera = new THREE.PerspectiveCamera(
    35, window.innerWidth / window.innerHeight, 0.1, 1000
  );
  camera.position.z = 200;

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true // Useful for effects or screenshots
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  // renderer.autoClear = false; // Set to true if you want standard clearing, false for manual control or effects like trails.
                               // The particle system might handle its own clearing/layering.
                               // For the "Chord Blast" inspired system, true is fine as it's a 3D scene.
  renderer.autoClear = true;


  const container = document.getElementById('container');
  if (container) {
    container.appendChild(renderer.domElement);
  } else {
    console.error("Container element not found for renderer!");
    return;
  }

  window.addEventListener('resize', onWindowResize);
  // REMOVED: createParticleSystem(scene);
  // Particle system instantiation is now handled in main.js
}

export function onWindowResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  // If the particle system needs to react to camera changes (e.g. for frustum culling or perspective effects),
  // you might call a resize handler on it here.
  // if (window.handReactiveParticleSystemInstance) { // Assuming instance is globally accessible or passed
  //   window.handReactiveParticleSystemInstance.onWindowResize();
  // }
}

// This function draws on a 2D canvas context, typically the MediaPipe overlay.
// It's separate from the Three.js scene rendering.
export function drawNoteGrid(ctx, canvasWidth, canvasHeight) {
  if (!ctx) {
      console.warn("drawNoteGrid: No canvas context provided.");
      return;
  }
  const gridLines = 16; // Example number of lines
  ctx.save();
  for (let i = 0; i <= gridLines; i++) {
    const y = mapRange(i, 0, gridLines, 0.05, 0.95) * canvasHeight;
    if (i === 7) { // Example: highlight an octave line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
    }
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasWidth, y);
    ctx.stroke();

    if (i < gridLines) {
      ctx.font = '12px Arial';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      // getNoteFromPosition will use appState.config.selectedScale internally
      const noteName = getNoteFromPosition(mapRange(i, 0, gridLines, 1.0, 0.0));
      if (typeof noteName === 'string') {
        ctx.fillText(noteName, 5, y - 5);
      }
    }
  }
  ctx.restore();
}
