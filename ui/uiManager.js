// ui/uiManager.js
import { notes as configNotes, scales as configScales, soundPresets as configSoundPresets } from '../config.js';
import { updateSynths, setupAudio as initializeAudioEngine } from '../audio/audioEngine.js';
import { getNoteFromPosition } from '../music/musicLogic.js';
import { mapRange } from '../utils.js';
import { appState } from '../main.js';

export let activeUIElement = null;

export function createUI() {
  const uiContainer = document.createElement('div');
  uiContainer.className = 'ui-container';
  document.body.appendChild(uiContainer);

  const rootSelector = document.createElement('select');
  rootSelector.className = 'ui-select';
  rootSelector.id = 'root-select';
  configNotes.forEach(note => {
    const option = document.createElement('option');
    option.value = note;
    option.textContent = note;
    if (note === appState.config.selectedRoot) option.selected = true;
    rootSelector.appendChild(option);
  });

  const scaleSelector = document.createElement('select');
  scaleSelector.className = 'ui-select';
  scaleSelector.id = 'scale-select';
  Object.keys(configScales).forEach(scale => {
    const option = document.createElement('option');
    option.value = scale;
    option.textContent = scale.charAt(0).toUpperCase() + scale.slice(1);
    if (scale === appState.config.selectedScale) option.selected = true;
    scaleSelector.appendChild(option);
  });

  const soundSelector = document.createElement('select');
  soundSelector.className = 'ui-select';
  soundSelector.id = 'sound-select';
  Object.keys(configSoundPresets).forEach(sound => {
    const option = document.createElement('option');
    option.value = sound;
    option.textContent = sound.charAt(0).toUpperCase() + sound.slice(1);
    if (sound === appState.config.selectedSound) option.selected = true;
    soundSelector.appendChild(option);
  });

  const octaveSelector = document.createElement('select');
  octaveSelector.className = 'ui-select';
  octaveSelector.id = 'octave-select';
  for (let i = 2; i <= 6; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `Octave ${i}`;
    if (i === appState.config.octave) option.selected = true;
    octaveSelector.appendChild(option);
  }

  const createLabeledControl = (label, element) => {
    const container = document.createElement('div');
    container.className = 'ui-control';
    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    container.appendChild(labelEl);
    container.appendChild(element);
    return container;
  };

  uiContainer.appendChild(createLabeledControl('Root Note:', rootSelector));
  uiContainer.appendChild(createLabeledControl('Scale:', scaleSelector));
  uiContainer.appendChild(createLabeledControl('Octave:', octaveSelector));
  uiContainer.appendChild(createLabeledControl('Sound:', soundSelector));

  rootSelector.addEventListener('change', function () {
    appState.config.selectedRoot = this.value;
    updateUI();
  });
  scaleSelector.addEventListener('change', function () {
    appState.config.selectedScale = this.value;
    updateUI();
  });
  octaveSelector.addEventListener('change', function () {
    appState.config.octave = parseInt(this.value);
    updateUI();
  });
  soundSelector.addEventListener('change', function () {
    appState.config.selectedSound = this.value;
    updateSynths();
  });
}

