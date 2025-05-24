// config.js

// Music theory variables
export let selectedScale = 'major';
export let selectedRoot = 'C';
export let octave = 4;
export let selectedSound = 'pad';

// Scales definition
export const scales = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9, 12],
  majorBlues: [0, 3, 5, 6, 7, 10, 12],
  minorBlues: [0, 3, 5, 6, 7, 10, 12],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
};

// Notes and chord types
export const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const chordTypes = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  minor7: [0, 3, 7, 10],
  diminished: [0, 3, 6],
  augmented: [0, 4, 8],
  sus4: [0, 5, 7],
  dominant7: [0, 4, 7, 10],
  major7: [0, 4, 7, 11]
};

// Update sound presets with optimized settings to reduce distortion
export const soundPresets = {
  synth: {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.8 }
  },
  bell: {
    oscillator: { type: 'sine4' },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 1.5 }
  },
  synth2: { // Duplicate entry, keeping one
    oscillator: { type: 'sine2' },
    envelope: { attack: 0.0005, decay: 0.02, sustain: 0.9, release: 0.5 }
  },
  pad: {
    oscillator: { type: 'sine8' },
    envelope: { attack: 0.4, decay: 0.7, sustain: 0.6, release: 2 }
  },
  pluck: {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.3 }
  },
  piano: {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0.7, release: 0.3 }
    }
};

// Gesture variables
export const MIN_PINCH_DIST = 0.01;
export const MAX_PINCH_DIST = 0.1;

// Functions to update config values if needed from other modules
export function setSelectedScale(value) { selectedScale = value; }
export function setSelectedRoot(value) { selectedRoot = value; }
export function setOctave(value) { octave = parseInt(value); }
export function setSelectedSound(value) { selectedSound = value; }