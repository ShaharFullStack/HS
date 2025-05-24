// audio/audioEngine.js - Optimized with Advanced Polyphony Management
import { soundPresets } from '../config.js';
import { showMessage, updateNoteDisplay, updateVisualKeyboard } from '../ui/uiManager.js';
import { mapRange } from '../utils.js';
import { MIN_PINCH_DIST, MAX_PINCH_DIST } from '../config.js';
import { appState } from '../main.js';

export let melodySynth, harmonySynth, filter, reverb;

// Polyphony and performance optimization
let lastMelodyNote = null;
let lastChord = null;
let lastNoteChangeTime = 0;
let lastChordChangeTime = 0;

// Configurable thresholds for polyphony management
const PERFORMANCE_CONFIG = {
    // Time-based throttling
    MIN_NOTE_INTERVAL: 30,      // Minimum ms between melody note changes
    MIN_CHORD_INTERVAL: 80,     // Minimum ms between chord changes
    
    // Position-based throttling
    NOTE_CHANGE_THRESHOLD: 0.02,  // Minimum Y position change for melody
    CHORD_CHANGE_THRESHOLD: 0.03, // Minimum Y position change for chord
    
    // Polyphony limits
    MAX_HARMONY_VOICES: 12,     // Reduced from 14 for safety margin
    BASS_ONLY_SPEED_THRESHOLD: 1.2, // Speed threshold for bass-only mode
    
    // Transition timing
    SETTLE_DURATION_MS: 200,    // Reduced settle time for responsiveness
    ATTACK_DELAY: 0.015,        // Faster attack for smoother transitions
};

// Enhanced movement tracking for better polyphony control
let movementHistory = {
    melody: { lastY: 0, lastTime: 0, velocity: 0 },
    harmony: { lastY: 0, lastTime: 0, velocity: 0 }
};

// Helper function to determine the bass note of a chord
function getBassNote(notesArray) {
    if (!notesArray || notesArray.length === 0) return null;
    if (notesArray.length === 1) return notesArray[0];

    try {
        return notesArray.reduce((bass, currentNote) => {
            const bassMidi = Tone.Frequency(bass).toMidi();
            const currentMidi = Tone.Frequency(currentNote).toMidi();
            return currentMidi < bassMidi ? currentNote : bass;
        });
    } catch (e) {
        console.error("Error in getBassNote:", notesArray, e);
        return notesArray[0];
    }
}

// Smart chord comparison to avoid unnecessary updates
function chordEquals(chord1, chord2) {
    if (!chord1 && !chord2) return true;
    if (!chord1 || !chord2) return false;
    if (chord1.name !== chord2.name) return false;
    if (!chord1.notes || !chord2.notes) return false;
    if (chord1.notes.length !== chord2.notes.length) return false;
    
    // Check if all notes are the same
    const notes1 = [...chord1.notes].sort();
    const notes2 = [...chord2.notes].sort();
    return notes1.every((note, index) => note === notes2[index]);
}

// Calculate movement velocity for smart polyphony decisions
function updateMovementTracking(hand, position) {
    const now = Date.now();
    const tracking = movementHistory[hand];
    
    if (tracking.lastTime > 0) {
        const timeDelta = now - tracking.lastTime;
        const positionDelta = Math.abs(position - tracking.lastY);
        tracking.velocity = timeDelta > 0 ? positionDelta / (timeDelta / 1000) : 0;
    }
    
    tracking.lastY = position;
    tracking.lastTime = now;
    
    return tracking.velocity;
}

