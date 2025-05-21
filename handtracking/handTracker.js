// handtracking/handTracker.js
// Assumes MediaPipe's Hands, Camera, and drawing_utils are globally available
// e.g., via CDN: <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"></script> etc.

import { drawNoteGrid } from '../visuals/scene.js';
import { calculateDistance } from '../utils.js';
import { getChordFromPosition, getNoteFromPosition } from '../music/musicLogic.js';
import { playChord, playMelodyNote, setVolume, stopChord, stopMelody } from '../audio/audioEngine.js';
import { showMessage } from '../ui/uiManager.js';
import { MIN_PINCH_DIST, MAX_PINCH_DIST } from '../config.js';
import { mapRange } from '../utils.js'; // Added for volume circle
import { appState } from '../main.js'; // Import shared state


export let canvasCtx, canvasElement, videoElement;
export let hands; // MediaPipe Hands instance

// Hand state moved to appState.hands
// export let isLeftHandPresent = false;
// export let isRightHandPresent = false;
// export let leftHandLandmarks = null;
// export let rightHandLandmarks = null;
// let handDetected = false;


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
    hands = new Hands({ // Assuming Hands is global
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.75,
      minTrackingConfidence: 0.75
    });

    hands.onResults(onHandResults);

    const mpCamera = new Camera(videoElement, { // Assuming Camera is global
      onFrame: async () => {
        if (videoElement.readyState >= 2) { // VIDEO_CURRENT_DATA_AVAILABLE or more
          await hands.send({ image: videoElement });
        }
      },
      width: 1420, // Match canvas width
      height: 772 // Match canvas height
    });

    mpCamera.start()
      .then(() => {
        console.log("Camera started successfully.");
        if (!appState.audio.audioStarted) { // Only show if audio not yet started by button
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


function onHandResults(results) {
  if (!canvasCtx || !canvasElement) return;

  let wasLeftHandPresent = appState.hands.isLeftHandPresent;
  let wasRightHandPresent = appState.hands.isRightHandPresent;
  appState.hands.isLeftHandPresent = false;
  appState.hands.isRightHandPresent = false;
  appState.hands.leftHandLandmarks = null;
  appState.hands.rightHandLandmarks = null;
  appState.hands.handDetected = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  drawNoteGrid(canvasCtx, canvasElement.width, canvasElement.height);

  if (appState.hands.handDetected) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0 && !appState.hands.initialHandDetected) {
        console.log(`Detected ${results.multiHandLandmarks.length} hand(s)`);
        appState.hands.initialHandDetected = true; // To prevent logging on every frame
    }

    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      if (!results.multiHandedness || !results.multiHandedness[i]) continue;

      const classification = results.multiHandedness[i];
      const landmarks = results.multiHandLandmarks[i];
      const isLeftHandMediaPipe = classification.label === 'Left'; // MediaPipe's definition

      // Correcting for mirrored video: What MediaPipe calls "Left" appears as the user's right hand on screen.
      // And what MediaPipe calls "Right" appears as the user's left hand on screen.
      // So, we effectively swap them for our logic if video is mirrored (common for selfie view).
      // For this application:
      // - Melody is often played by the dominant (usually right) hand.
      // - Harmony by the other (usually left) hand.
      // If MediaPipe 'Left' is user's right hand (appears on right side of screen):
      // This hand will control MELODY.
      // If MediaPipe 'Right' is user's left hand (appears on left side of screen):
      // This hand will control HARMONY.

      if (isLeftHandMediaPipe) { // This is the hand on the RIGHT side of the screen (user's right hand usually)
        appState.hands.isRightHandPresent = true; // Our app's "right hand" for melody
        appState.hands.rightHandLandmarks = landmarks;

        if (landmarks && landmarks.length > 8) {
          const wrist = landmarks[0];
          if (wrist && typeof wrist.y === 'number') {
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const pinchDist = calculateDistance(thumbTip, indexTip);
            setVolume('right', pinchDist); // Control melody volume
            const note = getNoteFromPosition(wrist.y);
            playMelodyNote(note);

            canvasCtx.font = 'bold 24px Arial';
            canvasCtx.fillStyle = 'magenta'; // Melody hand color
            canvasCtx.fillText(note, (wrist.x * canvasElement.width) - 15, (wrist.y * canvasElement.height) - 30);
            
            const volumeLevel = mapRange(pinchDist, MIN_PINCH_DIST, MAX_PINCH_DIST, 0, 1);
            canvasCtx.beginPath();
            canvasCtx.arc((thumbTip.x + indexTip.x) / 2 * canvasElement.width, (thumbTip.y + indexTip.y) / 2 * canvasElement.height, 20 * volumeLevel, 0, Math.PI * 2);
            canvasCtx.fillStyle = `rgba(100, 100, 255, ${volumeLevel})`; // Melody pinch color
            canvasCtx.fill();
            canvasCtx.beginPath();
            canvasCtx.moveTo(thumbTip.x * canvasElement.width, thumbTip.y * canvasElement.height);
            canvasCtx.lineTo(indexTip.x * canvasElement.width, indexTip.y * canvasElement.height);
            canvasCtx.strokeStyle = 'rgba(255, 0, 255, 0.8)'; // Melody pinch line
            canvasCtx.lineWidth = 5;
            canvasCtx.stroke();
          }
        }
      } else { // MediaPipe 'Right' hand - this is hand on LEFT side of screen (user's left hand usually)
        appState.hands.isLeftHandPresent = true; // Our app's "left hand" for harmony
        appState.hands.leftHandLandmarks = landmarks;

        if (landmarks && landmarks.length > 8) {
          const wrist = landmarks[0];
          if (wrist && typeof wrist.y === 'number') {
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const pinchDist = calculateDistance(thumbTip, indexTip);
            setVolume('left', pinchDist); // Control harmony volume
            const chord = getChordFromPosition(wrist.y);
            playChord(chord);

            canvasCtx.font = 'bold 24px Arial';
            canvasCtx.fillStyle = 'white'; // Harmony hand color
            canvasCtx.fillText(chord.name, (wrist.x * canvasElement.width) - 15, (wrist.y * canvasElement.height) - 30);

            const volumeLevel = mapRange(pinchDist, MIN_PINCH_DIST, MAX_PINCH_DIST, 0, 1);
            canvasCtx.beginPath();
            canvasCtx.arc((thumbTip.x + indexTip.x) / 2 * canvasElement.width, (thumbTip.y + indexTip.y) / 2 * canvasElement.height, 20 * volumeLevel, 0, Math.PI * 2);
            canvasCtx.fillStyle = `rgba(200, 55, 100, ${volumeLevel})`; // Harmony pinch color
            canvasCtx.fill();
            canvasCtx.beginPath();
            canvasCtx.moveTo(thumbTip.x * canvasElement.width, thumbTip.y * canvasElement.height);
            canvasCtx.lineTo(indexTip.x * canvasElement.width, indexTip.y * canvasElement.height);
            canvasCtx.strokeStyle = 'rgb(255, 230, 0)'; // Harmony pinch line
            canvasCtx.lineWidth = 3;
            canvasCtx.stroke();
          }
        }
      }
      // Draw landmarks and connections (color based on MediaPipe's label for consistency with its drawing utils)
      const handColor = isLeftHandMediaPipe ? 'rgba(0, 255, 200, 0.8)' : 'rgb(231, 150, 0)'; // Original colors
      if (window.drawConnectors && window.HAND_CONNECTIONS) { // Check if drawing_utils are loaded
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: handColor, lineWidth: 10 });
        drawLandmarks(canvasCtx, landmarks, { color: handColor, lineWidth: 1, radius: 2 });
      }
    }
  } else { // No hands detected
    appState.hands.initialHandDetected = false; // Reset for next detection
    if (wasRightHandPresent) stopMelody(); // If melody hand was present and now gone
    if (wasLeftHandPresent) stopChord();   // If harmony hand was present and now gone
  }

  // Stop sounds if a specific hand disappears
  if (!appState.hands.isRightHandPresent && wasRightHandPresent) {
    stopMelody();
  }
  if (!appState.hands.isLeftHandPresent && wasLeftHandPresent) {
    stopChord();
  }

  canvasCtx.restore();
}