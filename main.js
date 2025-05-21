// main.js
import * as Tone from 'tone'; // Ensure Tone.js is loaded
import * as Hands from '@mediapipe/hands'; // Ensure MediaPipe Hands is loaded
import * as Camera from '@mediapipe/camera_utils'; // Ensure MediaPipe Camera is loaded
import * as THREE from 'three'; // Ensure THREE.js is loaded
import * as Config from './config.js';
// Utils are imported where needed (e.g., in particleSystem.js or musicLogic.js)
import * as THREE_Scene from './visuals/scene.js'; // Uses the corrected scene.js
import { HandReactiveParticles } from './visuals/particleSystem.js'; // Ensure this path is correct

// Hand tracking logic
import * as HandTracking from './handTracking/handTracker.js';
// UI manager
import * as UI from './ui/uiManager.js';

// REMOVED: export const { scene, camera, renderer, composer, particles } = new HandReactiveParticles();
// This line was problematic. Scene components should come from THREE_Scene.

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

// Declare handReactiveParticleSystemInstance at a scope accessible by init and animate
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

    // Sets up the main 3D scene, camera, and renderer
    // Ensure THREE_Scene.setupThreeJS() correctly initializes THREE_Scene.scene, .camera, and .renderer
    THREE_Scene.setupThreeJS();

    // Initialize the HandReactiveParticles system after the main scene is available
    if (THREE_Scene.scene) {
        // This is where the instance is created.
        // The HandReactiveParticles class MUST have an 'update' method.
        handReactiveParticleSystemInstance = new HandReactiveParticles(THREE_Scene.scene /*, appState (optional) */);
        // You might want to pass appState to HandReactiveParticles if it needs direct access,
        // or it can import it if circular dependencies are managed.
    } else {
        console.error("Main scene (THREE_Scene.scene) is not available for particle system initialization.");
        UI.showMessage("Error: Scene setup failed for particles.", 5000);
        return; // Stop initialization if scene isn't ready
    }

    UI.createUI();
    UI.createVisualKeyboard();
    HandTracking.setupWebcamElements(); // Sets up video and 2D canvas elements for MediaPipe
    HandTracking.setupHandTracking();   // Starts camera and MediaPipe processing
    UI.updateInstructions();
    UI.addStartAudioButton();       // Handles AudioContext start and AudioEngine setup

    UI.updateUI(); // Initial UI state based on defaults
    animate(); // Start the animation loop
}

function animate() {
    requestAnimationFrame(animate);
    // const now = Date.now() * 0.001; // 'now' can be passed to update methods if needed

    // Update overall playing state for particles or other systems if needed globally
    appState.audio.isPlaying = appState.audio.leftHandIsPlaying || appState.audio.rightHandIsPlaying;

    // Update the 3D particle system
    // This is where the error occurs if 'update' is not a function
    if (handReactiveParticleSystemInstance && typeof handReactiveParticleSystemInstance.update === 'function') {
        handReactiveParticleSystemInstance.update(); // This will use appState internally or if passed
    } else if (handReactiveParticleSystemInstance) {
        // This condition will catch if the instance exists but .update is not a function
        console.error("HandReactiveParticles instance does not have an update method!", handReactiveParticleSystemInstance);
        // You might want to stop the animation loop or show an error message to the user
        // For now, we'll just log it and prevent further errors in this frame for this call.
        return; // Optionally skip rendering this frame or part of it
    }


    // Render the main THREE.js scene (which includes the particles)
    if (THREE_Scene.renderer && THREE_Scene.scene && THREE_Scene.camera) {
        THREE_Scene.renderer.render(THREE_Scene.scene, THREE_Scene.camera);
    }
}

// Optional: Resize handler
// window.addEventListener('resize', () => {
//   if (THREE_Scene.camera && THREE_Scene.renderer) {
//     THREE_Scene.camera.aspect = window.innerWidth / window.innerHeight;
//     THREE_Scene.camera.updateProjectionMatrix();
//     THREE_Scene.renderer.setSize(window.innerWidth, window.innerHeight);
//   }
//   if (handReactiveParticleSystemInstance && typeof handReactiveParticleSystemInstance.onWindowResize === 'function') {
//       // Call a resize method on particle system if it needs to adapt
//       // handReactiveParticleSystemInstance.onWindowResize(THREE_Scene.camera, window.innerWidth, window.innerHeight);
//   }
// });