export function setupAudio() {
    if (!appState.audio.audioStarted) {
        console.warn("setupAudio called before audio context is running.");
        return;
    }
    if (melodySynth || harmonySynth) {
        console.log("Audio engine already initialized.");
        return;
    }

    console.log("Setting up Optimized Audio Engine...");

    const limiter = new Tone.Limiter(-3).toDestination();
    const compressor = new Tone.Compressor(-12, 3).connect(limiter);

    reverb = new Tone.Reverb({
        decay: 1.8,     // Slightly reduced for cleaner sound
        wet: 0.25,      // Reduced wetness for clarity
        preDelay: 0.05, // Shorter pre-delay for responsiveness
    }).connect(compressor);

    filter = new Tone.Filter({
        type: "lowpass",
        frequency: 9000,  // Higher frequency for brighter sound
        Q: 0.4,          // Lower Q for smoother filtering
        rolloff: -12
    }).connect(reverb);

    let selectedPreset = soundPresets[appState.config.selectedSound];
    if (!selectedPreset) {
        console.error(`Sound preset "${appState.config.selectedSound}" not found!`);
        const availablePresets = Object.keys(soundPresets);
        if (availablePresets.length === 0) {
            console.error("No sound presets available.");
            return;
        }
        appState.config.selectedSound = availablePresets[0];
        selectedPreset = soundPresets[appState.config.selectedSound];
    }

    // Optimized melody synth with faster response
    melodySynth = new Tone.Synth({
        oscillator: { 
            type: selectedPreset.oscillator.type, 
            modulationType: "sine", 
            harmonicity: 1 
        },
        envelope: {
            ...selectedPreset.envelope,
            attack: Math.max(0.005, selectedPreset.envelope.attack * 0.8), // Faster attack
            release: Math.max(0.1, selectedPreset.envelope.release * 0.9)   // Slightly faster release
        },
        portamento: 0.015  // Faster portamento for smoother transitions
    }).connect(filter);

    // Optimized harmony synth with controlled polyphony
    harmonySynth = new Tone.PolySynth({
        maxPolyphony: PERFORMANCE_CONFIG.MAX_HARMONY_VOICES,
        voice: Tone.Synth,
        options: {
            oscillator: { 
                type: selectedPreset.oscillator.type, 
                modulationType: "sine", 
                harmonicity: 1 
            },
            envelope: {
                attack: Math.max(0.01, selectedPreset.envelope.attack * 1.1),  // Slightly slower attack for smoothness
                decay: selectedPreset.envelope.decay,
                sustain: selectedPreset.envelope.sustain,
                release: Math.max(0.15, selectedPreset.envelope.release * 1.3), // Longer release for overlap
            },
            portamento: 0.01  // Fast portamento for chord changes
        }
    }).connect(filter);

    melodySynth.volume.value = appState.audio.rightHandVolume;
    harmonySynth.volume.value = appState.audio.leftHandVolume;
    
    console.log("Optimized Audio Engine setup complete.");
}

export function updateSynths() {
    if (!appState.audio.audioStarted || !melodySynth || !harmonySynth) {
        console.warn("Cannot update synths, audio not fully initialized.");
        return;
    }
    
    const preset = soundPresets[appState.config.selectedSound];
    if (!preset) {
        console.error(`Cannot update synths: Preset "${appState.config.selectedSound}" not found.`);
        return;
    }

    try {
        // Stop current sounds smoothly
        if (melodySynth) melodySynth.triggerRelease(Tone.now());
        if (harmonySynth) harmonySynth.releaseAll(Tone.now());

        setTimeout(() => {
            // Dispose old synths
            if (melodySynth) melodySynth.dispose();
            if (harmonySynth) harmonySynth.dispose();

            // Create new optimized synths
            melodySynth = new Tone.Synth({
                oscillator: { type: preset.oscillator.type, modulationType: "sine" },
                envelope: {
                    ...preset.envelope,
                    attack: Math.max(0.005, preset.envelope.attack * 0.8),
                    release: Math.max(0.1, preset.envelope.release * 0.9)
                },
                portamento: 0.015
            }).connect(filter);

            harmonySynth = new Tone.PolySynth({
                maxPolyphony: PERFORMANCE_CONFIG.MAX_HARMONY_VOICES,
                voice: Tone.Synth,
                options: {
                    oscillator: { type: preset.oscillator.type, modulationType: "sine" },
                    envelope: {
                        attack: Math.max(0.01, preset.envelope.attack * 1.1),
                        decay: preset.envelope.decay,
                        sustain: preset.envelope.sustain,
                        release: Math.max(0.15, preset.envelope.release * 1.3)
                    },
                    portamento: 0.01
                }
            }).connect(filter);

            melodySynth.volume.value = appState.audio.rightHandVolume;
            harmonySynth.volume.value = appState.audio.leftHandVolume;

            // Reset state
            appState.audio.rightHandIsPlaying = false;
            appState.audio.leftHandIsPlaying = false;
            appState.audio.currentMelodyNote = null;
            appState.audio.currentChord = null;
            lastMelodyNote = null;
            lastChord = null;

            showMessage(`צליל שונה ל: ${appState.config.selectedSound}`);
            updateNoteDisplay();
            updateVisualKeyboard();
        }, 120); // Shorter timeout for faster response
    } catch (error) {
        console.error("Error updating synths:", error);
    }
}

