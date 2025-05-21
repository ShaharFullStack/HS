// visuals/particleSystem.js
// Three.js based particle system inspired by "Chord Blast"
// Reacts to hand movements and audio state from appState.

import * as THREE from 'three'; // Assuming THREE is globally available via CDN in index.html
import { appState } from '../main.js';
import { lerp } from '../utils.js'; // For smooth transitions

const PARTICLE_COUNT = 1000; // Number of particles, similar to "Chord Blast"

export class HandReactiveParticles {
  constructor(scene) {
    if (!scene) {
      console.error("HandReactiveParticles: THREE.Scene is required!");
      return;
    }
    this.scene = scene;
    this.particleSystem = {
      particlesData: [], // To store individual particle properties like velocity, targetSize
      geometry: null,
      material: null,
      mesh: null
    };
    this.handMeshes = {
      left: null,
      right: null
    };

    this.initParticleSystem();
    this.initHandMeshes();

    // Store original colors for when audio is not playing
    this.originalParticleColors = new Float32Array(PARTICLE_COUNT * 3);
    // Store initial particle sizes
    this.initialParticleSizes = new Float32Array(PARTICLE_COUNT);


    // Capture initial colors and sizes
    const colors = this.particleSystem.geometry.attributes.color.array;
    const sizes = this.particleSystem.geometry.attributes.size.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        this.originalParticleColors[i3] = colors[i3];
        this.originalParticleColors[i3 + 1] = colors[i3 + 1];
        this.originalParticleColors[i3 + 2] = colors[i3 + 2];
        this.initialParticleSizes[i] = sizes[i];
    }
  }

  initParticleSystem() {
    this.particleSystem.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      // Position - spread in a sphere, similar to "Chord Blast"
      const radius = Math.random() * 60 + 20; // Random radius
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1); // More uniform spherical distribution

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      // Random initial colors
      colors[i3] = Math.random() * 0.5 + 0.5; // Brighter colors
      colors[i3 + 1] = Math.random() * 0.5 + 0.2;
      colors[i3 + 2] = Math.random() * 0.5 + 0.5;

      // Random initial sizes
      sizes[i] = Math.random() * 2.5 + 0.5;

      // Store particle data for animation
      this.particleSystem.particlesData.push({
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1
        ),
        originalPos: new THREE.Vector3(positions[i3], positions[i3+1], positions[i3+2]),
        targetSize: sizes[i],
        baseColor: new THREE.Color(colors[i3], colors[i3+1], colors[i3+2])
      });
    }

    this.particleSystem.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particleSystem.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.particleSystem.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    this.particleSystem.material = new THREE.PointsMaterial({
      size: 1.5, // Base size, will be scaled by attribute
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particleSystem.mesh = new THREE.Points(this.particleSystem.geometry, this.particleSystem.material);
    this.scene.add(this.particleSystem.mesh);
  }

  initHandMeshes() {
    const handGeometry = new THREE.SphereGeometry(4, 16, 16); // Smaller, simpler sphere
    const leftHandMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffaa, // Cyan for left hand
      transparent: true,
      opacity: 0.6,
      wireframe: true
    });
    const rightHandMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa00, // Orange for right hand
      transparent: true,
      opacity: 0.6,
      wireframe: true
    });

    this.handMeshes.left = new THREE.Mesh(handGeometry, leftHandMaterial);
    this.handMeshes.right = new THREE.Mesh(handGeometry, rightHandMaterial);

    this.handMeshes.left.visible = false;
    this.handMeshes.right.visible = false;

    this.scene.add(this.handMeshes.left);
    this.scene.add(this.handMeshes.right);
  }

  update() {
    const now = Date.now() * 0.001;
    const positions = this.particleSystem.geometry.attributes.position.array;
    const sizes = this.particleSystem.geometry.attributes.size.array;
    const colors = this.particleSystem.geometry.attributes.color.array;

    // Update hand mesh positions and visibility
    this.updateSingleHandMesh(this.handMeshes.left, appState.hands.leftHandLandmarks, -1); // Left hand often on negative X
    this.updateSingleHandMesh(this.handMeshes.right, appState.hands.rightHandLandmarks, 1); // Right hand often on positive X

    const audioPlaying = appState.audio.isPlaying;
    const explosionFactor = appState.particleExplosionFactor || 0; // From main appState
    const pulseFactor = appState.pulseFactor || 0; // From main appState


    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const particleData = this.particleSystem.particlesData[i];

      // --- Hand Interaction ---
      let totalForce = new THREE.Vector3();
      const handInteractionRadius = 80; // How close particles need to be to a hand to react
      const handForceStrength = 0.03;   // How strongly particles are pushed/pulled

      [this.handMeshes.left, this.handMeshes.right].forEach(handMesh => {
        if (handMesh.visible) {
          const particlePos = new THREE.Vector3(positions[i3], positions[i3 + 1], positions[i3 + 2]);
          const distVec = new THREE.Vector3().subVectors(particlePos, handMesh.position);
          const distanceToHand = distVec.length();

          if (distanceToHand < handInteractionRadius) {
            // Repel particles from hand
            const repelForce = distVec.normalize().multiplyScalar(handForceStrength * (1 - distanceToHand / handInteractionRadius));
            totalForce.add(repelForce);

            // Color influence from hand proximity
            const colorInfluence = (1 - distanceToHand / handInteractionRadius);
            colors[i3] = lerp(particleData.baseColor.r, handMesh.material.color.r, colorInfluence * 0.7);
            colors[i3+1] = lerp(particleData.baseColor.g, handMesh.material.color.g, colorInfluence * 0.7);
            colors[i3+2] = lerp(particleData.baseColor.b, handMesh.material.color.b, colorInfluence * 0.7);
          }
        }
      });
       if (!this.handMeshes.left.visible && !this.handMeshes.right.visible) {
            // Reset to base color if no hands are interacting nearby this particle
            // This needs to be smarter if one hand is visible but not near this particle
            colors[i3] = particleData.baseColor.r;
            colors[i3+1] = particleData.baseColor.g;
            colors[i3+2] = particleData.baseColor.b;
        }


      particleData.velocity.add(totalForce);

      // --- Audio Reactivity & Basic Motion ---
      if (audioPlaying) {
        // Pulsate size with general audio pulseFactor (from note/chord changes)
        particleData.targetSize = this.initialParticleSizes[i] * (1 + pulseFactor * 0.8 + explosionFactor * 1.2);

        // More agitated movement when audio is playing
        particleData.velocity.x += (Math.random() - 0.5) * 0.02;
        particleData.velocity.y += (Math.random() - 0.5) * 0.02;
        particleData.velocity.z += (Math.random() - 0.5) * 0.02;

        // Color shift when playing
        if (!this.handMeshes.left.visible && !this.handMeshes.right.visible) { // Only if not hand-colored
            colors[i3] = particleData.baseColor.r * (0.7 + Math.sin(now * 2 + i * 0.1) * 0.3);
            colors[i3+1] = particleData.baseColor.g * (0.7 + Math.sin(now * 2.2 + i * 0.1) * 0.3);
            colors[i3+2] = particleData.baseColor.b * (0.7 + Math.sin(now * 2.4 + i * 0.1) * 0.3);
        }

      } else {
        // Return to original size and color when not playing
        particleData.targetSize = this.initialParticleSizes[i];
         if (!this.handMeshes.left.visible && !this.handMeshes.right.visible) {
            colors[i3] = lerp(colors[i3], particleData.baseColor.r, 0.1);
            colors[i3+1] = lerp(colors[i3+1], particleData.baseColor.g, 0.1);
            colors[i3+2] = lerp(colors[i3+2], particleData.baseColor.b, 0.1);
        }
        // Gravity towards original position or center when idle
        const returnForce = new THREE.Vector3().subVectors(particleData.originalPos, new THREE.Vector3(positions[i3], positions[i3+1], positions[i3+2])).multiplyScalar(0.002);
        particleData.velocity.add(returnForce);
      }

      // Smoothly interpolate size
      sizes[i] = lerp(sizes[i], particleData.targetSize, 0.1);


      // Apply damping to velocity
      particleData.velocity.multiplyScalar(0.97); // Damping factor

      // Update position
      positions[i3] += particleData.velocity.x;
      positions[i3 + 1] += particleData.velocity.y;
      positions[i3 + 2] += particleData.velocity.z;

      // Boundary conditions (simple spherical boundary)
      const currentParticlePos = new THREE.Vector3(positions[i3], positions[i3+1], positions[i3+2]);
      const distFromCenter = currentParticlePos.length();
      const maxDist = 150;
      if (distFromCenter > maxDist) {
        // Reflect velocity or push back towards center
        currentParticlePos.normalize().multiplyScalar(maxDist);
        positions[i3] = currentParticlePos.x;
        positions[i3+1] = currentParticlePos.y;
        positions[i3+2] = currentParticlePos.z;
        particleData.velocity.multiplyScalar(-0.5); // Reflect and dampen
      }
    }

    this.particleSystem.geometry.attributes.position.needsUpdate = true;
    this.particleSystem.geometry.attributes.size.needsUpdate = true;
    this.particleSystem.geometry.attributes.color.needsUpdate = true;

    // Optional: Rotate the whole particle system slowly
    // this.particleSystem.mesh.rotation.y += 0.0005;
  }

  updateSingleHandMesh(handMesh, handLandmarks, xMultiplier = 1) {
    if (appState.hands.handDetected && handLandmarks && handLandmarks[0]) { // Check wrist landmark
      const wrist = handLandmarks[0];
      // Scale normalized MediaPipe coords (0-1) to Three.js world space
      // Assuming camera looks along -Z, X is horizontal, Y is vertical.
      // MediaPipe X is mirrored for selfie view, so (1-wrist.x) for right side of screen.
      // We need to map this to our Three.js scene.
      // Let's assume a visual field width of about 200 units and height of 150.
      const worldX = ( (xMultiplier === 1 ? wrist.x : (1 - wrist.x)) - 0.5) * 200 * xMultiplier; // Centered X
      const worldY = (0.5 - wrist.y) * 150; // Centered Y, inverted
      const worldZ = (wrist.z || 0) * 50 - 25; // Depth, scaled

      handMesh.position.set(worldX, worldY, worldZ);
      handMesh.visible = true;

      // Pulse hand mesh if audio is playing for that hand (conceptual)
      if ((xMultiplier === -1 && appState.audio.leftHandIsPlaying) || (xMultiplier === 1 && appState.audio.rightHandIsPlaying)) {
        const pulseScale = 1 + Math.sin(Date.now() * 0.01) * 0.3;
        handMesh.scale.set(pulseScale, pulseScale, pulseScale);
      } else {
        handMesh.scale.set(1, 1, 1);
      }

    } else {
      handMesh.visible = false;
    }
  }

  // Call this if the main canvas resizes
  onWindowResize( /* newWidth, newHeight */ ) {
    // The particle positions are in world space, so they don't directly depend on canvas size
    // unless the camera's FOV or aspect ratio changes significantly, affecting their perceived spread.
    // No specific action needed here for this particle system type unless camera changes.
  }
}
