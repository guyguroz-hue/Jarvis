// Central config. Later phases read from here instead of hardcoding values.

export const SYSTEM = {
  name: 'J.A.R.V.I.S.',
  subtitle: 'Just A Rather Very Intelligent System',
  version: '0.1.0',
  build: 'PHASE-04',
}

// Boot lines. Each entry is [label, delayMs] — the delay is the pause BEFORE the line appears.
export const BOOT_SEQUENCE = [
  ['CORE RUNTIME .............. ONLINE', 180],
  ['RENDER PIPELINE ........... ONLINE', 260],
  ['STYLE ENGINE .............. ONLINE', 220],
  ['AR CAMERA LAYER ........... ONLINE', 300],
  ['HAND TRACKING / MEDIAPIPE . ONLINE', 260],
  ['SPATIAL ENGINE / R3F ...... ONLINE', 240],
  ['VOICE INTERFACE ........... STANDBY', 220],
  ['NEURAL LINK / SILICONFLOW . STANDBY', 280],
]

// Subsystem status board. Flipped to 'online' as each phase lands.
export const SUBSYSTEMS = [
  { id: 'core', label: 'Core', status: 'online', phase: 1 },
  { id: 'camera', label: 'AR Camera', status: 'standby', phase: 2 },
  { id: 'hands', label: 'Hand Track', status: 'standby', phase: 2 },
  { id: 'spatial', label: 'Spatial 3D', status: 'standby', phase: 3 },
  { id: 'hud', label: 'Telemetry', status: 'standby', phase: 4 },
  { id: 'voice', label: 'Voice I/O', status: 'standby', phase: 5 },
  { id: 'neural', label: 'Neural Link', status: 'standby', phase: 5 },
]

// MediaPipe runtime + model are fetched from a CDN so no binary asset has to be
// committed to the repo — which matters when the project is edited from a phone.
export const MEDIAPIPE = {
  wasmPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm',
  modelPath:
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  maxHands: 2, // drop to 1 if an older phone struggles

  // Deliberately permissive. The defaults (0.5) make MediaPipe drop a hand the
  // moment part of it leaves the frame; lower values let it hold on through
  // partial occlusion and edge-of-frame cropping.
  detectionConfidence: 0.3,
  presenceConfidence: 0.3,
  trackingConfidence: 0.3,

  // Schmitt trigger bounds — see pinchLatch(). Entering needs a firmer pinch
  // than holding one, which stops the state chattering at the boundary.
  pinchEnter: 0.62,
  pinchExit: 0.4,

  /**
   * How long a PINCHING hand survives a tracking dropout, in ms.
   *
   * MediaPipe loses the hand when it is partly out of frame. Without this, a
   * grab dies the instant the wrist clips the edge of the screen. During the
   * grace window the last known hand is republished with stale:true so the
   * grab persists and the interaction stays continuous.
   */
  trackingGraceMs: 500,

  telemetryHz: 10, // how often summary data reaches React state
}

// 3D interaction tuning. All distances are in world units; the core sits on a
// plane CORE_DEPTH units in front of the camera.
export const INTERACTION = {
  cameraDistance: 5, // camera z
  grabRadius: 0.7, // how close a pinch must be to latch onto the core
  followLerp: 0.4, // raised: the One Euro filter now does the heavy smoothing
  // One Euro tuning for the grabbed position.
  filter: { minCutoff: 1.6, beta: 0.06 },
  releaseLerp: 0.04, // drift back to home once released
  scaleLerp: 0.15,
  minScale: 0.45,
  maxScale: 2.6,
  idleSpin: 0.25, // radians/sec
  grabSpin: 1.1,
}

export const STATUS_COLORS = {
  online: 'text-jarvis-ok',
  standby: 'text-jarvis-amber',
  offline: 'text-jarvis-alert',
}