// Optimized melody note playing with intelligent throttling
export function playMelodyNote(note, handPosition = null) {
    if (!appState.audio.audioStarted || !melodySynth || !note) return;

    const now = Date.now();
    const noteChanged = note !== lastMelodyNote;
    
    // Extract Y position for movement tracking
    let yPosition = 0.5;
    if (typeof handPosition === 'number') {
        yPosition = handPosition;
    } else if (handPosition && typeof handPosition.y === 'number') {
        yPosition = handPosition.y;
    } else if (appState.hands.rightHandLandmarks && appState.hands.rightHandLandmarks[0]) {
        yPosition = appState.hands.rightHandLandmarks[0].y;
    }
    
    // Calculate movement velocity
    const velocity = updateMovementTracking('melody', yPosition);
    
    // Smart throttling based on movement and time
    const timeSinceLastChange = now - lastNoteChangeTime;
    const shouldUpdate = noteChanged && (
        timeSinceLastChange > PERFORMANCE_CONFIG.MIN_NOTE_INTERVAL ||
        velocity < 0.5  // Allow updates if moving slowly even if time hasn't passed
    );

    if (!shouldUpdate) return;

    try {
        if (!appState.audio.rightHandIsPlaying) {
            // Start new note
            melodySynth.triggerAttack(note, Tone.now(), 0.8);
            appState.audio.rightHandIsPlaying = true;
            appState.audio.currentMelodyNote = note;
            appState.noteChangeTime = now * 0.001;
            appState.particleExplosionFactor = 1.0;
        } else {
            // Change existing note with smooth transition
            const attackTime = velocity > 1.0 ? 0.02 : 0.04; // Faster transitions for fast movement
            melodySynth.setNote(note, Tone.now() + attackTime);
            appState.audio.currentMelodyNote = note;
            appState.noteChangeTime = now * 0.001;
            appState.particleExplosionFactor = Math.min(0.8, velocity * 0.4);
        }

        lastMelodyNote = note;
        lastNoteChangeTime = now;
        
        updateNoteDisplay();
        updateVisualKeyboard();
    } catch (error) {
        console.error("Error playing melody note:", note, error);
    }
}

