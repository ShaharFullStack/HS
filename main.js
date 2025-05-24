// main.js - Simple optimized version
import * as Tone from 'tone';
import * as Hands from '@mediapipe/hands';
import * as Camera from '@mediapipe/camera_utils';
import * as THREE from 'three';
import * as Config from './config.js';
import * as THREE_Scene from './visuals/scene.js';
import { HandReactiveParticles } from './visuals/particleSystem.js';
import * as HandTracking from './handTracking/handTracker.js';
import * as UI from './ui/uiManager.js';

// Optimized app state - keeping it simple
export const appState = {
    config: {
        selectedScale: Config.selectedScale,
        selectedRoot: Config.selectedRoot,
        octave: Config.octave,
        selectedSound: Config.selectedSound,
    },
    audio: {
        audioStarted: false,
        isPlaying: false,
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
    // Animation state
    noteChangeTime: 0,
    chordChangeTime: 0,
    lastAnimatedNote: null,
    lastAnimatedChord: null,
    particleExplosionFactor: 0,
    pulseFactor: 0,
    animationIntensity: 0,
    
    // Performance tracking
    lastFrameTime: 0,
    deltaTime: 0,
    fps: 0,
    frameCount: 0
};

// Application components
let handReactiveParticleSystemInstance = null;
let isInitialized = false;
let animationId = null;

// Simple performance monitoring
const performanceStats = {
    lastFPSUpdate: 0,
    frameCount: 0,
    averageFPS: 60
};

// Library validation - check once
let librariesValidated = false;
let librariesValid = false;

function validateLibraries() {
    if (librariesValidated) return librariesValid;
    
    librariesValidated = true;
    
    if (typeof THREE === 'undefined') {
        console.error("THREE.js library not loaded!");
        UI.showMessage("Error: 3D Library missing. Please refresh.", 5000);
        return librariesValid = false;
    }
    if (typeof Tone === 'undefined') {
        console.error("Tone.js library not loaded!");
        UI.showMessage("Error: Audio Library missing. Please refresh.", 5000);
        return librariesValid = false;
    }
    if (typeof Hands === 'undefined' || typeof Camera === 'undefined') {
        console.error("MediaPipe libraries not loaded!");
        UI.showMessage("Error: Hand Tracking Library missing. Please refresh.", 5000);
        return librariesValid = false;
    }

    return librariesValid = true;
}

function initializeScene() {
    try {
        THREE_Scene.setupThreeJS();
        
        if (!THREE_Scene.scene) {
            throw new Error("Failed to create THREE.js scene");
        }

        handReactiveParticleSystemInstance = new HandReactiveParticles(
            THREE_Scene.scene,
            THREE_Scene.renderer,
            THREE_Scene.camera
        );

        console.log("Scene initialized successfully");
        return true;
    } catch (error) {
        console.error("Scene initialization failed:", error);
        UI.showMessage(`Error: Scene setup failed - ${error.message}`, 5000);
        return false;
    }
}

function initializeUI() {
    try {
        UI.createUI();
        UI.createVisualKeyboard();
        UI.addStartAudioButton();
        UI.updateUI();
        console.log("UI initialized successfully");
        return true;
    } catch (error) {
        console.error("UI initialization failed:", error);
        UI.showMessage(`Error: UI setup failed - ${error.message}`, 5000);
        return false;
    }
}

function initializeHandTracking() {
    try {
        HandTracking.setupWebcamElements();
        HandTracking.setupHandTracking();
        console.log("Hand tracking initialized successfully");
        return true;
    } catch (error) {
        console.error("Hand tracking initialization failed:", error);
        UI.showMessage(`Error: Hand tracking setup failed - ${error.message}`, 5000);
        return false;
    }
}

// Simple performance update
function updatePerformanceStats(currentTime) {
    performanceStats.frameCount++;
    
    if (currentTime - performanceStats.lastFPSUpdate >= 1000) {
        performanceStats.averageFPS = performanceStats.frameCount;
        performanceStats.frameCount = 0;
        performanceStats.lastFPSUpdate = currentTime;
        appState.fps = performanceStats.averageFPS;
        
        // Only warn occasionally about low FPS
        if (performanceStats.averageFPS < 30) {
            console.warn(`Low FPS detected: ${performanceStats.averageFPS}`);
        }
    }
}

// Simple app state update
function updateAppState(currentTime, deltaTime) {
    appState.lastFrameTime = currentTime;
    appState.deltaTime = deltaTime;
    appState.frameCount++;
    
    // Update audio playing state
    appState.audio.isPlaying = appState.audio.leftHandIsPlaying || appState.audio.rightHandIsPlaying;
    
    // Simple animation decay - keep it smooth
    appState.particleExplosionFactor *= 0.95;
    appState.pulseFactor *= 0.98;
    appState.animationIntensity *= 0.96;
    
    // Clean up small values
    if (appState.particleExplosionFactor < 0.01) appState.particleExplosionFactor = 0;
    if (appState.pulseFactor < 0.01) appState.pulseFactor = 0;
    if (appState.animationIntensity < 0.01) appState.animationIntensity = 0;
}

function render() {
    if (THREE_Scene.renderer && THREE_Scene.scene && THREE_Scene.camera) {
        THREE_Scene.renderer.render(THREE_Scene.scene, THREE_Scene.camera);
    }
}

// Keep the animation loop simple and fast
function animate() {
    animationId = requestAnimationFrame(animate);
    
    const currentTime = performance.now();
    const deltaTime = currentTime - appState.lastFrameTime;
    
    // Very light frame rate limiting - only for extreme cases
    if (deltaTime < 6) return; // Cap at ~166 FPS only if running too fast
    
    // Update performance stats
    updatePerformanceStats(currentTime);
    
    // Update application state
    updateAppState(currentTime, deltaTime);
    
    // Update particle system with simple error handling
    if (handReactiveParticleSystemInstance) {
        try {
            handReactiveParticleSystemInstance.update();
        } catch (error) {
            console.error("Particle system error:", error);
            // Just log and continue, don't try to recreate
        }
    }
    
    // Render the scene
    render();
}

// Simple resize handler with basic throttling
let resizeTimeout;
function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (THREE_Scene.camera && THREE_Scene.renderer) {
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            THREE_Scene.camera.aspect = width / height;
            THREE_Scene.camera.updateProjectionMatrix();
            THREE_Scene.renderer.setSize(width, height);
            
            if (handReactiveParticleSystemInstance?.onWindowResize) {
                handReactiveParticleSystemInstance.onWindowResize();
            }
        }
    }, 100);
}

// Simple cleanup
function cleanup() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    if (handReactiveParticleSystemInstance?.dispose) {
        handReactiveParticleSystemInstance.dispose();
    }
    handReactiveParticleSystemInstance = null;
    
    if (THREE_Scene.renderer) {
        THREE_Scene.renderer.dispose();
    }
    
    console.log("Application cleanup completed");
}

// Simple initialization
async function init() {
    if (isInitialized) {
        console.warn("Application already initialized");
        return;
    }
    
    console.log("Initializing Application...");
    
    try {
        if (!validateLibraries()) return;
        if (!initializeScene()) return;
        if (!initializeUI()) return;
        if (!initializeHandTracking()) return;
        
        // Set up event listeners
        window.addEventListener('resize', handleResize);
        window.addEventListener('beforeunload', cleanup);
        
        // Start animation
        isInitialized = true;
        appState.lastFrameTime = performance.now();
        animate();
        
        console.log("Application initialized successfully");
        UI.showMessage("Application loaded successfully!", 2000);
        
    } catch (error) {
        console.error("Critical initialization error:", error);
        UI.showMessage(`Critical Error: ${error.message}`, 10000);
        cleanup();
    }
}

// Simple error handling
window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

// Initialize when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { init, cleanup };