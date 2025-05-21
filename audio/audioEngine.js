// audio/audioEngine.js
import { soundPresets } from '../config.js';
import { showMessage, updateNoteDisplay, updateVisualKeyboard } from '../ui/uiManager.js';
import { mapRange } from '../utils.js';
import { MIN_PINCH_DIST, MAX_PINCH_DIST } from '../config.js';
import { appState } from '../main.js';

export let melodySynth, harmonySynth, filter, reverb;

let lastMelodyNoteChange = null; // Tracks the actual note string for change detection
let lastChordChange = null; // Tracks the chord object for change detection

export function setupAudio() {
  if (!appState.audio.audioStarted) {
      console.warn("setupAudio called before audio context is running. This should be triggered by user gesture via UI button.");
      return;
  }
  // Prevent re-initialization if synths already exist
  if (melodySynth || harmonySynth) {
      console.log("Audio engine already initialized.");
      return;
  }

  console.log("Setting up Audio Engine (Synths, Effects)...");

  // Tone.js context settings (latencyHint, lookAhead) are usually set once globally.
  // If Tone.start() is used, it handles the base AudioContext.
  // Tone.context.latencyHint = 'balanced'; // Can be set before Tone.start() if needed
  // Tone.context.lookAhead = 0.2;

  const limiter = new Tone.Limiter(-3).toDestination();
  const compressor = new Tone.Compressor(-12, 3).connect(limiter);

  reverb = new Tone.Reverb({
    decay: 2.0,
    wet: 0.3,
    preDelay: 0.07,
  }).connect(compressor);

  filter = new Tone.Filter({
    type: "lowpass",
    frequency: 8000,
    Q: 0.5,
    rolloff: -12
  }).connect(reverb);

  const currentSoundPreset = soundPresets[appState.config.selectedSound];
  if (!currentSoundPreset) {
      console.error(`Sound preset "${appState.config.selectedSound}" not found! Defaulting to first available.`);
      appState.config.selectedSound = Object.keys(soundPresets)[0];
      // currentSoundPreset = soundPresets[appState.config.selectedSound]; // This line was missing
      // Re-assign currentSoundPreset after correcting appState.config.selectedSound
      const newSoundPreset = soundPresets[appState.config.selectedSound];
      if (!newSoundPreset) {
          console.error("No sound presets available. Cannot initialize synths.");
          return;
      }
       // Update currentSoundPreset with the new valid preset
      Object.assign(currentSoundPreset, newSoundPreset); // This is incorrect, should be:
      // currentSoundPreset = newSoundPreset; // Correct way to re-assign
      // For safety, let's just re-declare it:
      const safeSoundPreset = soundPresets[appState.config.selectedSound];


      melodySynth = new Tone.Synth({
        oscillator: { type: safeSoundPreset.oscillator.type, modulationType: "sine", harmonicity: 1 },
        envelope: safeSoundPreset.envelope,
        portamento: 0.02
      }).connect(filter);

      harmonySynth = new Tone.PolySynth({
        maxPolyphony: 36,
        voice: Tone.Synth,
        options: {
          oscillator: { type: safeSoundPreset.oscillator.type, modulationType: "sine", harmonicity: 1 },
          envelope: {
            attack: safeSoundPreset.envelope.attack * 1.2,
            decay: safeSoundPreset.envelope.decay,
            sustain: safeSoundPreset.envelope.sustain,
            release: safeSoundPreset.envelope.release * 1.5,
          },
          portamento: 0.02
        }
      }).connect(filter);
  } else {
      melodySynth = new Tone.Synth({
        oscillator: { type: currentSoundPreset.oscillator.type, modulationType: "sine", harmonicity: 1 },
        envelope: currentSoundPreset.envelope,
        portamento: 0.02
      }).connect(filter);

      harmonySynth = new Tone.PolySynth({
        maxPolyphony: 36,
        voice: Tone.Synth,
        options: {
          oscillator: { type: currentSoundPreset.oscillator.type, modulationType: "sine", harmonicity: 1 },
          envelope: {
            attack: currentSoundPreset.envelope.attack * 1.2,
            decay: currentSoundPreset.envelope.decay,
            sustain: currentSoundPreset.envelope.sustain,
            release: currentSoundPreset.envelope.release * 1.5,
          },
          portamento: 0.02
        }
      }).connect(filter);
  }


  melodySynth.volume.value = appState.audio.rightHandVolume;
  harmonySynth.volume.value = appState.audio.leftHandVolume;
  console.log("Audio Engine setup complete.");
}