// Heavily optimized chord playing with advanced polyphony management
export function playChord(chord, handPosition = null) {
    if (!appState.audio.audioStarted || !harmonySynth) return;

    // Initialize state if needed
    if (appState.audio.harmonyHandState === undefined) {
        appState.audio.harmonyHandState = "settled";
    }
    if (appState.audio.settleStartTime === undefined) {
        appState.audio.settleStartTime = null;
    }

    if (!chord || !chord.notes || chord.notes.length === 0) {
        if (appState.audio.leftHandIsPlaying) stopChord();
        return;
    }

    const now = Date.now();
    const chordChanged = !chordEquals(chord, lastChord);
    
    // Extract Y position for movement tracking
    let yPosition = 0.5;
    if (typeof handPosition === 'number') {
        yPosition = handPosition;
    } else if (handPosition && typeof handPosition.y === 'number') {
        yPosition = handPosition.y;
    } else if (appState.hands.leftHandLandmarks && appState.hands.leftHandLandmarks[0]) {
        yPosition = appState.hands.leftHandLandmarks[0].y;
    }
    
    // Calculate movement velocity
    const velocity = updateMovementTracking('harmony', yPosition);
    
    // Smart throttling for chord changes
    const timeSinceLastChange = now - lastChordChangeTime;
    const isMovingFast = velocity > PERFORMANCE_CONFIG.BASS_ONLY_SPEED_THRESHOLD;
    
    // More aggressive throttling for chords due to polyphony concerns
    const shouldUpdate = chordChanged && (
        timeSinceLastChange > PERFORMANCE_CONFIG.MIN_CHORD_INTERVAL ||
        (!isMovingFast && timeSinceLastChange > PERFORMANCE_CONFIG.MIN_CHORD_INTERVAL * 0.5)
    );

    if (!shouldUpdate) return;

    const newRawNotes = chord.notes;
    const newBassNote = getBassNote(newRawNotes);
    const toneNow = Tone.now();

    // Enhanced hand state management based on movement
    let targetNotesThisStepSet;

    if (isMovingFast) {
        appState.audio.harmonyHandState = "moving";
        appState.audio.settleStartTime = null;
        // When moving fast, play only bass note to reduce polyphony load
        targetNotesThisStepSet = newBassNote ? new Set([newBassNote]) : new Set();
    } else {
        if (appState.audio.harmonyHandState === "moving") {
            appState.audio.harmonyHandState = "settling";
            appState.audio.settleStartTime = now;
        }

        if (appState.audio.harmonyHandState === "settling" &&
            (now - (appState.audio.settleStartTime || now) > PERFORMANCE_CONFIG.SETTLE_DURATION_MS)) {
            appState.audio.harmonyHandState = "settled";
        }

        if (appState.audio.harmonyHandState === "settled") {
            // When settled, play full chord but limit to available voices
            const maxVoices = Math.min(PERFORMANCE_CONFIG.MAX_HARMONY_VOICES, newRawNotes.length);
            targetNotesThisStepSet = new Set(newRawNotes.slice(0, maxVoices).filter(Boolean));
        } else {
            // While settling, play bass + one or two other notes maximum
            const settleNotes = [newBassNote];
            if (newRawNotes.length > 1) settleNotes.push(newRawNotes[1]);
            if (newRawNotes.length > 2 && velocity < 0.3) settleNotes.push(newRawNotes[2]); // Add third only if moving very slowly
            targetNotesThisStepSet = new Set(settleNotes.filter(Boolean));
        }
    }

    // Efficient voice management
    const previouslyPlayingNotesSet = new Set(appState.audio.currentChord?.notes || []);
    const notesToRelease = [...previouslyPlayingNotesSet].filter(n => !targetNotesThisStepSet.has(n));
    const notesToAttack = [...targetNotesThisStepSet].filter(n => !previouslyPlayingNotesSet.has(n));
    const notesThatContinue = [...previouslyPlayingNotesSet].filter(n => targetNotesThisStepSet.has(n));

    // Release notes that are no longer needed
    if (notesToRelease.length > 0) {
        harmonySynth.triggerRelease(notesToRelease, toneNow);
    }

    // Attack new notes with polyphony check
    if (notesToAttack.length > 0) {
        const voicesAvailable = PERFORMANCE_CONFIG.MAX_HARMONY_VOICES - notesThatContinue.length;
        const actualNotesToAttack = notesToAttack.slice(0, Math.max(0, voicesAvailable));
        
        if (actualNotesToAttack.length > 0) {
            const attackDelay = notesToRelease.length > 0 ? PERFORMANCE_CONFIG.ATTACK_DELAY : 0.01;
            const velocity_normalized = Math.min(0.8, 0.4 + (1 - Math.min(velocity, 2)) * 0.4); // Softer when moving fast
            harmonySynth.triggerAttack(actualNotesToAttack, toneNow + attackDelay, velocity_normalized);
        }
    }

    // Update state
    const finalNotesForState = [...new Set([...notesThatContinue, ...notesToAttack])];
    appState.audio.currentChord = { ...chord, notes: finalNotesForState };
    appState.audio.leftHandIsPlaying = finalNotesForState.length > 0;

    lastChord = { ...chord };
    lastChordChangeTime = now;
    
    appState.chordChangeTime = now * 0.0015;
    if (appState.audio.leftHandIsPlaying) {
        appState.pulseFactor = Math.min(1.0, 0.6 + (1 - Math.min(velocity, 1.5)) * 0.4);
    }
    
    updateNoteDisplay();
    updateVisualKeyboard();
}

