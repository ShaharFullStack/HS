# HandSynth


HandSynth is an interactive web-based musical instrument that allows you to create music with your hands in 3D space. Using your webcam and hand tracking technology, HandSynth translates your hand movements into real-time synthesized sounds and mesmerizing visuals.

## 🎵 Features

- **Gesture-Based Music Creation**: Control melodies with your right hand and chords with your left hand
- **Immersive Visualizations**: Interactive particle system that responds to your music
- **Multiple Sound Presets**: Choose from synth, bell, pad, pluck, and piano sounds
- **Music Theory Integration**: Play in different scales including major, minor, pentatonic, and blues
- **Expressive Control**: Pinch gestures to control volume and dynamics
- **Virtual Keyboard Display**: Visual feedback of notes and chords being played
- **Multiple Visual Themes**: Choose between Classic, Cosmic and Minimal interfaces

## 🚀 Live Demo

Try HandSynth online at: [HandSynth!](https://handsynth2.web.app/)

## 🛠 Technologies Used

- **React 19** with TypeScript
- **Tone.js** for audio synthesis and processing
- **MediaPipe** for hand tracking
- **Three.js** for 3D particle visualizations

## 📋 Requirements

- Modern web browser (Chrome, Firefox, Edge recommended)
- Webcam
- JavaScript enabled
- Decent CPU for smooth hand tracking
- Speakers or headphones

## 🔧 Installation

To run HandSynth locally:

1. Clone the repository:
   ```bash
   git clone https://github.com/ShaharFullStack/ReactHandSynth.git
   cd handsynth
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Install required TypeScript definitions:
   ```bash
   npm install --save-dev @types/three
   ```

4. Start the development server:
   ```bash
   npm start
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## 📱 Usage Guide

1. **Getting Started**:
   - Allow camera permissions when prompted
   - Click "Start Experience" on the welcome screen
   - Position yourself so your hands are clearly visible to the camera

2. **Playing Music**:
   - **Right Hand**: Controls melody notes (higher hand position = higher notes)
   - **Left Hand**: Controls chord progressions
   - **Pinch Gesture**: Control volume (thumb and index finger pinch)

3. **UI Controls**:
   - Use the control panel to select different:
     - Root notes
     - Scales
     - Octaves
     - Sound presets
   - Toggle between visualization modes using the view button

## 🏗 Project Structure

```
src/
├── components/            # React components
│   ├── AudioEngine.tsx    # Tone.js integration
│   ├── HandTracking.tsx   # MediaPipe integration
│   ├── ParticleSystem.tsx # Three.js visuals
│   ├── UIControls/        # User interface elements
│   ├── Visualizers/       # Music visualizations
│   └── VirtualKeyboard.tsx # Visual keyboard display
├── context/               # React context providers
├── hooks/                 # Custom React hooks
├── styles/                # CSS files
├── types/                 # TypeScript type definitions
├── utils/                 # Utility functions
└── App.tsx                # Main application component
```

## 🔍 Implementation Details

HandSynth uses several key technologies working together:

1. **Hand Tracking** via MediaPipe:
   - Tracks hand landmarks in real-time
   - Detects gestures like pinching
   - Maps Y-position to musical notes and chords

2. **Audio Synthesis** via Tone.js:
   - Generates synthesized sounds in real-time
   - Processes audio with effects like reverb and compression
   - Manages multiple synthesizer voices for polyphony

3. **Visual Feedback** via Three.js:
   - Creates responsive particle systems
   - Visualizes musical notes and chords
   - Provides immersive visual experience synchronized to music

## 🧩 Customization

HandSynth can be extended in several ways:

- **Add New Sounds**: Extend the `SOUND_PRESETS` in `types/index.ts`
- **Add New Scales**: Expand the `SCALES` object in `types/index.ts`
- **Create New Visualizations**: Modify the particle system in `ParticleSystem.tsx`
- **Add New UI Themes**: Extend the view modes in `App.tsx`

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

Please do not copy without my permission

## All Rights reserved to Shahar Maoz

## 👏 Acknowledgments

- [MediaPipe](https://mediapipe.dev/) for hand tracking technology
- [Tone.js](https://tonejs.github.io/) for the audio synthesis framework
- [Three.js](https://threejs.org/) for 3D visualizations
- [React](https://reactjs.org/) for the UI framework

---

Made by Shahar Maoz
