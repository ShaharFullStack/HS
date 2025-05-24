// visuals/particleSystem.js
// Enhanced Three.js based particle system with pinch, release, and swipe gestures

import * as THREE from 'three';
import { appState } from '../main.js';
import { lerp } from '../utils.js';

// Configuration constants
const PARTICLE_COUNT = 1000;
const ACCENT_PARTICLE_COUNT = 0;
const PINCH_THRESHOLD_CLOSED = 10; // World units for pinch detection
const PINCH_THRESHOLD_OPEN = 30;   // Slightly larger to prevent flickering on release
const ATTRACTION_RADIUS = 50;      // Radius within which particles are attracted to a pinch
const SWIPE_RADIUS = 20;           // Radius for swipe gesture effect
const SWIPE_FORCE_MULTIPLIER = 0.2; // Force multiplier for swipe gestures

// New constants for dynamic blast strength
const BLAST_BASE_STRENGTH = 0.6;            // Base physical strength of the blast for main particles
const BLAST_DISTANCE_CONTRIBUTION = 2.0;    // How much closer particles are blasted harder (main)
const BLAST_TIGHTNESS_CONTRIBUTION = 1.0;   // How much a tighter pinch increases blast strength (main)

const ACCENT_BLAST_BASE_STRENGTH = 0.8;          // Base physical strength for accent particles
const ACCENT_BLAST_DISTANCE_CONTRIBUTION = 0.8;  // Distance contribution for accent particles
const ACCENT_BLAST_TIGHTNESS_CONTRIBUTION = 0.7; // Tightness contribution for accent particles


export class HandReactiveParticles {
    constructor(scene, renderer, camera) {
        if (!scene) {
            console.error("HandReactiveParticles: THREE.Scene is required!");
            return;
        }
        this.scene = scene;
        this.renderer = renderer;
        this.camera = camera;

        // Make background completely black to avoid brightness
        this.scene.background = new THREE.Color(0x000000);

        // Further reduce lighting to avoid brightness
        this.pointLight = new THREE.PointLight(0xffffff, 0.2, 50); // Reduced from 0.3
        this.pointLight.position.set(0, 0, 100);
        this.scene.add(this.pointLight);

        // Keep ambient light extremely dim
        this.ambientLight = new THREE.AmbientLight(0x030303); // Reduced from 0x050505
        this.scene.add(this.ambientLight);

        // Main particle system
        this.particleSystem = {
            particlesData: [],
            geometry: null,
            material: null,
            mesh: null
        };

        // Accent particle system (for visual interest)
        this.accentSystem = {
            particlesData: [],
            geometry: null,
            material: null,
            mesh: null
        };

        // Hand tracking and interaction data
        this.handInteractionData = {
            left: this.createHandDataObject(),
            right: this.createHandDataObject()
        };

        // World scale for converting normalized coordinates to world space
        this.worldScale = { x: 200, y: 150, z: 50 };

        // Initialize systems
        this.initParticleSystem();
        // this.initAccentParticles();
        this.initHandMeshes();

        // Setup post-processing if available
        if (this.renderer && typeof THREE.EffectComposer !== 'undefined') {
            this.setupPostProcessing();
        }
    }