export function addStartAudioButton() {
  const startButton = document.getElementById('startAudioButton') || document.createElement('button');
  if (!startButton.id) { // If creating new
    startButton.id = 'startAudioButton';
    startButton.textContent = 'Start Audio';
    startButton.style.position = 'fixed';
    startButton.style.top = '50%';
    startButton.style.left = '50%';
    startButton.style.transform = 'translate(-50%, -50%)';
    startButton.style.zIndex = '1000';
    startButton.style.padding = '20px';
    startButton.style.fontSize = '24px';
    startButton.style.backgroundColor = '#4CAF50';
    startButton.style.color = 'white';
    startButton.style.border = 'none';
    startButton.style.borderRadius = '10px';
    startButton.style.cursor = 'pointer';
    startButton.style.fontFamily = 'Arial, sans-serif';
    startButton.style.boxShadow = '0 5px 8px rgba(0, 0, 0, 0.6)';
    document.body.appendChild(startButton);
  }


  function handleStartClick() {
    startButton.removeEventListener('click', handleStartClick); // Prevent multiple clicks

    if (typeof Tone === 'undefined' || !Tone.start) {
      console.error("Tone.js is not available to start audio.");
      showMessage("שגיאה: ספריית האודיו לא טעונה.", 3000);
      startButton.addEventListener('click', handleStartClick); // Re-add listener to allow retry
      return;
    }

    if (Tone.context.state !== 'running') {
      Tone.start().then(() => {
        appState.audio.audioStarted = true;
        console.log("Audio Context Started by Button");
        initializeAudioEngine();
        if (document.body.contains(startButton)) {
          document.body.removeChild(startButton);
        }
        showMessage('הזיזו את הידיים כדי לנגן!');
      }).catch(e => {
        console.error("Error starting Tone.js AudioContext:", e);
        showMessage('לא ניתן היה להפעיל אודיו. נסו שוב.', 3000);
        startButton.addEventListener('click', handleStartClick); // Re-add listener
      });
    } else {
      appState.audio.audioStarted = true;
      console.log("Audio Context was already running.");
      initializeAudioEngine();
      if (document.body.contains(startButton)) {
        document.body.removeChild(startButton);
      }
      showMessage('אודיו מוכן. הזיזו ידיים!');
    }
  }
  // Ensure listener is only added once if button already exists but wasn't clicked
  startButton.removeEventListener('click', handleStartClick); // Remove any old one first
  startButton.addEventListener('click', handleStartClick);
}

export function showMessage(message, duration = 2000) {
  const existingMessage = document.getElementById('statusMessageOverlay');
  if (existingMessage) {
    document.body.removeChild(existingMessage);
  }
  const messageEl = document.createElement('div');
  messageEl.id = 'statusMessageOverlay';
  messageEl.style.position = 'fixed';
  messageEl.style.top = '10%';
  messageEl.style.left = '50%';
  messageEl.style.transform = 'translateX(-50%)';
  messageEl.style.backgroundColor = 'rgba(0,0,0,0.85)';
  messageEl.style.color = 'white';
  messageEl.style.padding = '15px 25px';
  messageEl.style.borderRadius = '8px';
  messageEl.style.zIndex = '1001';
  messageEl.style.fontSize = '20px';
  messageEl.style.fontFamily = 'Arial, sans-serif';
  messageEl.style.textAlign = 'center';
  messageEl.textContent = message;
  document.body.appendChild(messageEl);
  setTimeout(() => {
    if (document.body.contains(messageEl)) {
      document.body.removeChild(messageEl);
    }
  }, duration);
}

// export function updateInstructions() {
//   const instructionsEl = document.getElementById('instructions');
//   if (!instructionsEl) return;
//   instructionsEl.innerHTML = `
//     <h2>הוראות</h2>
//     <p>השתמשו בידיים כדי לנגן תווים ואקורדים.</p>
//     <p>בחרו סולם ותו על ידי הזזת הידיים.</p>
//     <p>השתמשו במקלדת הוויזואלית כדי לראות אילו תווים מנוגנים.</p>
// `;
//   instructionsEl.style.position = 'fixed';
//   instructionsEl.style.top = '10%';
//   instructionsEl.style.left = '50%';
//   instructionsEl.style.backgroundColor = 'rgba(0,0,0,0.85)';
//   instructionsEl.style.color = 'white';
//   instructionsEl.style.padding = '15px 25px';
//   instructionsEl.style.borderRadius = '8px';
//   instructionsEl.style.zIndex = '1001';
//   instructionsEl.style.fontSize = '20px';
//   instructionsEl.style.fontFamily = 'Arial, sans-serif';
//   instructionsEl.style.textAlign = 'center';
//   setTimeout(() => {
//     if (document.body.contains(instructionsEl)) {
//       document.body.removeChild(instructionsEl);
//     }
//   }, 10000);
// }

export function updateUI() {
  updateNoteDisplay();
  updateVisualKeyboard();
}

