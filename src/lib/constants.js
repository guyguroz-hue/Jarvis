// Central config. Later phases read from here instead of hardcoding values.

export const SYSTEM = {
  name: 'J.A.R.V.I.S.',
  subtitle: 'Just A Rather Very Intelligent System',
  version: '0.1.0',
  build: 'PHASE-01',
}

// Boot lines. Each entry is [label, delayMs] — the delay is the pause BEFORE the line appears.
export const BOOT_SEQUENCE = [
  ['CORE RUNTIME .............. ONLINE', 180],
  ['RENDER PIPELINE ........... ONLINE', 260],
  ['STYLE ENGINE .............. ONLINE', 220],
  ['AR CAMERA LAYER ........... STANDBY', 300],
  ['HAND TRACKING / MEDIAPIPE . STANDBY', 260],
  ['SPATIAL ENGINE / R3F ...... STANDBY', 240],
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

export const STATUS_COLORS = {
  online: 'text-jarvis-ok',
  standby: 'text-jarvis-amber',
  offline: 'text-jarvis-alert',
}
