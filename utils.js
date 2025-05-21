// utils.js

/**
 * Calculates the Euclidean distance between two 2D points.
 * @param {object} point1 - The first point with x and y properties.
 * @param {object} point2 - The second point with x and y properties.
 * @returns {number} The distance between the two points, or Infinity if points are invalid.
 */
export function calculateDistance(point1, point2) {
  if (!point1 || !point2 || typeof point1.x !== 'number' || typeof point1.y !== 'number' || typeof point2.x !== 'number' || typeof point2.y !== 'number') {
    // console.warn("Invalid points provided to calculateDistance:", point1, point2);
    return Infinity;
  }
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Maps a value from one range to another.
 * Clamps the value to the input range before mapping.
 * @param {number} value - The value to map.
 * @param {number} inMin - The minimum of the input range.
 * @param {number} inMax - The maximum of the input range.
 * @param {number} outMin - The minimum of the output range.
 * @param {number} outMax - The maximum of the output range.
 * @returns {number} The mapped value.
 */
export function mapRange(value, inMin, inMax, outMin, outMax) {
  // Ensure value is within the input range (clamping)
  const clampedValue = Math.max(inMin, Math.min(inMax, value));
  // Perform the mapping
  // Avoid division by zero if inMin === inMax
  if (inMin === inMax) {
    return outMin; // Or (outMin + outMax) / 2, or throw an error, depending on desired behavior
  }
  const result = ((clampedValue - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
  return result;
}

/**
 * Performs linear interpolation between two values.
 * @param {number} start - The start value.
 * @param {number} end - The end value.
 * @param {number} t - The interpolation factor (usually between 0 and 1).
 * @returns {number} The interpolated value.
 */
export function lerp(start, end, t) {
  return start * (1 - t) + end * t;
}
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Helper function for debugging hand positions and current musical output.
 * (Currently commented out in usage, but can be re-enabled for diagnostics)
 * @param {boolean} isLeftHandPresent - Whether the left hand is detected.
 * @param {Array<object>} leftHandLandmarks - Landmarks for the left hand.
 * @param {object} currentChord - The currently playing chord object.
 * @param {boolean} isRightHandPresent - Whether the right hand is detected.
 * @param {Array<object>} rightHandLandmarks - Landmarks for the right hand.
 * @param {string} currentMelodyNote - The currently playing melody note string.
 */
export function debugHandPositions(
    isLeftHandPresent,
    leftHandLandmarks,
    currentChord,
    isRightHandPresent,
    rightHandLandmarks,
    currentMelodyNote
  ) {
  //   console.group("Hand Debug Info");
  //   if (isLeftHandPresent && leftHandLandmarks && leftHandLandmarks[0]) {
  //     console.log("Left Hand Y:", leftHandLandmarks[0].y.toFixed(3), "| Chord:", currentChord ? currentChord.name : "none");
  //   } else if (isLeftHandPresent) {
  //     console.log("Left Hand Present, but landmarks missing/invalid.");
  //   } else {
  //     // console.log("Left Hand: Not Detected");
  //   }

  //   if (isRightHandPresent && rightHandLandmarks && rightHandLandmarks[0]) {
  //     console.log("Right Hand Y:", rightHandLandmarks[0].y.toFixed(3), "| Note:", currentMelodyNote || "none");
  //   } else if (isRightHandPresent) {
  //     console.log("Right Hand Present, but landmarks missing/invalid.");
  //   } else {
  //     // console.log("Right Hand: Not Detected");
  //   }
  //  console.groupEnd();
}
