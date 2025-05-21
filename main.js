// main.js
import * as Tone from 'tone'; // Ensure Tone.js is loaded
import * as Hands  from '@mediapipe/hands'; // Ensure MediaPipe Hands is loaded
import * as Camera  from '@mediapipe/camera_utils'; // Ensure MediaPipe Camera is loaded
import * as THREE from 'three'; // Ensure THREE.js is loaded
import * as Config from './config.js';
// Utils are imported where needed (e.g., in particleSystem.js or musicLogic.js)
import * as THREE_Scene from './visuals/scene.js'; // Uses the corrected scene.js
import { HandReactiveParticles } from './visuals/particleSystem.js'; // The 3D particle system from Canvas
import * as UI from './ui/uiManager.js';
import * as HandTracking from './handTracking/handTracker.js'; // Hand tracking logic
// AudioEngine is initialized via UI interaction (Start Audio button in uiManager.js)

export const appState = {
    config: {
        selectedScale: Config.selectedScale,
        selectedRoot: Config.selectedRoot,
        octave: Config.octave,
        selectedSound: Config.selectedSound,
    },
    audio: {
        audioStarted: false,
        isPlaying: false, // Consolidated playing state, can be true if either hand is playing
        leftHandIsPlaying: false,
        rightHandIsPlaying: false,
        currentMelodyNote: null,
        currentChord: null,
        leftHandVolume: -14,
        rightHandVolume: -10,
    },
    hands: {
        isLeftHandPresent: false,
        isRightHandPresent: false,
        leftHandLandmarks: null,
        rightHandLandmarks: null,
        handDetected: false,
    },
    // Particle animation state, managed centrally for the 3D particle system
    noteChangeTime: 0,
    chordChangeTime: 0,
    lastAnimatedNote: null,
    lastAnimatedChord: null,
    particleExplosionFactor: 0, // Used by HandReactiveParticles for audio reactivity
    pulseFactor: 0,             // Used by HandReactiveParticles for audio reactivity
    animationIntensity: 0,      // General animation intensity, can be used by particles
};

// Global reference for the particle system instance for potential access (e.g., resize)
// However, it's better to pass it or manage it via a more structured approach if needed elsewhere.
// window.handReactiveParticleSystemInstance = null; // Avoid global if possible
let handReactiveParticleSystemInstance;


window.addEventListener('load', init);

function init() {
  console.log("Initializing Application (after window.load)...");

  // Library checks (essential for stability)
  if (typeof THREE === 'undefined') {
    console.error("THREE.js library not loaded!");
    UI.showMessage("Error: 3D Library missing. Please refresh.", 5000);
    return;
  }
  if (typeof Tone === 'undefined') {
    console.error("Tone.js library not loaded!");
    UI.showMessage("Error: Audio Library missing. Please refresh.", 5000);
    return;
  }
  if (typeof Hands === 'undefined' || typeof Camera === 'undefined') {
    console.error("MediaPipe Hands or Camera library not loaded!");
    UI.showMessage("Error: Hand Tracking Library missing. Please refresh.", 5000);
    return;
  }

  THREE_Scene.setupThreeJS(); // Sets up the main 3D scene, camera, and renderer

  // Initialize the HandReactiveParticles system after the main scene is available
  if (THREE_Scene.scene) {
    handReactiveParticleSystemInstance = new HandReactiveParticles(THREE_Scene.scene);
    // window.handReactiveParticleSystemInstance = handReactiveParticleSystemInstance; // If global access needed
  } else {
    console.error("Main scene (THREE_Scene.scene) is not available for particle system initialization.");
    UI.showMessage("Error: Scene setup failed for particles.", 5000);
    return; // Stop initialization if scene isn't ready
  }

  UI.createUI();
  UI.createNoteMarkers(); // Creates 2D markers on the MediaPipe canvas overlay
  UI.createVisualKeyboard();
  HandTracking.setupWebcamElements(); // Sets up video and 2D canvas elements for MediaPipe
  HandTracking.setupHandTracking();   // Starts camera and MediaPipe processing
  UI.updateInstructions();
  UI.addStartAudioButton();       // Handles AudioContext start and AudioEngine setup

  UI.updateUI(); // Initial UI state based on defaults
  animate();
}

function animate() {
  requestAnimationFrame(animate);
  // const now = Date.now() * 0.001; // 'now' is used internally by HandReactiveParticles if needed

  // Update overall playing state for particles
  appState.audio.isPlaying = appState.audio.leftHandIsPlaying || appState.audio.rightHandIsPlaying;


  // Update the 3D particle system
  if (handReactiveParticleSystemInstance) {
    handReactiveParticleSystemInstance.update(); // This will use appState internally
  }

  // Render the main THREE.js scene (which includes the particles)
  if (THREE_Scene.renderer && THREE_Scene.scene && THREE_Scene.camera) {
    THREE_Scene.renderer.render(THREE_Scene.scene, THREE_Scene.camera);
  }
}

// Optional: If your particle system's appearance depends on camera/viewport changes
// not handled by its internal logic, you might add a resize handler.
// The current HandReactiveParticles.onWindowResize is a no-op.
// window.addEventListener('resize', () => {
//   if (handReactiveParticleSystemInstance) {
//      // Call a resize method on particle system if it needs to adapt to camera changes
//      // handReactiveParticleSystemInstance.onWindowResize(THREE_Scene.camera, window.innerWidth, window.innerHeight);
//   }
// });