    createHandDataObject() {
        return {
            isActive: false,
            isPinching: false,
            pinchPointWorld: new THREE.Vector3(),
            palmCenterWorld: new THREE.Vector3(),
            lastPalmCenterWorld: null,
            palmVelocity: new THREE.Vector3(),
            pinchOpenness: 0,
            attractedParticleIndices: new Set(),
            needsBlast: false,
            thumbMesh: null,
            indexMesh: null,
            pinchFieldMesh: null,
            lastUpdateTime: 0
        };
    }
initParticleSystem() {
        this.particleSystem.geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const colors = new Float32Array(PARTICLE_COUNT * 3);
        const sizes = new Float32Array(PARTICLE_COUNT);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3 = i * 3;

            // Create more interesting initial distribution
            const distributionChoice = Math.random();

            if (distributionChoice < 0.7) {
                // Spherical distribution (most particles)
                const radius = Math.random() * 70 + 30;
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos((Math.random() * 2) - 1);
                positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
                positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
                positions[i3 + 2] = radius * Math.cos(phi);
            } else if (distributionChoice < 0.9) {
                // Ring distribution
                const radius = 75 + Math.random() * 10;
                const theta = Math.random() * Math.PI * 2;
                positions[i3] = radius * Math.cos(theta);
                positions[i3 + 1] = radius * Math.sin(theta);
                positions[i3 + 2] = (Math.random() - 0.5) * 20;
            } else {
                // Central cluster
                const radius = Math.random() * 20;
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos((Math.random() * 2) - 1);
                positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
                positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
                positions[i3 + 2] = radius * Math.cos(phi);
            }            // Colorful particle palette with moderate brightness
            const colorChoice = Math.random();
            if (colorChoice < 0.15) {
                // Cool blues
                colors[i3] = 0.03 + Math.random() * 0.12;
                colors[i3 + 1] = 0.15 + Math.random() * 0.25;
                colors[i3 + 2] = 0.2 + Math.random() * 0.2;
            } else if (colorChoice < 0.3) {
                // Purples
                colors[i3] = 0.1 + Math.random() * 0.15;
                colors[i3 + 1] = 0.03 + Math.random() * 0.12;
                colors[i3 + 2] = 0.18 + Math.random() * 0.22;
            } else if (colorChoice < 0.45) {
                // Cyans and teals
                colors[i3] = 0.03 + Math.random() * 0.12;
                colors[i3 + 1] = 0.18 + Math.random() * 0.25;
                colors[i3 + 2] = 0.15 + Math.random() * 0.25;
            } else if (colorChoice < 0.6) {
                // Reds and oranges
                colors[i3] = 0.2 + Math.random() * 0.2;
                colors[i3 + 1] = 0.05 + Math.random() * 0.12;
                colors[i3 + 2] = 0.03 + Math.random() * 0.07;
            } else if (colorChoice < 0.75) {
                // Greens
                colors[i3] = 0.03 + Math.random() * 0.12;
                colors[i3 + 1] = 0.2 + Math.random() * 0.2;
                colors[i3 + 2] = 0.05 + Math.random() * 0.12;
            } else if (colorChoice < 0.9) {
                // Yellows and gold
                colors[i3] = 0.2 + Math.random() * 0.2;
                colors[i3 + 1] = 0.18 + Math.random() * 0.2;
                colors[i3 + 2] = 0.03 + Math.random() * 0.12;
            } else {
                // Pink and magenta
                colors[i3] = 0.2 + Math.random() * 0.2;
                colors[i3 + 1] = 0.05 + Math.random() * 0.12;
                colors[i3 + 2] = 0.18 + Math.random() * 0.22;
            }

            // Size variation
            sizes[i] = Math.random() * 3.0 + 1.2;

            this.particleSystem.particlesData.push({
                velocity: new THREE.Vector3(),
                originalPos: new THREE.Vector3(positions[i3], positions[i3 + 1], positions[i3 + 2]),
                baseSize: sizes[i],
                targetSize: sizes[i],
                baseColor: new THREE.Color(colors[i3], colors[i3 + 1], colors[i3 + 2]),
                isAttracted: false,
                attractedToHandKey: null,
                type: 'main',
                age: Math.random() * 100, // For animation cycles
                lifeSpeed: 0.01 + Math.random() * 0.02, // Different animation speeds
                inactiveTime: 0 // Time tracking for auto-return to original position
            });
        }        // Create uniqueTime attribute for animation variations
        const uniqueTimes = new Float32Array(PARTICLE_COUNT);
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            uniqueTimes[i] = Math.random() * Math.PI * 2; // Random offset between 0 and 2π
        }

        this.particleSystem.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.particleSystem.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.particleSystem.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        this.particleSystem.geometry.setAttribute('uniqueTime', new THREE.BufferAttribute(uniqueTimes, 1));

        // Enhanced vertex shader with animation and improved depth handling
        const vertexShader = `
  attribute float size;
  attribute float uniqueTime;  // Per-particle time offset for varied animation
  uniform float time;          // Global time from animation loop
  
  varying vec3 vColor;
  varying float vDepth;        // Pass depth for better lighting
  varying float vPulse;        // Animation phase
  
  void main() {
    // Pass variables to fragment shader
    vColor = color;
    
    // Calculate animated position with subtle wave motion
    vec3 animated_position = position;
    float wave = sin(time * 0.5 + uniqueTime) * 0.15;
    animated_position.y += wave;
    
    // Calculate view position for depth effects
    vec4 mvPosition = modelViewMatrix * vec4(animated_position, 1.0);
    vDepth = 1.0 + mvPosition.z * 0.1;  // Normalized depth value
    
    // Pulsing size effect synchronized with audio
    float pulse = 1.0 + 0.2 * sin(time * 2.0 + uniqueTime * 6.28);
    gl_PointSize = size * pulse * (550.0 / -mvPosition.z);
    
    // Animation phase for glow effect
    vPulse = 0.5 + 0.5 * sin(time * 3.0 + uniqueTime * 4.0);
    
    gl_Position = projectionMatrix * mvPosition;
  }
`;

        this.particleSystem.material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                deltaTime: { value: 0.16 },
                audioData: { value: new THREE.Vector3(0, 0, 0) },
                audioImpulse: { value: new THREE.Vector3(0, 0, 0) },
                cameraPosition: { value: this.camera ? this.camera.position : new THREE.Vector3() },
                pulseIntensity: { value: 0 },
                attractPoint: { value: new THREE.Vector3(5, 0, 0) },
                attractForce: { value: 0 },
                bloomThreshold: { value: 0.7 },
                bloomStrength: { value: 0.5 },
                resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
            },
            vertexShader: vertexShader,
            fragmentShader: `
                varying vec3 vColor;
                varying float vDepth;
                varying float vPulse;
                
                void main() {
                    // Create a radial gradient for each point (particle)
                    vec2 center = gl_PointCoord - 0.5;
                    float dist = length(center);
                    
                    // Apply soft edge to particle with variation based on pulse
                    float alpha = smoothstep(0.8, 0.3 - vPulse * 0.2, dist);
                    
                    // Define light properties
                    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
                    vec3 lightColor = vec3(1.0, 1.0, 1.0);
                    float ambient = 0.2;
                    
                    // Approximate normal for lighting
                    vec3 normal = normalize(vec3(center, 0.5));
                    
                    // Compute diffuse lighting
                    float diffuse = max(dot(normal, lightDir), 0.0);
                    
                    // Compute specular lighting with pulse effect
                    vec3 viewDir = vec3(0.0, 0.0, 1.0);
                    vec3 reflectDir = reflect(-lightDir, normal);
                    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 16.0);
                    
                    // Combine lighting with particle color and pulse
                    vec3 lighting = (ambient + diffuse) * vColor + spec * lightColor * (1.0 + vPulse);
                    
                    // Output final color with alpha
                    gl_FragColor = vec4(lighting, alpha);
                }
            `,
            transparent: true,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0.6
        });

        this.particleSystem.mesh = new THREE.Points(this.particleSystem.geometry, this.particleSystem.material);
        this.scene.add(this.particleSystem.mesh);
    }

    // initAccentParticles() {
    //     // Create a smaller set of accent particles that behave differently
    //     this.accentSystem.geometry = new THREE.BufferGeometry();

    //     const positions = new Float32Array(ACCENT_PARTICLE_COUNT * 3);
    //     const colors = new Float32Array(ACCENT_PARTICLE_COUNT * 3);
    //     const sizes = new Float32Array(ACCENT_PARTICLE_COUNT);

    //     for (let i = 0; i < ACCENT_PARTICLE_COUNT; i++) {
    //         const i3 = i * 3;

    //         // Initial random positions
    //         positions[i3] = (Math.random() - 0.5) * 100;
    //         positions[i3 + 1] = (Math.random() - 0.5) * 100;
    //         positions[i3 + 2] = (Math.random() - 0.5) * 100;            // Colorful accent particles with varied hues
    //         const accentColorType = Math.random();
    //         if (accentColorType < 0.2) {
    //             // Bright gold/yellow
    //             colors[i3] = 0.4 + Math.random() * 0.2;
    //             colors[i3 + 1] = 0.35 + Math.random() * 0.2;
    //             colors[i3 + 2] = 0.1 + Math.random() * 0.1;
    //         } else if (accentColorType < 0.4) {
    //             // Bright cyan/blue
    //             colors[i3] = 0.1 + Math.random() * 0.1;
    //             colors[i3 + 1] = 0.3 + Math.random() * 0.2;
    //             colors[i3 + 2] = 0.4 + Math.random() * 0.2;
    //         } else if (accentColorType < 0.6) {
    //             // Magenta/pink
    //             colors[i3] = 0.35 + Math.random() * 0.15;
    //             colors[i3 + 1] = 0.1 + Math.random() * 0.1;
    //             colors[i3 + 2] = 0.3 + Math.random() * 0.15;
    //         } else if (accentColorType < 0.8) {
    //             // Bright green
    //             colors[i3] = 0.1 + Math.random() * 0.1;
    //             colors[i3 + 1] = 0.35 + Math.random() * 0.2;
    //             colors[i3 + 2] = 0.1 + Math.random() * 0.1;
    //         } else {
    //             // White/silver (slightly brighter than before)
    //             colors[i3] = 0.4 + Math.random() * 0.15;
    //             colors[i3 + 1] = 0.4 + Math.random() * 0.15;
    //             colors[i3 + 2] = 0.4 + Math.random() * 0.15;
    //         }

    //         // Larger sizes
    //         sizes[i] = Math.random() * 2.0 + 2.0;

    //         this.accentSystem.particlesData.push({
    //             velocity: new THREE.Vector3(
    //                 (Math.random() - 0.5) * 0.1,
    //                 (Math.random() - 0.5) * 0.1,
    //                 (Math.random() - 0.5) * 0.1
    //             ),
    //             originalPos: new THREE.Vector3(positions[i3], positions[i3 + 1], positions[i3 + 2]),
    //             baseSize: sizes[i],
    //             targetSize: sizes[i],
    //             baseColor: new THREE.Color(colors[i3], colors[i3 + 1], colors[i3 + 2]),
    //             age: Math.random() * 100,
    //             lifeSpeed: 0.02 + Math.random() * 0.03
    //         });
    //     }        // Create uniqueTime attribute for animation variations
    //     const uniqueTimes = new Float32Array(ACCENT_PARTICLE_COUNT);
    //     for (let i = 0; i < ACCENT_PARTICLE_COUNT; i++) {
    //         uniqueTimes[i] = Math.random() * Math.PI * 2; // Random offset between 0 and 2π
    //     }

    //     this.accentSystem.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    //     this.accentSystem.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    //     this.accentSystem.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    //     this.accentSystem.geometry.setAttribute('uniqueTime', new THREE.BufferAttribute(uniqueTimes, 1));

    //     // Use a custom material with star-shaped texture but dimmer
    //     this.accentSystem.material = new THREE.PointsMaterial({
    //         size: 3.0,
    //         map: this.createStarTexture(),
    //         transparent: true,
    //         vertexColors: true,
    //         blending: THREE.AdditiveBlending,
    //         depthWrite: false,
    //         opacity: 0.4 // Reduced opacity from 0.5
    //     });

    //     this.accentSystem.mesh = new THREE.Points(this.accentSystem.geometry, this.accentSystem.material);
    //     this.scene.add(this.accentSystem.mesh);
    // }

    createStarTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, 32, 32);

        ctx.beginPath();
        ctx.moveTo(32, 0);
        for (let i = 0; i < 10; i++) {
            const radius = i % 2 === 0 ? 32 : 12;
            const angle = Math.PI * 2 * (i + 1) / 10;
            ctx.lineTo(
                32 + radius * Math.sin(angle),
                32 - radius * Math.cos(angle)
            );
        }
        ctx.closePath();

        // Gradient with further reduced opacity
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,255,255,0.4)'); // Reduced from 0.5
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.2)'); // Reduced from 0.3
        gradient.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.fillStyle = gradient;
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    initHandMeshes() {
        // Create empty objects for tracking without visual representation
        this.handInteractionData.left.thumbMesh = new THREE.Object3D();
        this.handInteractionData.left.indexMesh = new THREE.Object3D();
        this.handInteractionData.left.pinchFieldMesh = new THREE.Object3D();

        this.handInteractionData.right.thumbMesh = new THREE.Object3D();
        this.handInteractionData.right.indexMesh = new THREE.Object3D();
        this.handInteractionData.right.pinchFieldMesh = new THREE.Object3D();

        // We'll add these empty objects to the scene but keep them invisible
        // This maintains the structure without any visual elements
        this.scene.add(this.handInteractionData.left.thumbMesh);
        this.scene.add(this.handInteractionData.left.indexMesh);
        this.scene.add(this.handInteractionData.left.pinchFieldMesh);
        this.scene.add(this.handInteractionData.right.thumbMesh);
        this.scene.add(this.handInteractionData.right.indexMesh);
        this.scene.add(this.handInteractionData.right.pinchFieldMesh);

        // Ensure all hand visualization objects remain invisible
        this.setHandMeshVisibility(this.handInteractionData.left, false);
        this.setHandMeshVisibility(this.handInteractionData.right, false);
    }

    setHandMeshVisibility(handData, isVisible) {
        // Always keep all hand visualization elements invisible
        handData.thumbMesh.visible = false;
        handData.indexMesh.visible = false;
        handData.pinchFieldMesh.visible = false;
    }

    setupPostProcessing() {
        // If Three.js post-processing is available, add bloom effect
        if (typeof THREE.EffectComposer !== 'undefined') {
            try {
                // Check if these are available in the THREE namespace directly
                const EffectComposer = THREE.EffectComposer || (THREE.addons && THREE.addons.EffectComposer);
                const RenderPass = THREE.RenderPass || (THREE.addons && THREE.addons.RenderPass);
                const UnrealBloomPass = THREE.UnrealBloomPass || (THREE.addons && THREE.addons.UnrealBloomPass);

                if (!EffectComposer || !RenderPass || !UnrealBloomPass) {
                    console.warn("HandReactiveParticles: Post-processing components (EffectComposer, RenderPass, UnrealBloomPass) not found in THREE namespace or THREE.addons. Skipping post-processing setup.");
                    this.composer = null;
                    return;
                }

                this.composer = new EffectComposer(this.renderer);
                this.composer.addPass(new RenderPass(this.scene, this.camera));

                // Even more subtle bloom with very low intensity
                const bloomPass = new UnrealBloomPass(
                    new THREE.Vector2(window.innerWidth, window.innerHeight),
                    0.3,  // strength (reduced from 0.5)
                    0.4,  // radius (increased from 0.3 for softer glow)
                    0.95  // threshold (increased from 0.9)
                );
                this.composer.addPass(bloomPass);

                console.log("Post-processing setup complete");
            } catch (e) {
                console.warn("Failed to setup post-processing:", e);
                this.composer = null; // Ensure composer is null if setup fails
            }
        } else {
            console.warn("HandReactiveParticles: THREE.EffectComposer not defined. Skipping post-processing setup.");
            this.composer = null;
        }
    }

    // Scales a landmark from normalized coordinates to world space
    scaleLandmarkToWorld(landmark) {
        return new THREE.Vector3(
            (landmark.x - 0.5) * this.worldScale.x,      // X: 0 to 1 maps to -100 to 100
            (0.5 - landmark.y) * this.worldScale.y,      // Y: 0 (top) to 1 (bottom) maps to 75 to -75
            (landmark.z || 0) * this.worldScale.z - (this.worldScale.z / 2) // Z: centered around 0
        );
    }

    // Calculate average position of multiple landmarks
    calculateAverageLandmark(landmarks) {
        const avg = { x: 0, y: 0, z: 0 };
        landmarks.forEach(lm => {
            avg.x += lm.x;
            avg.y += lm.y;
            avg.z += (lm.z || 0);
        });
        avg.x /= landmarks.length;
        avg.y /= landmarks.length;
        avg.z /= landmarks.length;
        return avg;
    }

    // Position and orient a finger mesh based on two points
    updateFingerMesh(mesh, basePos, tipPos) {
        // We no longer need to update finger meshes as they're invisible
        // This function is kept for structure but doesn't do anything
    }

    // Create a visual blast effect at a position
    createBlastEffect(position, handKey) {
        // We'll skip creating visual blast effects to avoid brightness
        // The particles will still be affected by the blast physics
    }

    // Process hand landmarks and update hand state
    updateHandState(handKey, allLandmarks) {
        const data = this.handInteractionData[handKey];
        const now = Date.now();

        if (allLandmarks && allLandmarks.length > 20) { // Full hand landmarks available
            data.isActive = true;

            // Get key landmarks
            const wristLandmark = allLandmarks[0];
            const thumbCMCLandmark = allLandmarks[1]; // Thumb carpometacarpal joint
            const thumbMCPLandmark = allLandmarks[2]; // Thumb metacarpophalangeal joint
            const thumbIPLandmark = allLandmarks[3];  // Thumb interphalangeal joint
            const thumbTipLandmark = allLandmarks[4]; // Thumb tip

            const indexMCPLandmark = allLandmarks[5]; // Index finger metacarpophalangeal joint
            const indexPIPLandmark = allLandmarks[6]; // Index finger proximal interphalangeal joint
            const indexDIPLandmark = allLandmarks[7]; // Index finger distal interphalangeal joint
            const indexTipLandmark = allLandmarks[8]; // Index finger tip

            // Calculate hand center (palm)
            const palmLandmarks = [allLandmarks[0], allLandmarks[5], allLandmarks[9], allLandmarks[13], allLandmarks[17]];
            const palmCenter = this.calculateAverageLandmark(palmLandmarks);
            data.palmCenterWorld = this.scaleLandmarkToWorld(palmCenter);

            // Update finger positions
            const thumbTipWorld = this.scaleLandmarkToWorld(thumbTipLandmark);
            const indexTipWorld = this.scaleLandmarkToWorld(indexTipLandmark);
            // const thumbMCPWorld = this.scaleLandmarkToWorld(thumbMCPLandmark); // Not directly used for pinch logic
            // const indexMCPWorld = this.scaleLandmarkToWorld(indexMCPLandmark); // Not directly used for pinch logic

            // Calculate pinch point between thumb and index
            data.pinchPointWorld.lerpVectors(thumbTipWorld, indexTipWorld, 0.5);
            data.pinchOpenness = thumbTipWorld.distanceTo(indexTipWorld);

            // CHANGED: Reversed interaction logic
            // Now open hand attracts, pinch blasts
            const prevPinching = data.isPinching;

            if (data.pinchOpenness < PINCH_THRESHOLD_CLOSED) {
                // Now pinching causes blast
                if (!prevPinching) {
                    // Just started pinching, create blast
                    data.isPinching = true;
                    data.needsBlast = true; // Signal that a blast should occur
                    // Visual blast effect is disabled, physics will still apply

                    // Add vibration feedback if available
                    if (navigator.vibrate && now - data.lastUpdateTime > 500) { // Throttle vibration
                        navigator.vibrate([30, 40, 30]);
                        data.lastUpdateTime = now;
                    }
                }
                // If already pinching, isPinching remains true, needsBlast might already be true or will be handled
            } else if (data.pinchOpenness > PINCH_THRESHOLD_OPEN) {
                // Hand is open - attract particles
                if (prevPinching) {
                    // Just opened hand from a pinch
                    data.isPinching = false;
                    // No blast on release in this logic
                }
                data.isPinching = false; // Ensure it's marked as not pinching if open
            }
            // If between PINCH_THRESHOLD_CLOSED and PINCH_THRESHOLD_OPEN, maintain current 'isPinching' state (hysteresis)

            // Detect swipe gesture - calculate palm velocity
            if (!data.lastPalmCenterWorld) {
                data.lastPalmCenterWorld = data.palmCenterWorld.clone();
            } else {
                data.palmVelocity.subVectors(data.palmCenterWorld, data.lastPalmCenterWorld);
                // No division by time delta here, so palmVelocity is effectively displacement per frame.
                // This is fine as long as frame rate is relatively stable or forces are scaled accordingly.
                data.lastPalmCenterWorld.copy(data.palmCenterWorld);

                // If palm is moving fast, apply force to nearby particles
                if (data.palmVelocity.lengthSq() > (2.0 * 2.0)) { // Using lengthSq for efficiency
                    this.applySwipeForceToParticles(data.palmCenterWorld, data.palmVelocity);
                }
            }
        } else {
            // Hand landmarks not available or insufficient
            if (data.isActive) { // Was active, now lost
                // data.needsBlast = false; // Ensure no blast if hand disappears mid-pinch
            }
            data.isActive = false;
            data.isPinching = false; // Reset pinching state if hand is lost
            data.attractedParticleIndices.clear();
            data.lastPalmCenterWorld = null;
            data.palmVelocity.set(0, 0, 0);
        }
    }

    // Apply force to particles based on hand swipe
    applySwipeForceToParticles(palmCenter, palmVelocity) {
        const positions = this.particleSystem.geometry.attributes.position.array;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3 = i * 3;
            const particleData = this.particleSystem.particlesData[i];
            // Avoid creating new Vector3 in loop for performance if possible
            // const particlePos = new THREE.Vector3(positions[i3], positions[i3 + 1], positions[i3 + 2]);

            // Direct distance calculation
            const dx = positions[i3] - palmCenter.x;
            const dy = positions[i3 + 1] - palmCenter.y;
            const dz = positions[i3 + 2] - palmCenter.z;
            const distToPalmSq = dx * dx + dy * dy + dz * dz;

            if (distToPalmSq < SWIPE_RADIUS * SWIPE_RADIUS) {
                const distToPalm = Math.sqrt(distToPalmSq);
                // Closer particles get more force
                const forceStrength = (1 - distToPalm / SWIPE_RADIUS) * SWIPE_FORCE_MULTIPLIER;
                particleData.velocity.x += palmVelocity.x * forceStrength;
                particleData.velocity.y += palmVelocity.y * forceStrength;
                particleData.velocity.z += palmVelocity.z * forceStrength;

                // Add a slight upward bias to make swipes more dramatic
                particleData.velocity.y += forceStrength * 0.5;
            }
        }

        // // Also apply to accent particles
        // const accentPositions = this.accentSystem.geometry.attributes.position.array;
        // for (let i = 0; i < ACCENT_PARTICLE_COUNT; i++) {
        //     const i3 = i * 3;
        //     const particleData = this.accentSystem.particlesData[i];
        //     // const particlePos = new THREE.Vector3(accentPositions[i3], accentPositions[i3 + 1], accentPositions[i3 + 2]);
        //     const dx = accentPositions[i3] - palmCenter.x;
        //     const dy = accentPositions[i3 + 1] - palmCenter.y;
        //     const dz = accentPositions[i3 + 2] - palmCenter.z;
        //     const distToPalmSq = dx * dx + dy * dy + dz * dz;

        //     const swipeRadiusAccent = SWIPE_RADIUS * 1.5;
        //     if (distToPalmSq < swipeRadiusAccent * swipeRadiusAccent) {
        //         const distToPalm = Math.sqrt(distToPalmSq);
        //         // Accent particles react more dramatically
        //         const forceStrength = (1 - distToPalm / swipeRadiusAccent) * SWIPE_FORCE_MULTIPLIER * 1.5;
        //         particleData.velocity.x += palmVelocity.x * forceStrength;
        //         particleData.velocity.y += palmVelocity.y * forceStrength;
        //         particleData.velocity.z += palmVelocity.z * forceStrength;
        //     }
        // }
    }    // Main update method called on each animation frame
    update() {
        // Update hand states based on landmarks from appState
        this.updateHandState('left', appState.hands.leftHandLandmarks);
        this.updateHandState('right', appState.hands.rightHandLandmarks);

        // Update shader uniforms
        this.updateShaderUniforms();

        // Update main particles
        this.updateMainParticles();

        // Update accent particles
        // this.updateAccentParticles();

        // Create random color bursts for added visual interest
        this.createColorBursts();

        // Update audio-reactive effects if audio is playing
        if (appState.audio.isPlaying) {
            this.updateAudioReactiveEffects();
        }

        // Update hands post-effects (currently does nothing as meshes are invisible)
        this.updateHandPostEffects();

        // Use composer for rendering if available
        if (this.composer && this.renderer) {
            this.composer.render();
        }
        // else if (this.renderer) { // Fallback to direct render if composer isn't set up
        // this.renderer.render(this.scene, this.camera);
        // }
    }

    // Update the main particle system
    updateMainParticles() {
        const positions = this.particleSystem.geometry.attributes.position.array;
        const sizes = this.particleSystem.geometry.attributes.size.array;
        const colors = this.particleSystem.geometry.attributes.color.array;

        const tempParticlePos = new THREE.Vector3(); // For performance, reuse vector

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3 = i * 3;
            const particleData = this.particleSystem.particlesData[i];
            tempParticlePos.set(positions[i3], positions[i3 + 1], positions[i3 + 2]);

            // Update particle age for cyclic animations
            particleData.age += particleData.lifeSpeed;

            // Reset attraction state for current frame
            particleData.isAttracted = false;
            particleData.attractedToHandKey = null;

            // Process hand interactions (attraction, blast)
            this.processHandInteractions(i, i3, particleData, tempParticlePos, positions, colors);

            // Add subtle motion based on age (breathing/pulsing)
            if (!particleData.isAttracted) {
                const ageFactor = Math.sin(particleData.age) * 0.5 + 0.5;

                if (appState.audio.isPlaying) {
                    particleData.targetSize = particleData.baseSize * (1 + (appState.pulseFactor || 0) * 0.4 + // Reduced from 0.5
                        (appState.particleExplosionFactor || 0) * 0.6 + // Reduced from 0.8
                        ageFactor * 0.3);

                    // Make particles move more energetically with audio
                    particleData.velocity.x += (Math.random() - 0.5) * 0.02 * (appState.pulseFactor || 0);
                    particleData.velocity.y += (Math.random() - 0.5) * 0.02 * (appState.pulseFactor || 0);
                    particleData.velocity.z += (Math.random() - 0.5) * 0.02 * (appState.pulseFactor || 0);
                } else {
                    particleData.targetSize = particleData.baseSize * (0.8 + ageFactor * 0.4);

                    // Gentle return to original position
                    const returnForceX = (particleData.originalPos.x - tempParticlePos.x) * 0.001;
                    const returnForceY = (particleData.originalPos.y - tempParticlePos.y) * 0.001;
                    const returnForceZ = (particleData.originalPos.z - tempParticlePos.z) * 0.001;
                    particleData.velocity.x += returnForceX;
                    particleData.velocity.y += returnForceY;
                    particleData.velocity.z += returnForceZ;
                }

                // Add subtle circular motion
                const orbitSpeed = 0.001;
                const orbitRadius = 0.2;
                particleData.velocity.x += Math.sin(particleData.age * 2) * orbitSpeed * orbitRadius;
                particleData.velocity.z += Math.cos(particleData.age * 2) * orbitSpeed * orbitRadius;
            } else {
                // Make attracted particles smaller but more intense
                particleData.targetSize = particleData.baseSize * 0.5; // Reduced from 0.6
            }

            // Apply size adjustments with smoothing
            sizes[i] = lerp(sizes[i], particleData.targetSize, 0.15);

            // Apply physics - damping
            particleData.velocity.multiplyScalar(0.96);

            // Update positions
            positions[i3] += particleData.velocity.x;
            positions[i3 + 1] += particleData.velocity.y;
            positions[i3 + 2] += particleData.velocity.z;

            // Apply boundary constraints - smoother transition at edges
            const maxDist = 180;
            // tempParticlePos updated with new position
            tempParticlePos.set(positions[i3], positions[i3 + 1], positions[i3 + 2]);
            const distanceFromCenterSq = tempParticlePos.lengthSq();

            if (distanceFromCenterSq > maxDist * maxDist) {
                const normal = tempParticlePos.normalize(); // normal is now tempParticlePos

                // Apply position correction (bounce back from boundary)
                positions[i3] = normal.x * maxDist * 0.98;
                positions[i3 + 1] = normal.y * maxDist * 0.98;
                positions[i3 + 2] = normal.z * maxDist * 0.98;

                // Reflect velocity (bounce)
                const dot = particleData.velocity.dot(normal);
                particleData.velocity.sub(normal.multiplyScalar(2 * dot)); // normal is modified here
                particleData.velocity.multiplyScalar(0.7); // Some energy loss on bounce
            }
        }

        // Clear blast states after processing all particles for this frame
        for (const handKey of ['left', 'right']) {
            const handData = this.handInteractionData[handKey];
            if (handData.needsBlast) {
                handData.needsBlast = false; // Blast is a one-time impulse per pinch event
                handData.attractedParticleIndices.clear(); // Clear attraction list for this hand on blast
            }
        }

        // Update buffers
        this.particleSystem.geometry.attributes.position.needsUpdate = true;
        this.particleSystem.geometry.attributes.size.needsUpdate = false;
        this.particleSystem.geometry.attributes.color.needsUpdate = false;
    }

    // Process hand interactions with main particles
    processHandInteractions(particleIndex, particleArrayIndex, particleData, currentPosVec, positionsArray, colorsArray) {
        const tempAttractionDirection = new THREE.Vector3(); // Reuse vectors for performance
        const tempTangentDirection = new THREE.Vector3();
        const tempBlastDirection = new THREE.Vector3();

        for (const handKey of ['left', 'right']) {
            const handData = this.handInteractionData[handKey];
            if (handData.isActive) {
                // Open hand attracts particles (not pinching)
                if (!handData.isPinching) {
                    const distToPalm = currentPosVec.distanceTo(handData.palmCenterWorld);
                    const attractionRadiusOpen = ATTRACTION_RADIUS * 1.5; // Increased radius for open hand

                    if (distToPalm < attractionRadiusOpen) {
                        tempAttractionDirection.subVectors(handData.palmCenterWorld, currentPosVec).normalize();

                        const distanceFactor = 1 - Math.pow(distToPalm / attractionRadiusOpen, 2); // Stronger effect closer
                        const attractionForceMagnitude = 0.08 * distanceFactor; // Gentler attraction

                        // Apply attraction force
                        particleData.velocity.add(tempAttractionDirection.clone().multiplyScalar(attractionForceMagnitude));

                        // Enhanced swirling effect
                        const upVector = new THREE.Vector3(0, 1, 0); // Define 'up' for consistent swirl if desired
                        tempTangentDirection.crossVectors(tempAttractionDirection, upVector).normalize();

                        if (tempTangentDirection.lengthSq() > 0.001) { // Ensure non-zero tangent
                            const swirlStrength = 0.04 * distanceFactor; // Reduced swirl strength
                            particleData.velocity.add(tempTangentDirection.multiplyScalar(swirlStrength));
                        }

                        particleData.isAttracted = true;
                        particleData.attractedToHandKey = handKey;
                        handData.attractedParticleIndices.add(particleIndex);                        // Transition color to vibrant hand color with easing
                        // More colorful hand colors based on time for variety
                        const timeOffset = handKey === 'left' ? 0 : Math.PI;
                        const hue = (Date.now() * 0.0001 + timeOffset) % 1;

                        let handColor;
                        if (handKey === 'left') {
                            // Cycle through cool colors for left hand (blues, purples, cyans)
                            const coolHue = (hue * 0.5) + 0.5; // Range from 0.5 to 1.0 (blue to purple)
                            handColor = new THREE.Color().setHSL(coolHue, 0.7, 0.5);
                        } else {
                            // Cycle through warm colors for right hand (reds, oranges, yellows)
                            const warmHue = hue * 0.3; // Range from 0 to 0.3 (red to yellow)
                            handColor = new THREE.Color().setHSL(warmHue, 0.7, 0.5);
                        }

                        colorsArray[particleArrayIndex] = lerp(colorsArray[particleArrayIndex], handColor.r, 0.05);
                        colorsArray[particleArrayIndex + 1] = lerp(colorsArray[particleArrayIndex + 1], handColor.g, 0.05);
                        colorsArray[particleArrayIndex + 2] = lerp(colorsArray[particleArrayIndex + 2], handColor.b, 0.05);
                    }
                } else if (handData.needsBlast) { // Pinch (isPinching is true) and needsBlast is set
                    const distToPalm = currentPosVec.distanceTo(handData.palmCenterWorld);
                    const blastRadius = ATTRACTION_RADIUS * 1.2;

                    if (distToPalm < blastRadius) {
                        tempBlastDirection.subVectors(currentPosVec, handData.palmCenterWorld).normalize();

                        if (tempBlastDirection.lengthSq() === 0) { // Avoid issues if particle is at palm center
                            tempBlastDirection.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
                        }

                        // Add slight spread to the blast
                        tempBlastDirection.x += (Math.random() - 0.5) * 0.3;
                        tempBlastDirection.y += (Math.random() - 0.5) * 0.3;
                        tempBlastDirection.z += (Math.random() - 0.5) * 0.3;
                        tempBlastDirection.normalize();

                        // Dynamic blast magnitude based on distance and pinch tightness
                        const distanceFactor = Math.max(0, 1 - distToPalm / blastRadius); // 1 if at center, 0 at edge
                        const tightnessFactor = Math.max(0, 1.0 - (handData.pinchOpenness / PINCH_THRESHOLD_CLOSED)); // 1 for tightest pinch, 0 at threshold

                        const blastMagnitude = BLAST_BASE_STRENGTH +
                            (distanceFactor * BLAST_DISTANCE_CONTRIBUTION) +
                            (tightnessFactor * BLAST_TIGHTNESS_CONTRIBUTION);

                        particleData.velocity.add(tempBlastDirection.multiplyScalar(blastMagnitude));

                        // Add a slight rotation effect to the blast
                        const rotAxis = new THREE.Vector3(0, 1, 0); // Can be randomized or based on hand orientation
                        const rotForce = tempTangentDirection.crossVectors(tempBlastDirection, rotAxis).normalize().multiplyScalar(0.02 * blastMagnitude * 0.1); // Weaker rotational force
                        particleData.velocity.add(rotForce);
                    }
                }
            }
        }

        // Color restoration for particles that are no longer attracted this frame
        if (!particleData.isAttracted) {
            colorsArray[particleArrayIndex] = lerp(colorsArray[particleArrayIndex], particleData.baseColor.r, 0.05);
            colorsArray[particleArrayIndex + 1] = lerp(colorsArray[particleArrayIndex + 1], particleData.baseColor.g, 0.05);
            colorsArray[particleArrayIndex + 2] = lerp(colorsArray[particleArrayIndex + 2], particleData.baseColor.b, 0.05);
        }
    }

    // Update accent particles
    // updateAccentParticles() {
    //     const positions = this.accentSystem.geometry.attributes.position.array;
    //     const sizes = this.accentSystem.geometry.attributes.size.array;

    //     const tempCurrentPos = new THREE.Vector3();
    //     const tempAttractionDirection = new THREE.Vector3();
    //     const tempTangentDir = new THREE.Vector3();
    //     const tempBlastDirection = new THREE.Vector3();


    //     for (let i = 0; i < this.accentSystem.particlesData.length; i++) {
    //         const i3 = i * 3;
    //         const particleData = this.accentSystem.particlesData[i];
    //         tempCurrentPos.set(positions[i3], positions[i3 + 1], positions[i3 + 2]);

    //         let isInfluencedByHand = false;

    //         // Check for hand influence
    //         for (const handKey of ['left', 'right']) {
    //             const handData = this.handInteractionData[handKey];
    //             if (handData.isActive) {
    //                 const distToPalm = tempCurrentPos.distanceTo(handData.palmCenterWorld);

    //                 // Open hand attracts
    //                 if (!handData.isPinching) {
    //                     const accentAttractionRadius = ATTRACTION_RADIUS * 2;
    //                     if (distToPalm < accentAttractionRadius) {
    //                         const distanceFactor = 1 - Math.pow(distToPalm / accentAttractionRadius, 2);
    //                         tempAttractionDirection.subVectors(handData.palmCenterWorld, tempCurrentPos).normalize();

    //                         particleData.velocity.add(tempAttractionDirection.clone().multiplyScalar(0.06 * distanceFactor)); // Gentler attraction
    //                         isInfluencedByHand = true;

    //                         // Add swirl effect (different from main particles for variety)
    //                         tempTangentDir.set(-tempAttractionDirection.y, tempAttractionDirection.x, tempAttractionDirection.z).normalize();
    //                         particleData.velocity.add(tempTangentDir.multiplyScalar(0.03 * distanceFactor));
    //                     }
    //                 } else if (handData.needsBlast) { // Pinch blasts
    //                     const accentBlastRadius = ATTRACTION_RADIUS * 1.5;
    //                     if (distToPalm < accentBlastRadius) {
    //                         tempBlastDirection.subVectors(tempCurrentPos, handData.palmCenterWorld).normalize();

    //                         if (tempBlastDirection.lengthSq() === 0) {
    //                             tempBlastDirection.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    //                         }
    //                         tempBlastDirection.x += (Math.random() - 0.5) * 0.4;
    //                         tempBlastDirection.y += (Math.random() - 0.5) * 0.4;
    //                         tempBlastDirection.z += (Math.random() - 0.5) * 0.4;
    //                         tempBlastDirection.normalize();

    //                         const distanceFactor = Math.max(0, 1 - distToPalm / accentBlastRadius);
    //                         const tightnessFactor = Math.max(0, 1.0 - (handData.pinchOpenness / PINCH_THRESHOLD_CLOSED));

    //                         const blastMagnitude = ACCENT_BLAST_BASE_STRENGTH +
    //                             (distanceFactor * ACCENT_BLAST_DISTANCE_CONTRIBUTION) +
    //                             (tightnessFactor * ACCENT_BLAST_TIGHTNESS_CONTRIBUTION);

    //                         particleData.velocity.add(tempBlastDirection.multiplyScalar(blastMagnitude));
    //                         isInfluencedByHand = true;
    //                     }
    //                 }
    //             }
    //         }

    //         // Update age
    //         particleData.age += particleData.lifeSpeed;

    //         // Regular motion when not influenced by hand
    //         if (!isInfluencedByHand) {
    //             const orbitSpeed = 0.005;
    //             const orbitFactor = Math.sin(particleData.age) * 0.5 + 0.5;
    //             const orbitRadius = 1.0 + orbitFactor * 2.0;

    //             particleData.velocity.x += Math.sin(particleData.age * 0.7) * orbitSpeed * orbitRadius;
    //             particleData.velocity.y += Math.sin(particleData.age * 0.5) * orbitSpeed * orbitRadius * 0.5; // Less Y movement
    //             particleData.velocity.z += Math.cos(particleData.age * 0.7) * orbitSpeed * orbitRadius;
    //         }

    //         // Audio reactivity
    //         if (appState.audio && appState.audio.isPlaying && appState.pulseFactor) {
    //             const pulseFactor = appState.pulseFactor || 0;
    //             particleData.targetSize = particleData.baseSize * (1.0 + pulseFactor * 1.0); // Reduced audio response

    //             particleData.velocity.x += (Math.random() - 0.5) * 0.02 * pulseFactor;
    //             particleData.velocity.y += (Math.random() - 0.5) * 0.02 * pulseFactor;
    //             particleData.velocity.z += (Math.random() - 0.5) * 0.02 * pulseFactor;
    //         } else {
    //             const orbitFactor = Math.sin(particleData.age) * 0.5 + 0.5;
    //             particleData.targetSize = particleData.baseSize * (0.8 + orbitFactor * 0.4);
    //         }

    //         // Apply size with smoothing
    //         sizes[i] = lerp(sizes[i], particleData.targetSize, 0.1);

    //         // Damping
    //         particleData.velocity.multiplyScalar(0.95);

    //         // Update position
    //         positions[i3] += particleData.velocity.x;
    //         positions[i3 + 1] += particleData.velocity.y;
    //         positions[i3 + 2] += particleData.velocity.z;

    //         // Boundary check - more aggressive reset for accent particles
    //         const accentMaxDistSq = 200 * 200;
    //         if (tempCurrentPos.set(positions[i3], positions[i3 + 1], positions[i3 + 2]).lengthSq() > accentMaxDistSq) {
    //             // Reset to a new random position within a smaller central sphere
    //             const resetRadius = 50;
    //             positions[i3] = (Math.random() - 0.5) * resetRadius;
    //             positions[i3 + 1] = (Math.random() - 0.5) * resetRadius;
    //             positions[i3 + 2] = (Math.random() - 0.5) * resetRadius;
    //             particleData.velocity.set(
    //                 (Math.random() - 0.5) * 0.1,
    //                 (Math.random() - 0.5) * 0.1,
    //                 (Math.random() - 0.5) * 0.1
    //             );
    //         }
    //     }

    //     // Update buffers
    //     this.accentSystem.geometry.attributes.position.needsUpdate = true;
    //     this.accentSystem.geometry.attributes.size.needsUpdate = true;
    //     // Accent particle colors are static based on their initial setup, no need to update color attribute unless they change
    // }    
    // Update effects based on audio data
    updateAudioReactiveEffects() {
        const pulseFactor = appState.pulseFactor || 0;
        const explosionFactor = appState.particleExplosionFactor || 0;

        if (this.pointLight) {
            // Slightly higher base intensity for more vibrant colors
            this.pointLight.intensity = 0.15 + pulseFactor * 0.25;

            // Faster color cycling for more vibrant visual experience
            const hue = (Date.now() * 0.0002) % 1; // Doubled speed of color change

            // Calculate a second hue for additional accent light
            const hue2 = (hue + 0.5) % 1; // Complementary color

            // Higher saturation for more vibrant colors
            const saturation = 0.6 + pulseFactor * 0.3;
            const lightness = 0.2 + pulseFactor * 0.1;

            this.pointLight.color.setHSL(hue, saturation, lightness);

            // Create or update a second point light if it doesn't exist yet
            if (!this.accentLight) {
                this.accentLight = new THREE.PointLight(0xffffff, 0.1, 150);
                this.accentLight.position.set(-50, 50, -30); // Position opposite to main light
                this.scene.add(this.accentLight);
            }

            // Update accent light with complementary color
            this.accentLight.intensity = 0.1 + pulseFactor * 0.15;
            this.accentLight.color.setHSL(hue2, saturation * 0.8, lightness);
        } if (explosionFactor > 0.7) {
            const flashIntensity = Math.min(1.0, (explosionFactor - 0.7) * 2);

            // Add subtle color tint based on current point light color instead of just white
            // This creates colored flashes that match the active color scheme
            const hue = (Date.now() * 0.0002) % 1;
            const flashColor = new THREE.Color().setHSL(hue, 0.8, 0.5);

            this.scene.background.setRGB(
                0.005 + flashIntensity * 0.015 * flashColor.r,
                0.005 + flashIntensity * 0.015 * flashColor.g,
                0.005 + flashIntensity * 0.015 * flashColor.b
            );
        } else {
            // Smoothly return to base background if not flashing
            const r = lerp(this.scene.background.r, 0.005, 0.1);
            const g = lerp(this.scene.background.g, 0.005, 0.1);
            const b = lerp(this.scene.background.b, 0.005, 0.1);
            this.scene.background.setRGB(r, g, b);
        }
    }

    // Update hand visualization effects
    updateHandPostEffects() {
        // No visual hand effects will be updated since we're keeping them hidden
    }

    // Handle window resize events
    onWindowResize() {
        if (this.camera) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        }
        if (this.renderer) {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
        if (this.composer) { // Check if composer exists
            this.composer.setSize(window.innerWidth, window.innerHeight);

            // Update bloom pass resolution if it exists
            if (this.composer.passes.length > 1) {
                const bloomPass = this.composer.passes.find(pass => pass.resolution); // More robust find
                if (bloomPass && bloomPass.resolution) {
                    bloomPass.resolution.set(window.innerWidth, window.innerHeight);
                }
            }
        }
    }

    // Add this to your update() method
    updateShaderUniforms() {
        if (this.particleSystem.material.uniforms) {
            // Get current time
            const curTime = performance.now() * 0.001;  // seconds

            // Calculate delta time (or use a fixed value for stability)
            const deltaTime = Math.min(0.05, curTime - (this._lastTime || curTime));
            this._lastTime = curTime;

            // Update time-related uniforms
            this.particleSystem.material.uniforms.time.value = curTime;
            this.particleSystem.material.uniforms.deltaTime.value = deltaTime;

            // Update audio-related uniforms
            if (appState.audio && appState.audio.isPlaying) {
                this.particleSystem.material.uniforms.audioData.value.set(
                    appState.bassFactor || 0,
                    appState.midFactor || 0,
                    appState.trebleFactor || 0
                );

                this.particleSystem.material.uniforms.audioImpulse.value.set(
                    appState.particleExplosionFactor || 0,
                    appState.pulseFactor || 0,
                    appState.sustainFactor || 0
                );

                this.particleSystem.material.uniforms.pulseIntensity.value = appState.pulseFactor || 0;
            }

            // Update camera position (in case it moves)
            if (this.camera) {
                this.particleSystem.material.uniforms.cameraPosition.value.copy(this.camera.position);
            }

            // Update attraction point (use active hand if available)
            if (this.handInteractionData.right.isActive) {
                this.particleSystem.material.uniforms.attractPoint.value.copy(this.handInteractionData.right.palmCenterWorld);
                this.particleSystem.material.uniforms.attractForce.value = this.handInteractionData.right.isPinching ? 0 : 1;
            } else if (this.handInteractionData.left.isActive) {
                this.particleSystem.material.uniforms.attractPoint.value.copy(this.handInteractionData.left.palmCenterWorld);
                this.particleSystem.material.uniforms.attractForce.value = this.handInteractionData.left.isPinching ? 0 : 1;
            } else {
                this.particleSystem.material.uniforms.attractForce.value = 0;
            }
        }
    }

    // Randomly create bursts of color among particles
    createColorBursts() {
        // Only proceed occasionally (roughly every 2 seconds with some randomness)
        if (Math.random() > 0.02) return;

        const positions = this.particleSystem.geometry.attributes.position.array;
        const colors = this.particleSystem.geometry.attributes.color.array;

        // Choose burst parameters
        const burstCenter = new THREE.Vector3(
            (Math.random() - 0.5) * 150,
            (Math.random() - 0.5) * 150,
            (Math.random() - 0.5) * 150
        );

        const burstRadius = 20 + Math.random() * 40;

        // Choose a vibrant color for this burst
        const burstHue = Math.random();
        const burstColor = new THREE.Color().setHSL(burstHue, 0.8, 0.5);

        // Apply to nearby particles
        const tempPos = new THREE.Vector3();

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3 = i * 3;
            tempPos.set(
                positions[i3],
                positions[i3 + 1],
                positions[i3 + 2]
            );

            const distToBurst = tempPos.distanceTo(burstCenter);

            if (distToBurst < burstRadius) {
                // Calculate intensity based on distance from center
                const intensity = 1 - (distToBurst / burstRadius);

                // Blend current color with burst color based on intensity
                colors[i3] = lerp(colors[i3], burstColor.r, intensity * 0.7);
                colors[i3 + 1] = lerp(colors[i3 + 1], burstColor.g, intensity * 0.7);
                colors[i3 + 2] = lerp(colors[i3 + 2], burstColor.b, intensity * 0.7);

                // Add small velocity away from burst center
                const particleData = this.particleSystem.particlesData[i];
                const pushDir = new THREE.Vector3().subVectors(tempPos, burstCenter).normalize();
                const pushStrength = 0.05 * intensity;

                particleData.velocity.add(
                    pushDir.multiplyScalar(pushStrength)
                );
            }
        }

        this.particleSystem.geometry.attributes.color.needsUpdate = true;
    }
}