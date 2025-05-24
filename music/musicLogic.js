
// music/musicLogic.js - Fixed and Enhanced Version

import { scales, notes, chordTypes } from '../config.js';

import { mapRange } from '../utils.js';

import { appState } from '../main.js';



let lastRightHandY = 0;

let lastLeftHandY = 0;



// Enhanced chord progression mappings - simplified to basic triads and 7th chords

const CHORD_PROGRESSIONS = {

  major: ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished'], // I ii iii IV V vi vii°

  minor: ['minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major'], // i ii° III iv v VI VII

  dorian: ['minor', 'minor', 'major', 'major', 'minor', 'diminished', 'major'], // i ii III IV v vi° VII

  phrygian: ['minor', 'major', 'major', 'minor', 'diminished', 'major', 'minor'], // i II III iv v° VI vii

  lydian: ['major', 'major', 'minor', 'diminished', 'major', 'minor', 'minor'], // I II iii iv° V vi vii

  mixolydian: ['major', 'minor', 'diminished', 'major', 'minor', 'minor', 'major'], // I ii iii° IV v vi VII

  aeolian: ['minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major'], // Same as natural minor

  locrian: ['diminished', 'major', 'minor', 'minor', 'major', 'major', 'minor'], // i° II iii iv V VI vii

  majorBlues: ['major', 'major', 'minor', 'major', 'major', 'minor'], // Simplified blues progression

  minorBlues: ['minor', 'minor', 'major', 'minor', 'minor', 'major'], // Simplified minor blues

  pentatonicMajor: ['major', 'minor', 'minor', 'major', 'minor'], // Based on major pentatonic

  pentatonicMinor: ['minor', 'major', 'minor', 'minor', 'major'], // Based on minor pentatonic

  chromatic: ['major', 'minor', 'major', 'minor', 'major', 'minor', 'major', 'minor', 'major', 'minor', 'major', 'minor']

};



// Safe note calculation with bounds checking

function calculateNoteFromMIDI(midiNote) {

  // Clamp MIDI note to valid range (0-127)

  const clampedMidi = Math.max(0, Math.min(127, Math.round(midiNote)));

  const noteIndex = clampedMidi % 12;

  const octave = Math.floor(clampedMidi / 12) - 1; // MIDI octave to standard octave



  // Ensure valid note index

  const validNoteIndex = Math.max(0, Math.min(11, noteIndex));

  const validOctave = Math.max(0, Math.min(9, octave)); // Reasonable octave range



  return notes[validNoteIndex] + validOctave;

}



// Enhanced position mapping with better scale handling

export function getNoteFromPosition(y) {

  // Validate and clamp input

  const validY = Math.max(0, Math.min(1, typeof y === 'number' ? y : 0.5));

  const positionChanged = Math.abs(validY - lastRightHandY) > 0.001;

  lastRightHandY = validY;



  // Get current scale and settings with fallbacks

  const currentScale = appState.config.selectedScale || 'major';

  const scaleArray = scales[currentScale] || scales.major;

  const currentOctave = Math.max(2, Math.min(7, appState.config.octave || 4)); // Clamp octave

  const currentRoot = appState.config.selectedRoot || 'C';



  // Enhanced position mapping - more notes for larger scales

  const scaleLength = scaleArray.length;

  const totalRange = Math.max(14, scaleLength + 7); // Minimum 14, or scale length + extra range

  const position = Math.floor(mapRange(validY, 0.0, 1.0, totalRange - 1, 0)); // Inverted mapping



  // Calculate octave offset and scale position

  const octaveOffset = Math.floor(position / scaleLength);

  const indexInScale = position % scaleLength;



  // Validate scale data

  const semitones = scaleArray[indexInScale];

  if (typeof semitones !== 'number' || semitones < 0 || semitones > 12) {

    console.warn(`Invalid semitones at index ${indexInScale} for scale ${currentScale}:`, semitones);

    return `${currentRoot}${currentOctave}`; // Fallback

  }



  // Calculate root note index

  const rootIndex = notes.indexOf(currentRoot);

  if (rootIndex === -1) {

    console.warn(`Invalid root note: ${currentRoot}`);

    return `C${currentOctave}`; // Fallback

  }



  // Calculate final MIDI note

  const midiBase = 60 + rootIndex; // C4 as base + root offset

  const finalOctaveOffset = currentOctave - 4 + octaveOffset;

  const midiNote = midiBase + semitones + (finalOctaveOffset * 12);



  // Convert back to note name with safety checks

  const finalNote = calculateNoteFromMIDI(midiNote);



  return finalNote;

}



