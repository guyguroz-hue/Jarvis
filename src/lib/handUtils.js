// Landmark helpers shared by the 2D skeleton overlay and the 3D scene.
// Keeping these in one place means the mirroring fix lives in exactly one
// function — the single most common source of "the cube moves the wrong way".

/** MediaPipe hand landmark indices (21 points per hand). */
export const LM = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
}

/** Bone pairs for drawing the skeleton. */
export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],          // thumb
  [0, 5], [5, 6], [6, 7], [7, 8],          // index
  [5, 9], [9, 10], [10, 11], [11, 12],     // middle
  [9, 13], [13, 14], [14, 15], [15, 16],   // ring
  [13, 17], [17, 18], [18, 19], [19, 20],  // pinky
  [0, 17],                                  // palm base
]

export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v))

/** Inverse lerp, clamped to 0..1. */
export const invLerp = (a, b, v) => clamp((v - a) / (b - a))

export function dist2(a, b) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

export function dist3(a, b) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = (a.z ?? 0) - (b.z ?? 0)
  return Math.hypot(dx, dy, dz)
}

/**
 * Convert a normalized landmark into screen space (0..1, origin top-left).
 *
 * MediaPipe always reports coordinates in the RAW video frame. When the feed is
 * displayed mirrored (as a selfie view must be), X has to be flipped here or
 * every downstream consumer will be horizontally inverted.
 */
export function toScreenSpace(landmark, mirrored = true) {
  return {
    x: mirrored ? 1 - landmark.x : landmark.x,
    y: landmark.y,
    z: landmark.z ?? 0,
  }
}

/**
 * Apparent palm size (wrist -> middle finger knuckle).
 * Used to normalize distances so gestures behave the same near and far
 * from the camera.
 */
export function handScale(landmarks) {
  return dist2(landmarks[LM.WRIST], landmarks[LM.MIDDLE_MCP]) || 1e-6
}

/**
 * Pinch strength from 2D screen landmarks. 0 (open) -> 1 (touching).
 *
 * FALLBACK ONLY — prefer pinchStrength3D.
 *
 * This measures a PROJECTED distance, so it is not rotation-invariant: turning
 * the hand toward profile foreshortens the palm, inflating the ratio and making
 * a closed pinch read as open. Kept for the rare frame where MediaPipe returns
 * no world landmarks.
 */
export function pinchStrength(landmarks, { closed = 0.28, open = 0.85 } = {}) {
  const raw = dist2(landmarks[LM.THUMB_TIP], landmarks[LM.INDEX_TIP])
  const ratio = raw / handScale(landmarks)
  return 1 - invLerp(closed, open, ratio)
}

/**
 * Pinch strength from METRIC 3D world landmarks. 0 (open) -> 1 (touching).
 *
 * MediaPipe's worldLandmarks are real coordinates in metres, origin at the hand's
 * geometric centre — a true 3D reconstruction rather than a camera projection.
 * Distances measured here therefore do NOT change when the hand rotates, which
 * is exactly the failure mode of the 2D version above.
 *
 * Still normalized by the hand's own span so it works for any hand size.
 */
export function pinchStrength3D(world, { closed = 0.34, open = 1.0 } = {}) {
  const span = dist3(world[LM.WRIST], world[LM.MIDDLE_MCP]) || 1e-6
  const gap = dist3(world[LM.THUMB_TIP], world[LM.INDEX_TIP])
  return 1 - invLerp(closed, open, gap / span)
}

/**
 * Schmitt trigger for pinch state.
 *
 * A single threshold chatters when the signal sits near it. Requiring a higher
 * value to ENTER the pinch than to LEAVE it gives a dead band, so a steady
 * pinch stays latched.
 */
export function pinchLatch(strength, wasPinching, { enter = 0.62, exit = 0.42 } = {}) {
  return wasPinching ? strength > exit : strength > enter
}

/** Midpoint between thumb and index tips — the natural "grab point". */
export function pinchPoint(landmarks) {
  const t = landmarks[LM.THUMB_TIP]
  const i = landmarks[LM.INDEX_TIP]
  return { x: (t.x + i.x) / 2, y: (t.y + i.y) / 2, z: ((t.z ?? 0) + (i.z ?? 0)) / 2 }
}

/** Average of the palm landmarks — steadier than the wrist alone. */
export function palmCenter(landmarks) {
  const ids = [LM.WRIST, LM.INDEX_MCP, LM.MIDDLE_MCP, LM.RING_MCP, LM.PINKY_MCP]
  let x = 0, y = 0, z = 0
  for (const id of ids) {
    x += landmarks[id].x
    y += landmarks[id].y
    z += landmarks[id].z ?? 0
  }
  return { x: x / ids.length, y: y / ids.length, z: z / ids.length }
}

/**
 * Exponential smoothing for jittery landmark values.
 * factor 0 = frozen, 1 = no smoothing.
 */
export function smooth(prev, next, factor = 0.35) {
  if (prev == null) return next
  return prev + (next - prev) * factor
}
