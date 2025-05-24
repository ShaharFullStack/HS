// handtracking/handTracker.js - Optimized Version

import { playChord, playMelodyNote, setVolume, stopChord, stopMelody } from '../audio/audioEngine.js';
import { appState } from '../main.js';
import { getChordFromPosition, getNoteFromPosition } from '../music/musicLogic.js';
import { showMessage } from '../ui/uiManager.js';
import { calculateDistance } from '../utils.js';
import { drawNoteGrid } from '../visuals/scene.js';

export let canvasCtx, canvasElement, videoElement;
export let hands;

// Performance optimization variables
let frameCount = 0;
let lastAudioUpdate = 0;
let lastDrawUpdate = 0;
let previousStates = {
  leftHand: { note: null, volume: null, isPresent: false, yPosition: 0.5, lastSignificantY: 0.5 },
  rightHand: { note: null, volume: null, isPresent: false, yPosition: 0.5 }
};

// Configuration constants
const AUDIO_UPDATE_INTERVAL = 20;  // 50 FPS for smooth audio
const DRAW_UPDATE_INTERVAL = 33;   // 30 FPS for visuals
const POSITION_THRESHOLD = 0.018;  // Minimum change to trigger audio update
const VOLUME_THRESHOLD = 0.04;     // Minimum volume change to trigger update

export function setupWebcamElements() {
  videoElement = document.querySelector('.input_video');
  canvasElement = document.querySelector('.output_canvas');

  if (canvasElement) {
    canvasCtx = canvasElement.getContext('2d');
  } else {
    console.error("Output canvas element not found!");
  }
  if (!videoElement) {
    console.error("Input video element not found!");
  }
}

export function setupHandTracking() {
  if (!videoElement || !canvasElement || !canvasCtx) {
    console.error("Video or Canvas element not ready for Hand Tracking setup.");
    return;
  }

  try {
    hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 0, // Fastest for best performance
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });

    hands.onResults(onHandResults);

    const mpCamera = new Camera(videoElement, {
      onFrame: async () => {
        frameCount++;
        if (frameCount % 2 === 0 && videoElement.readyState >= 2) { // Every 2nd frame
          await hands.send({ image: videoElement });
        }
      },
      width: 1420,
      height: 772
    });

    mpCamera.start()
      .then(() => {
        console.log("Camera started successfully.");
        if (!appState.audio.audioStarted) {
             showMessage("Camera is on. Press 'Start Audio' to play.");
        }
      })
      .catch(err => {
        console.error("Error starting webcam:", err);
        const instructions = document.getElementById('instructions');
        if (instructions) instructions.textContent = "Cannot access webcam. Please allow access.";
      });

  } catch (error) {
    console.error("Error setting up MediaPipe Hands:", error);
  }
}

function shouldUpdateAudio(currentTime) {
  return currentTime - lastAudioUpdate > AUDIO_UPDATE_INTERVAL;
}

function shouldUpdateDraw(currentTime) {
  return currentTime - lastDrawUpdate > DRAW_UPDATE_INTERVAL;
}

function hasSignificantChange(current, previous, threshold) {
  if (!previous) return true;
  return Math.abs(current - previous) > threshold;
}