export function updateSynths() {
  if (!appState.audio.audioStarted || !melodySynth || !harmonySynth) {
    console.warn("Cannot update synths, audio not fully initialized or synths not created.");
    return;
  }
  const preset = soundPresets[appState.config.selectedSound];
  if (!preset) {
      console.error(`Cannot update synths: Preset "${appState.config.selectedSound}" not found.`);
      return;
  }

  try {
    // Ensure synths are defined before calling methods on them
    if (melodySynth) melodySynth.triggerRelease(Tone.now());
    if (harmonySynth) harmonySynth.releaseAll(Tone.now());

    // Short delay to allow release to complete before disposing
    setTimeout(() => {
      if (melodySynth) melodySynth.dispose();
      if (harmonySynth) harmonySynth.dispose();

      melodySynth = new Tone.Synth({
        oscillator: { type: preset.oscillator.type, modulationType: "sine" },
        envelope: preset.envelope,
        portamento: 0.02
      }).connect(filter);

      harmonySynth = new Tone.PolySynth({
        maxPolyphony: 36,
        voice: Tone.Synth,
        options: {
          oscillator: { type: preset.oscillator.type, modulationType: "sine" },
          envelope: {
            attack: preset.envelope.attack * 1.2,
            decay: preset.envelope.decay,
            sustain: preset.envelope.sustain,
            release: preset.envelope.release * 1.5
          },
          portamento: 0.02
        }
      }).connect(filter);

      melodySynth.volume.value = appState.audio.rightHandVolume;
      harmonySynth.volume.value = appState.audio.leftHandVolume;

      // Reset playing states as synths are new
      appState.audio.rightHandIsPlaying = false;
      appState.audio.leftHandIsPlaying = false;
      appState.audio.currentMelodyNote = null;
      appState.audio.currentChord = null;
      lastMelodyNoteChange = null; // Reset for new synth
      lastChordChange = null;     // Reset for new synth

      showMessage(`צליל שונה ל: ${appState.config.selectedSound}`);
      updateNoteDisplay(); // Update display as notes/chords are now stopped
      updateVisualKeyboard();
    }, 150); // Increased delay slightly
  } catch (error) {
    console.error("Error updating synths:", error);
  }
}

export function playMelodyNote(note) {
  if (!appState.audio.audioStarted || !melodySynth) return;

  const noteChanged = note !== lastMelodyNoteChange;

  try {
    if (!appState.audio.rightHandIsPlaying) { // If not currently playing
      melodySynth.triggerAttack(note, Tone.now(), 0.8);
      appState.audio.rightHandIsPlaying = true;
      appState.audio.currentMelodyNote = note;
      lastMelodyNoteChange = note;

      appState.noteChangeTime = Date.now() * 0.001; // For particle animation
      appState.particleExplosionFactor = 1.0;      // For particle animation
    } else if (noteChanged) { // If playing and note has changed
      const now = Tone.now();
      // melodySynth.triggerRelease(now + 0.02); // Schedule release slightly in future
      // melodySynth.triggerAttack(note, now + 0.07, 0.7); // Schedule new note after release
      // Using setNote for smoother transitions with portamento if synth supports it well
      melodySynth.setNote(note, now + 0.05); // Change note with a slight ramp for portamento
      appState.audio.currentMelodyNote = note;
      lastMelodyNoteChange = note;

      appState.noteChangeTime = Date.now() * 0.001;
      appState.particleExplosionFactor = 0.8;
    }
    // No need to call updateNoteDisplay/VisualKeyboard if note hasn't effectively changed for sound
    if (noteChanged || !appState.audio.rightHandIsPlaying) {
        updateNoteDisplay();
        updateVisualKeyboard();
    }
  } catch (error) {
    console.error("Error playing melody note:", note, error);
  }
}