// Enhanced chord type selection with option for 7th chords

export function getChordFromPosition(y, use7thChords = false) {

  // Validate and clamp input

  const validY = Math.max(0, Math.min(1, typeof y === 'number' ? y : 0.5));

  const positionChanged = Math.abs(validY - lastLeftHandY) > 0.001;

  lastLeftHandY = validY;



  // Get current settings with enhanced fallbacks

  const currentScale = appState.config.selectedScale || 'major';

  const scaleArray = scales[currentScale] || scales.major;

  const currentRoot = appState.config.selectedRoot || 'C';

  const currentOctave = Math.max(2, Math.min(6, appState.config.octave || 4));



  // Enhanced position mapping for chords

  const scaleLength = scaleArray.length;

  const chordRange = Math.min(scaleLength, 8); // Use scale length but cap at 8 for usability

  const position = Math.floor(mapRange(validY, 0.15, 0.85, chordRange - 1, 0)); // Inverted, restricted range

  const scaleDegree = Math.max(0, Math.min(scaleLength - 1, position));



  // Validate root note

  const rootIndex = notes.indexOf(currentRoot);

  if (rootIndex === -1) {

    console.warn(`getChordFromPosition: Invalid root note: ${currentRoot}`);

    return createFallbackChord(currentRoot, currentOctave);

  }



  // Calculate chord root

  const degreeOffset = scaleArray[scaleDegree];

  if (typeof degreeOffset !== 'number' || degreeOffset < 0 || degreeOffset > 11) {

    console.warn(`getChordFromPosition: Invalid degreeOffset for scale ${currentScale}, degree ${scaleDegree}:`, degreeOffset);

    return createFallbackChord(currentRoot, currentOctave);

  }



  const chordRootIndex = (rootIndex + degreeOffset) % 12;

  const chordRoot = notes[chordRootIndex];



  // Get basic chord type from progression

  const chordProgression = CHORD_PROGRESSIONS[currentScale] || CHORD_PROGRESSIONS.major;

  let chordTypeKey = chordProgression[scaleDegree % chordProgression.length] || 'major';



  // Optionally convert to 7th chords for richer harmony

  if (use7thChords) {

    if (chordTypeKey === 'major') {

      chordTypeKey = scaleDegree === 4 ? 'dominant7' : 'major7'; // V7 or Maj7

    } else if (chordTypeKey === 'minor') {

      chordTypeKey = 'minor7';

    } else if (chordTypeKey === 'diminished') {

      chordTypeKey = 'diminished7';

    }

  }



  // Validate chord type

  if (!chordTypes[chordTypeKey]) {

    console.warn(`Unknown chord type key: ${chordTypeKey}, defaulting to major.`);

    return createChord(chordRoot, 'major', currentOctave - 1);

  }



  return createChord(chordRoot, chordTypeKey, currentOctave - 1);

}



// Helper function to create a chord with proper error handling

function createChord(chordRoot, chordTypeKey, octave) {

  const intervals = chordTypes[chordTypeKey];



  if (!intervals || !Array.isArray(intervals)) {

    console.error(`Invalid intervals for chordTypeKey: ${chordTypeKey}`);

    return createFallbackChord(chordRoot, octave);

  }



  const chordNotes = [];

  const chordRootIndex = notes.indexOf(chordRoot);



  if (chordRootIndex === -1) {

    return createFallbackChord('C', octave);

  }



  const midiBaseForChord = (12 * Math.max(1, octave)) + chordRootIndex;



  // Generate chord notes with validation

  intervals.forEach(interval => {

    if (typeof interval !== 'number' || interval < 0 || interval > 24) {

      console.warn(`Invalid interval in chordType ${chordTypeKey}: ${interval}`);

      return;

    }



    const midiNote = midiBaseForChord + interval;

    const noteName = calculateNoteFromMIDI(midiNote);

    chordNotes.push(noteName);

  });



  // Ensure we have at least one note

  if (chordNotes.length === 0) {

    console.warn(`No valid notes generated for chord: ${chordRoot} ${chordTypeKey}`);

    chordNotes.push(calculateNoteFromMIDI(midiBaseForChord));

  }



  // Generate display name

  const chordNameDisplay = getChordDisplayName(chordTypeKey);



  return {

    root: chordRoot,

    type: chordTypeKey,

    notes: chordNotes,

    name: `${chordRoot}${chordNameDisplay}`,

    scaleDegree: lastLeftHandY, // For debugging

    midiBase: midiBaseForChord  // For debugging

  };

}