function onHandResults(results) {
  if (!canvasCtx || !canvasElement) return;

  const currentTime = performance.now();
  
  // Update hand presence state
  let wasLeftHandPresent = appState.hands.isLeftHandPresent;
  let wasRightHandPresent = appState.hands.isRightHandPresent;
  appState.hands.isLeftHandPresent = false;
  appState.hands.isRightHandPresent = false;
  appState.hands.leftHandLandmarks = null;
  appState.hands.rightHandLandmarks = null;
  appState.hands.handDetected = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;

  // Only update visuals if enough time has passed
  const shouldDraw = shouldUpdateDraw(currentTime);
  if (shouldDraw) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    drawNoteGrid(canvasCtx, canvasElement.width, canvasElement.height);
    lastDrawUpdate = currentTime;
  }

  if (appState.hands.handDetected) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0 && !appState.hands.initialHandDetected) {
        console.log(`Detected ${results.multiHandLandmarks.length} hand(s)`);
        appState.hands.initialHandDetected = true;
    }

    const shouldUpdateAudioNow = shouldUpdateAudio(currentTime);

    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      if (!results.multiHandedness || !results.multiHandedness[i]) continue;

      const classification = results.multiHandedness[i];
      const landmarks = results.multiHandLandmarks[i];
      const isLeftHandMediaPipe = classification.label === 'Left';

      if (isLeftHandMediaPipe) {
        appState.hands.isRightHandPresent = true;
        appState.hands.rightHandLandmarks = landmarks;

        if (landmarks && landmarks.length > 8) {
          const wrist = landmarks[0];
          if (wrist && typeof wrist.y === 'number') {
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const pinchDist = calculateDistance(thumbTip, indexTip);
            
            // Update position tracking
            previousStates.rightHand.yPosition = wrist.y;

            // Only update audio if enough time has passed and values changed significantly
            if (shouldUpdateAudioNow) {
              const prevState = previousStates.rightHand;
              
              if (hasSignificantChange(pinchDist, prevState.volume, VOLUME_THRESHOLD)) {
                setVolume('right', pinchDist);
                prevState.volume = pinchDist;
              }
              
              const note = getNoteFromPosition(wrist.y);
              if (note !== prevState.note || hasSignificantChange(wrist.y, prevState.yPosition, POSITION_THRESHOLD)) {
                playMelodyNote(note, wrist.y); // Pass position for velocity calculation
                prevState.note = note;
              }
            }
          }
        }
      } else {
        appState.hands.isLeftHandPresent = true;
        appState.hands.leftHandLandmarks = landmarks;

        if (landmarks && landmarks.length > 8) {
          const wrist = landmarks[0];
          if (wrist && typeof wrist.y === 'number') {
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const pinchDist = calculateDistance(thumbTip, indexTip);
            
            // Update position tracking
            previousStates.leftHand.yPosition = wrist.y;

            // Only update audio if enough time has passed and values changed significantly
            if (shouldUpdateAudioNow) {
              const prevState = previousStates.leftHand;
              
              if (hasSignificantChange(pinchDist, prevState.volume, VOLUME_THRESHOLD)) {
                setVolume('left', pinchDist);
                prevState.volume = pinchDist;
              }
              
              const chord = getChordFromPosition(wrist.y);
              
              // More sophisticated chord change detection
              const chordChanged = !chord || !prevState.note || 
                                   chord.name !== prevState.note.name ||
                                   hasSignificantChange(wrist.y, prevState.lastSignificantY, POSITION_THRESHOLD * 1.5);
              
              if (chordChanged) {
                playChord(chord, wrist.y); // Pass position for velocity calculation
                prevState.note = chord;
                prevState.lastSignificantY = wrist.y;
              }
            }
          }
        }
      }

      // Only draw landmarks if we're updating visuals this frame
      if (shouldDraw) {
        const handColor = isLeftHandMediaPipe ? 'rgba(0, 255, 200, 0.8)' : 'rgb(231, 150, 0)';
        if (window.drawConnectors && window.HAND_CONNECTIONS) {
          drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: handColor, lineWidth: 6 });
          drawLandmarks(canvasCtx, landmarks, { color: handColor, lineWidth: 1, radius: 1 });
        }
      }
    }

    // Update audio timestamp if we processed audio this frame
    if (shouldUpdateAudioNow) {
      lastAudioUpdate = currentTime;
    }

  } else {
    // No hands detected
    appState.hands.initialHandDetected = false;
    if (wasRightHandPresent) {
      stopMelody();
      previousStates.rightHand = { note: null, volume: null, isPresent: false, yPosition: 0.5 };
    }
    if (wasLeftHandPresent) {
      stopChord();
      previousStates.leftHand = { note: null, volume: null, isPresent: false, yPosition: 0.5, lastSignificantY: 0.5 };
    }
  }

  // Stop sounds if a specific hand disappears
  if (!appState.hands.isRightHandPresent && wasRightHandPresent) {
    stopMelody();
    previousStates.rightHand = { note: null, volume: null, isPresent: false, yPosition: 0.5 };
  }
  if (!appState.hands.isLeftHandPresent && wasLeftHandPresent) {
    stopChord();
    previousStates.leftHand = { note: null, volume: null, isPresent: false, yPosition: 0.5, lastSignificantY: 0.5 };
  }

  if (shouldDraw) {
    canvasCtx.restore();
  }
}

// Debug function for performance monitoring
export function getHandTrackingStats() {
  return {
    frameCount: frameCount,
    audioUpdateInterval: AUDIO_UPDATE_INTERVAL,
    drawUpdateInterval: DRAW_UPDATE_INTERVAL,
    leftHandPosition: previousStates.leftHand.yPosition,
    rightHandPosition: previousStates.rightHand.yPosition,
    leftHandNote: previousStates.leftHand.note?.name || 'none',
    rightHandNote: previousStates.rightHand.note || 'none',
    thresholds: {
      position: POSITION_THRESHOLD,
      volume: VOLUME_THRESHOLD
    }
  };
}

// Export for console debugging
if (typeof window !== 'undefined') {
  window.getHandTrackingStats = getHandTrackingStats;
}