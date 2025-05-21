// music/musicLogic.js
import { scales, notes, chordTypes } from '../config.js';
import { mapRange } from '../utils.js';
import { appState } from '../main.js';

let lastRightHandY = 0;
let lastLeftHandY = 0;

export function getNoteFromPosition(y) {
  // Ensure y is a valid number between 0 and 1
  const validY = Math.max(0, Math.min(1, typeof y === 'number' ? y : 0.5));
  // const positionChanged = Math.abs(validY - lastRightHandY) > 0.0001; // Not currently used for return
  lastRightHandY = validY;

  const position = Math.floor(mapRange(validY, 0.0, 1.0, 14, 0)); // Inverted

  const scaleArray = scales[appState.config.selectedScale] || scales.major; // Fallback to major scale
  const currentOctave = appState.config.octave || 4; // Fallback octave
  const currentRoot = appState.config.selectedRoot || 'C'; // Fallback root

  const octaveOffset = Math.floor(position / scaleArray.length);
  const indexInScale = position % scaleArray.length;

  const semitones = scaleArray[indexInScale];
  if (typeof semitones !== 'number') {
    // console.warn(`Invalid semitones at indexInScale ${indexInScale} for scale ${appState.config.selectedScale}`);
    return `${currentRoot}${currentOctave}`; // Fallback note
  }

  const rootIndex = notes.indexOf(currentRoot);
  if (rootIndex === -1) {
    // console.warn(`Invalid root note: ${currentRoot}`);
    return `C${currentOctave}`; // Fallback note
  }

  const midiBase = 60 + rootIndex; // MIDI for C4 + root offset
  const midiNote = midiBase + semitones + (currentOctave - 4 + octaveOffset) * 12;

  const noteIndex = midiNote % 12;
  const noteOctaveAdjusted = Math.floor(midiNote / 12) - 1; // MIDI octave to standard octave
  const noteName = notes[noteIndex] + noteOctaveAdjusted;

  return noteName;
}

export function getChordFromPosition(y) {
  const validY = Math.max(0, Math.min(1, typeof y === 'number' ? y : 0.5));
  // const positionChanged = Math.abs(validY - lastLeftHandY) > 0.0001; // Not currently used for return
  lastLeftHandY = validY;

  const position = Math.floor(mapRange(validY, 0.2, 0.8, 7, 0)); // Inverted, restricted range

  const scaleArray = scales[appState.config.selectedScale] || scales.major;
  const currentRoot = appState.config.selectedRoot || 'C';
  const currentOctave = appState.config.octave || 4;

  const scaleDegree = position % Math.max(1, scaleArray.length);

  const rootIndex = notes.indexOf(currentRoot);
  if (rootIndex === -1) {
    // console.warn(`getChordFromPosition: Invalid root note: ${currentRoot}`);
    // Return a default valid chord to prevent further errors
    return { root: 'C', type: 'major', notes: ['C3', 'E3', 'G3'], name: 'C' };
  }

  const degreeOffset = scaleArray[scaleDegree];
  if (typeof degreeOffset !== 'number') {
    // console.warn(`getChordFromPosition: Invalid degreeOffset for scale ${appState.config.selectedScale}, degree ${scaleDegree}`);
    return { root: currentRoot, type: 'major', notes: [`${currentRoot}${currentOctave-1}`, `${notes[(rootIndex+4)%12]}${currentOctave-1}`, `${notes[(rootIndex+7)%12]}${currentOctave-1}`], name: currentRoot };
  }

  const chordRootIndex = (rootIndex + degreeOffset) % 12;
  const chordRoot = notes[chordRootIndex]; // This should now always be a valid string

  let chordTypeKey;
  const currentSelectedScale = appState.config.selectedScale;

  if (currentSelectedScale === 'major') {
    const types = ['major', 'minor', 'minor', 'major', 'dominant7', 'minor', 'diminished'];
    chordTypeKey = types[scaleDegree % 7];
  } else if (currentSelectedScale === 'minor') {
    const types = ['minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major'];
    chordTypeKey = types[scaleDegree % 7];
  } else if (currentSelectedScale === 'majorBlues' || currentSelectedScale === 'minorBlues') {
    const types = ['dominant7', 'minor7', 'dominant7', 'minor7', 'dominant7', 'minor7'];
    chordTypeKey = types[scaleDegree % types.length];
  } else { // Default for other scales (e.g., pentatonic, chromatic)
    chordTypeKey = scaleDegree % 2 === 0 ? 'major' : 'minor';
  }

  if (!chordTypes[chordTypeKey]) {
    // console.warn(`Unknown chord type key: ${chordTypeKey}, defaulting to major.`);
    chordTypeKey = 'major';
  }

  const intervals = chordTypes[chordTypeKey];
  const chordNotes = [];
  // Chords are often played in a lower octave than the melody's base
  const octaveForChord = currentOctave - 1; // e.g., if melody is based around C4, chords around C3
  const midiBaseForChord = (12 * octaveForChord) + chordRootIndex;

  if (!intervals || !Array.isArray(intervals)) {
      // console.error(`Invalid intervals for chordTypeKey: ${chordTypeKey}`);
      return { root: chordRoot, type: chordTypeKey, notes: [`${chordRoot}${octaveForChord}`], name: chordRoot }; // Fallback to root note
  }

  intervals.forEach(interval => {
    if (typeof interval !== 'number') {
        // console.warn(`Invalid interval in chordType ${chordTypeKey}: ${interval}`);
        return; // Skip this interval
    }
    const midiNote = midiBaseForChord + interval;
    const noteIndexVal = midiNote % 12;
    const noteOctaveVal = Math.floor(midiNote / 12); // Standard octave for note name
    chordNotes.push(notes[noteIndexVal] + noteOctaveVal);
  });

  if (chordNotes.length === 0) {
      // console.warn(`No valid notes generated for chord: ${chordRoot} ${chordTypeKey}`);
      // Fallback to a single root note if no chord notes were generated
      chordNotes.push(`${chordRoot}${octaveForChord}`);
  }

  let chordNameDisplay = chordTypeKey;
  if (chordTypeKey === 'major') chordNameDisplay = '';
  else if (chordTypeKey === 'minor') chordNameDisplay = 'm';
  else if (chordTypeKey === 'dominant7') chordNameDisplay = '7';
  else if (chordTypeKey === 'minor7') chordNameDisplay = 'm7';
  else if (chordTypeKey === 'diminished') chordNameDisplay = 'dim';
  else if (chordTypeKey === 'augmented') chordNameDisplay = 'aug';
  // For other types, it will display the full key like 'sus4'

  const finalChord = {
    root: chordRoot,
    type: chordTypeKey,
    notes: chordNotes,
    name: `${chordRoot}${chordNameDisplay}`
  };
  return finalChord;
}
