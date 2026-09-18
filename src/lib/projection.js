/**
 * Coordinate projection: MediaPipe landmark space -> screen -> 3D world.
 *
 * WHY THIS FILE EXISTS
 *
 * MediaPipe reports landmarks normalized to the RAW video frame (0..1 of a
 * 1280x720 image, say). The <video> element is rendered with `object-cover`,
 * which scales the feed to FILL the viewport and crops the overflow. On a
 * portrait phone showing a landscape camera, that crop is severe.
 *
 * Mapping a landmark straight to screen space therefore misplaces it — the
 * further from centre, the worse the drift. Every consumer must go through
 * projectLandmark() so the crop is compensated in exactly one place.
 */

/**
 * Map a landmark to normalized SCREEN space (0..1 of the viewport),
 * compensating for object-cover cropping.
 *
 * Results may fall outside 0..1 — that is correct, and means the point is in
 * a region of the video that the crop pushed off-screen.
 *
 * Mirroring is applied in video space first. The cover crop is centred and
 * therefore symmetric, so flipping before or after is equivalent.
 */
export function projectLandmark(lm, videoW, videoH, viewW, viewH, mirrored = true) {
  const nx = mirrored ? 1 - lm.x : lm.x
  const ny = lm.y

  // Degenerate sizes (video metadata not ready) — pass through unscaled.
  if (!videoW || !videoH || !viewW || !viewH) {
    return { x: nx, y: ny, z: lm.z ?? 0 }
  }

  // object-cover: scale so the video covers both axes, then centre it.
  const scale = Math.max(viewW / videoW, viewH / videoH)
  const drawW = videoW * scale
  const drawH = videoH * scale
  const offsetX = (viewW - drawW) / 2
  const offsetY = (viewH - drawH) / 2

  return {
    x: (offsetX + nx * drawW) / viewW,
    y: (offsetY + ny * drawH) / viewH,
    z: lm.z ?? 0,
  }
}

/**
 * Visible extent of a perspective camera's frustum at a given distance.
 * Standard pinhole relation: height = 2 * d * tan(fov/2).
 */
export function frustumSizeAt(camera, distance) {
  const vFov = (camera.fov * Math.PI) / 180
  const height = 2 * Math.tan(vFov / 2) * distance
  return { width: height * camera.aspect, height }
}

/**
 * Normalized screen coords (0..1, origin top-left) -> world XY on a plane
 * `distance` units in front of the camera.
 *
 * Y is negated: screen Y grows downward, world Y grows upward.
 */
export function screenToWorld(sx, sy, camera, distance) {
  const { width, height } = frustumSizeAt(camera, distance)
  return {
    x: (sx - 0.5) * width,
    y: -(sy - 0.5) * height,
  }
}

/**
 * Apparent palm width in screen space -> a depth estimate.
 *
 * Deliberately NOT using the landmark's own z: MediaPipe's z is noisy relative
 * depth and jitters badly. Palm size is a far steadier proxy — a bigger palm
 * means the hand is closer.
 */
export function depthFromHandScale(scale, { near = 0.42, far = 0.12, min = -1.2, max = 1.6 } = {}) {
  const t = (scale - far) / (near - far)
  const clamped = Math.min(1, Math.max(0, t))
  return min + (max - min) * clamped
}