export function updateNoteDisplay() {
  const noteEl = document.getElementById('note-display');
  if (!noteEl) return;
  let displayText = '';
  const { currentChord, leftHandIsPlaying, currentMelodyNote, rightHandIsPlaying } = appState.audio;
  if (currentChord && leftHandIsPlaying && currentChord.name) {
    displayText += `אקורד: ${currentChord.name}`;
  }
  if (currentMelodyNote && rightHandIsPlaying && typeof currentMelodyNote === 'string') {
    if (displayText) displayText += ' | ';
    displayText += `תו: ${currentMelodyNote}`;
  }
  if (!displayText && appState.config.selectedRoot && appState.config.selectedScale) {
    displayText = `סולם: ${appState.config.selectedRoot} ${appState.config.selectedScale}`;
  } else if (!displayText) {
    displayText = "הזז ידיים לנגן";
  }
  noteEl.textContent = displayText;
  noteEl.className = 'note-indicator' + ((leftHandIsPlaying || rightHandIsPlaying) ? ' playing' : '');
}

export function createNoteMarkers() {
  const markerContainer = document.getElementById('note-markers');
  if (!markerContainer) return;
  markerContainer.innerHTML = '';
  const gridLines = 14;
  for (let i = 0; i <= gridLines; i++) {
    const y = mapRange(i, 0, gridLines, 5, 95);
    const marker = document.createElement('div');
    marker.className = i === 7 ? 'marker octave-divider' : 'marker';
    marker.style.top = `${y}%`;
    if (i % 2 === 0 && i < gridLines) {
      const label = document.createElement('div');
      label.className = 'marker-label';
      const note = getNoteFromPosition(mapRange(i, 0, gridLines, 1.0, 0.0));
      if (typeof note === 'string') label.textContent = note;
      label.style.top = `${y}%`;
      markerContainer.appendChild(label);
    }
    markerContainer.appendChild(marker);
  }
}
export function updateNoteMarkers() { createNoteMarkers(); }

export function createVisualKeyboard() {
  const keyboardContainer = document.getElementById('keyboard-visual');
  if (!keyboardContainer) return;
  keyboardContainer.innerHTML = '';
  const notesToDisplay = ['C', 'C#' || 'Db', 'D', 'D#' || 'Eb', 'E', 'F', 'F#' || 'Gb', 'G', 'G#' || 'Ab', 'A', 'A#' || 'Bb', 'B'];
  notesToDisplay.forEach((noteName) => {
    const key = document.createElement('div');
    key.classList.add('key');
    key.dataset.noteName = noteName;
    if (noteName.includes('#' || noteName.includes('b'))) {
      key.style.backgroundColor = 'black'; key.style.borderColor = '#555';
      key.style.width = '12px'; key.style.height = '60%';
      key.style.marginLeft = '-6px'; key.style.marginRight = '-6px'; key.style.zIndex = '2';
    } else {
      key.style.backgroundColor = 'white'; key.style.borderColor = '#ccc';
      key.style.width = '18px'; key.style.zIndex = '1';
    }
    keyboardContainer.appendChild(key);
  });
}

export function updateVisualKeyboard() {
  const keyboardContainer = document.getElementById('keyboard-visual');
  if (!keyboardContainer) return;
  const keys = Array.from(keyboardContainer.querySelectorAll('.key'));
  keys.forEach(key => {
    key.classList.remove('active');
    if (key.dataset.noteName.includes('#')) key.style.backgroundColor = 'black';
    else key.style.backgroundColor = 'white';
  });

  const { currentMelodyNote, rightHandIsPlaying, currentChord, leftHandIsPlaying } = appState.audio;

  if (currentMelodyNote && rightHandIsPlaying && typeof currentMelodyNote === 'string') {
    const melodyNoteName = currentMelodyNote.replace(/[0-9]/g, '');
    const keyToActivate = keys.find(key => key.dataset.noteName === melodyNoteName);
    if (keyToActivate) {
      keyToActivate.classList.add('active'); keyToActivate.style.backgroundColor = 'lightgreen';
    }
  }

  if (currentChord && leftHandIsPlaying && currentChord.notes && Array.isArray(currentChord.notes)) {
    currentChord.notes.forEach(chordNoteFull => {
      if (typeof chordNoteFull === 'string') { // Ensure chordNoteFull is a string
        const chordNoteName = chordNoteFull.replace(/[0-9]/g, '');
        const keyToActivate = keys.find(key => key.dataset.noteName === chordNoteName);
        if (keyToActivate) {
          keyToActivate.classList.add('active');
          if (keyToActivate.style.backgroundColor !== 'lightgreen') { // Don't override melody highlight
            keyToActivate.style.backgroundColor = 'lightblue';
          }
        }
      }
    });
  }
}