// Helper function for chord display names - simplified

function getChordDisplayName(chordTypeKey) {

  const displayNames = {

    'major': '',           // C

    'minor': 'm',          // Cm

    'diminished': 'dim',   // Cdim

    'augmented': 'aug',    // Caug

    'dominant7': '7',      // C7

    'minor7': 'm7',        // Cm7

    'major7': 'maj7',      // Cmaj7

    'diminished7': 'dim7'  // Cdim7

  };



  return displayNames[chordTypeKey] || '';

}



// Fallback chord creation

function createFallbackChord(root, octave) {

  const safeRoot = notes.includes(root) ? root : 'C';

  const safeOctave = Math.max(1, Math.min(6, octave));



  return {

    root: safeRoot,

    type: 'major',

    notes: [

      `${safeRoot}${safeOctave}`,

      `${notes[(notes.indexOf(safeRoot) + 4) % 12]}${safeOctave}`,

      `${notes[(notes.indexOf(safeRoot) + 7) % 12]}${safeOctave}`

    ],

    name: safeRoot,

    error: true // Flag for debugging

  };

}



// Enhanced debugging and validation functions

export function validateMusicConfig() {

  const config = appState.config;

  const issues = [];



  // Check scale

  if (!scales[config.selectedScale]) {

    issues.push(`Invalid scale: ${config.selectedScale}`);

  }



  // Check root note

  if (!notes.includes(config.selectedRoot)) {

    issues.push(`Invalid root note: ${config.selectedRoot}`);

  }



  // Check octave

  if (config.octave < 1 || config.octave > 8) {

    issues.push(`Octave out of range: ${config.octave}`);

  }



  // Check scale data integrity

  const scaleArray = scales[config.selectedScale];

  if (scaleArray) {

    scaleArray.forEach((semitone, index) => {

      if (typeof semitone !== 'number' || semitone < 0 || semitone > 11) {

        issues.push(`Invalid semitone at index ${index} in scale ${config.selectedScale}: ${semitone}`);

      }

    });

  }



  return {

    isValid: issues.length === 0,

    issues: issues,

    config: config

  };

}



// Get available chord progressions for current scale

export function getAvailableChordProgressions(scaleName) {

  const scale = scales[scaleName];

  if (!scale) return [];



  const progression = CHORD_PROGRESSIONS[scaleName] || CHORD_PROGRESSIONS.major;

  return progression.slice(0, scale.length);

}



// Test function for debugging - simplified output

export function testMusicLogic(scaleName = null, use7ths = false) {

  console.log('Testing simplified music logic...');

  console.log(`Using ${use7ths ? '7th chords' : 'basic triads'}`);



  // Test validation

  const validation = validateMusicConfig();

  console.log('Config validation:', validation);



  // Test specific scale or current scale

  const testScale = scaleName || appState.config.selectedScale;

  const originalScale = appState.config.selectedScale;

  appState.config.selectedScale = testScale;



  console.log(`\nTesting scale: ${testScale}`);

  console.log('Position -> Note | Chord (Notes)');

  console.log('----------------------------------------');



  // Test note and chord generation

  for (let i = 0; i <= 10; i++) {

    const y = i / 10;

    try {

      const note = getNoteFromPosition(y);

      const chord = getChordFromPosition(y, use7ths);

      console.log(`${y.toFixed(1)} -> ${note.padEnd(4)} | ${chord.name.padEnd(6)} (${chord.notes.join(', ')})`);

    } catch (error) {

      console.error(`Error at position ${y}:`, error);

    }

  }



  // Restore original scale

  appState.config.selectedScale = originalScale;



  console.log('\nMusic logic test completed');

}



// Quick test for all scales

export function testAllScales(use7ths = false) {

  console.log(`Testing all scales with ${use7ths ? '7th chords' : 'basic triads'}:`);



  Object.keys(scales).forEach(scaleName => {

    console.log(`\n=== ${scaleName.toUpperCase()} ===`);

    try {

      testMusicLogic(scaleName, use7ths);

    } catch (error) {

      console.error(`Error testing scale ${scaleName}:`, error);

    }

  });

}