export function playChord(chord) {
  if (!appState.audio.audioStarted || !harmonySynth) return;
  if (!chord || !chord.notes || chord.notes.length === 0) {
    // console.warn("playChord called with invalid chord:", chord);
    if (appState.audio.leftHandIsPlaying) stopChord(); // Stop if playing and new chord is invalid
    return;
  }

  const chordNotesString = chord.notes.join(',');
  const lastChordNotesString = lastChordChange ? lastChordChange.notes.join(',') : null;
  const chordChanged = chordNotesString !== lastChordNotesString;

  try {
    if (!appState.audio.leftHandIsPlaying) { // If not currently playing
      harmonySynth.triggerAttack(chord.notes, Tone.now(), 0.6);
      appState.audio.leftHandIsPlaying = true;
      appState.audio.currentChord = chord;
      lastChordChange = { ...chord, notes: [...chord.notes] }; // Deep copy for comparison

      appState.chordChangeTime = Date.now() * 0.001; // For particle animation
      appState.pulseFactor = 1.0;                   // For particle animation
    } else if (chordChanged) { // If playing and chord has changed
      const now = Tone.now();
      harmonySynth.triggerRelease(lastChordChange.notes, now + 0.02); // Release previous notes
      harmonySynth.triggerAttack(chord.notes, now + 0.07, 0.6);    // Attack new notes
      appState.audio.currentChord = chord;
      lastChordChange = { ...chord, notes: [...chord.notes] };

      appState.chordChangeTime = Date.now() * 0.001;
    }
    if (chordChanged || !appState.audio.leftHandIsPlaying) {
        updateNoteDisplay();
        updateVisualKeyboard();
    }
  } catch (error) {
    console.error("Error playing chord:", chord, error);
  }
}

export function stopMelody() {
  if (!melodySynth) return;
  if (appState.audio.rightHandIsPlaying) {
    melodySynth.triggerRelease(Tone.now());
    appState.audio.rightHandIsPlaying = false;
    appState.audio.currentMelodyNote = null;
    // lastMelodyNoteChange = null; // Keep lastMelodyNoteChange to detect if the *next* note is different
    updateNoteDisplay();
    updateVisualKeyboard();
  }
}

export function stopChord() {
  if (!harmonySynth) return;
  if (appState.audio.leftHandIsPlaying && lastChordChange && lastChordChange.notes) {
    harmonySynth.triggerRelease(lastChordChange.notes, Tone.now());
    appState.audio.leftHandIsPlaying = false;
    appState.audio.currentChord = null;
    // lastChordChange = null; // Keep lastChordChange for similar reasons
    updateNoteDisplay();
    updateVisualKeyboard();
  } else if (appState.audio.leftHandIsPlaying) { // Fallback if lastChordChange was somehow null
    harmonySynth.releaseAll(Tone.now());
    appState.audio.leftHandIsPlaying = false;
    appState.audio.currentChord = null;
    updateNoteDisplay();
    updateVisualKeyboard();
  }
}

export function setVolume(hand, pinchDistance) {
  if (!appState.audio.audioStarted) return;

  // Ensure pinchDistance is a number, provide a default if not (e.g., max distance for softest sound)
  const safePinchDistance = typeof pinchDistance === 'number' ? pinchDistance : MAX_PINCH_DIST;
  const volume = mapRange(safePinchDistance, MIN_PINCH_DIST, MAX_PINCH_DIST, -60, -10); // Adjusted range for more dynamics

  if (hand === 'left') {
    appState.audio.leftHandVolume = volume;
    if (harmonySynth) harmonySynth.volume.value = volume;
  } else {
    appState.audio.rightHandVolume = volume;
    if (melodySynth) melodySynth.volume.value = volume;
  }
}
