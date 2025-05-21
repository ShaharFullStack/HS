import { soundPresets } from '../config.js';
import { showMessage, updateNoteDisplay, updateVisualKeyboard } from '../ui/uiManager.js';
import { mapRange } from '../utils.js';
import { MIN_PINCH_DIST, MAX_PINCH_DIST } from '../config.js';
import { appState } from '../main.js';

export let melodySynth, harmonySynth, filter, reverb;

export function setupAudio() {
    if (!appState.audio.audioStarted) {
        console.warn("setupAudio called before audio context is running. This should be triggered by user gesture via UI button.");
        return;
    }
    if (melodySynth || harmonySynth) {
        console.log("Audio engine already initialized.");
        return;
    }

    console.log("Setting up Audio Engine (Synths, Effects)...");

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

    let selectedPreset = soundPresets[appState.config.selectedSound];
    if (!selectedPreset) {
        console.error(`Sound preset "${appState.config.selectedSound}" not found! Defaulting to first available.`);
        const availablePresets = Object.keys(soundPresets);
        if (availablePresets.length === 0) {
            console.error("No sound presets available. Cannot initialize synths.");
            return;
        }
        appState.config.selectedSound = availablePresets[0];
        selectedPreset = soundPresets[appState.config.selectedSound];
    }

    melodySynth = new Tone.Synth({
        oscillator: { type: selectedPreset.oscillator.type, modulationType: "sine", harmonicity: 1 },
        envelope: selectedPreset.envelope,
        portamento: 0.02
    }).connect(filter);

    harmonySynth = new Tone.PolySynth({
        maxPolyphony: 14,
        voice: Tone.Synth,
        options: {
            oscillator: { type: selectedPreset.oscillator.type, modulationType: "sine", harmonicity: 1 },
            envelope: {
                attack: selectedPreset.envelope.attack * 1.2,
                decay: selectedPreset.envelope.decay,
                sustain: selectedPreset.envelope.sustain,
                release: selectedPreset.envelope.release * 1.5,
            },
            portamento: 0.02
        }
    }).connect(filter);

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
        if (melodySynth) melodySynth.triggerRelease(Tone.now());
        if (harmonySynth) harmonySynth.releaseAll(Tone.now());

        setTimeout(() => {
            if (melodySynth) melodySynth.dispose();
            if (harmonySynth) harmonySynth.dispose();

            melodySynth = new Tone.Synth({
                oscillator: { type: preset.oscillator.type, modulationType: "sine" },
                envelope: preset.envelope,
                portamento: 0.02
            }).connect(filter);

            harmonySynth = new Tone.PolySynth({
                maxPolyphony: 14,
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

            appState.audio.rightHandIsPlaying = false;
            appState.audio.leftHandIsPlaying = false;
            appState.audio.currentMelodyNote = null;
            appState.audio.currentChord = null;

            showMessage(`צליל שונה ל: ${appState.config.selectedSound}`);
            updateNoteDisplay();
            updateVisualKeyboard();
        }, 150);
    } catch (error) {
        console.error("Error updating synths:", error);
    }
}

export function playMelodyNote(note) {
    if (!appState.audio.audioStarted || !melodySynth) return;

    const noteChanged = note !== appState.audio.currentMelodyNote;

    try {
        if (!appState.audio.rightHandIsPlaying) {
            melodySynth.triggerAttack(note, Tone.now(), 0.8);
            appState.audio.rightHandIsPlaying = true;
            appState.audio.currentMelodyNote = note;
            appState.noteChangeTime = Date.now() * 0.001;
            appState.particleExplosionFactor = 1.0;
            updateNoteDisplay();
            updateVisualKeyboard();
        } else if (noteChanged) {
            const now = Tone.now();
            melodySynth.setNote(note, now + 0.05);
            appState.audio.currentMelodyNote = note;
            appState.noteChangeTime = Date.now() * 0.001;
            appState.particleExplosionFactor = 0.8;
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
        if (appState.audio.leftHandIsPlaying) stopChord();
        return;
    }

    const newNotes = new Set(chord.notes);
    if (!appState.audio.leftHandIsPlaying) {
        harmonySynth.triggerAttack([...newNotes], Tone.now(), 0.6);
        appState.audio.leftHandIsPlaying = true;
        appState.audio.currentChord = { ...chord, notes: [...chord.notes] };
        appState.chordChangeTime = Date.now() * 0.001;
        appState.pulseFactor = 1.0;
        updateNoteDisplay();
        updateVisualKeyboard();
    } else {
        const currentNotes = new Set(appState.audio.currentChord?.notes || []);
        if ([...newNotes].every(note => currentNotes.has(note)) && 
            [...currentNotes].every(note => newNotes.has(note))) {
            return; // Chords are identical, no action needed
        }
        const notesToRelease = [...currentNotes].filter(note => !newNotes.has(note));
        const notesToAttack = [...newNotes].filter(note => !currentNotes.has(note));
        const now = Tone.now();
        if (notesToRelease.length > 0) {
            harmonySynth.triggerRelease(notesToRelease, now + 0.02);
        }
        if (notesToAttack.length > 0) {
            harmonySynth.triggerAttack(notesToAttack, now + 0.07, 0.6);
        }
        appState.audio.currentChord = { ...chord, notes: [...chord.notes] };
        appState.chordChangeTime = Date.now() * 0.001;
        updateNoteDisplay();
        updateVisualKeyboard();
    }
}

export function stopMelody() {
    if (!melodySynth) return;
    if (appState.audio.rightHandIsPlaying) {
        melodySynth.triggerRelease(Tone.now());
        appState.audio.rightHandIsPlaying = false;
        appState.audio.currentMelodyNote = null;
        updateNoteDisplay();
        updateVisualKeyboard();
    }
}

export function stopChord() {
    if (!harmonySynth) return;
    if (appState.audio.leftHandIsPlaying) {
        if (appState.audio.currentChord && appState.audio.currentChord.notes) {
            harmonySynth.triggerRelease(appState.audio.currentChord.notes, Tone.now());
        } else {
            harmonySynth.releaseAll(Tone.now());
        }
        appState.audio.leftHandIsPlaying = false;
        appState.audio.currentChord = null;
        updateNoteDisplay();
        updateVisualKeyboard();
    }
}

export function setVolume(hand, pinchDistance) {
    if (!appState.audio.audioStarted) return;

    const safePinchDistance = typeof pinchDistance === 'number' ? pinchDistance : MAX_PINCH_DIST;
    const volume = mapRange(safePinchDistance, MIN_PINCH_DIST, MAX_PINCH_DIST, -75, -15);

    if (hand === 'left') {
        appState.audio.leftHandVolume = volume;
        if (harmonySynth) harmonySynth.volume.value = volume;
    } else {
        appState.audio.rightHandVolume = volume;
        if (melodySynth) melodySynth.volume.value = volume;
    }
}