export function stopMelody() {
    if (!melodySynth) return;
    if (appState.audio.rightHandIsPlaying) {
        melodySynth.triggerRelease(Tone.now());
        appState.audio.rightHandIsPlaying = false;
        appState.audio.currentMelodyNote = null;
        lastMelodyNote = null;
        updateNoteDisplay();
        updateVisualKeyboard();
    }
}

export function stopChord() {
    if (!harmonySynth) return;
    const toneNow = Tone.now();
    
    if (appState.audio.leftHandIsPlaying || (appState.audio.currentChord && appState.audio.currentChord.notes.length > 0)) {
        harmonySynth.releaseAll(toneNow);
        
        appState.audio.leftHandIsPlaying = false;
        appState.audio.currentChord = null;
        lastChord = null;
        
        // Reset hand state
        appState.audio.harmonyHandState = "settled";
        appState.audio.settleStartTime = null;
        
        updateNoteDisplay();
        updateVisualKeyboard();
    } else {
        // Ensure state is reset
        appState.audio.harmonyHandState = "settled";
        appState.audio.settleStartTime = null;
    }
}

export function setVolume(hand, pinchDistance) {
    if (!appState.audio.audioStarted) return;

    const safePinchDistance = typeof pinchDistance === 'number' ? pinchDistance : MAX_PINCH_DIST;
    const volume = mapRange(safePinchDistance, MIN_PINCH_DIST, MAX_PINCH_DIST, -200, -15);

    if (hand === 'left') {
        appState.audio.leftHandVolume = volume;
        if (harmonySynth) harmonySynth.volume.value = volume;
    } else {
        appState.audio.rightHandVolume = volume;
        if (melodySynth) melodySynth.volume.value = volume;
    }
}

// Performance monitoring and debugging
export function getAudioPerformanceStats() {
    const activeVoices = harmonySynth ? (harmonySynth.activeVoices || 0) : 0;
    const maxVoices = PERFORMANCE_CONFIG.MAX_HARMONY_VOICES;
    
    return {
        activeVoices: activeVoices,
        maxVoices: maxVoices,
        voiceUtilization: (activeVoices / maxVoices * 100).toFixed(1) + '%',
        melodyVelocity: movementHistory.melody.velocity.toFixed(2),
        harmonyVelocity: movementHistory.harmony.velocity.toFixed(2),
        harmonyState: appState.audio.harmonyHandState,
        lastNoteInterval: Date.now() - lastNoteChangeTime,
        lastChordInterval: Date.now() - lastChordChangeTime,
        isPlaying: {
            melody: appState.audio.rightHandIsPlaying,
            harmony: appState.audio.leftHandIsPlaying
        }
    };
}

// Export for console debugging
window.getAudioStats = getAudioPerformanceStats;