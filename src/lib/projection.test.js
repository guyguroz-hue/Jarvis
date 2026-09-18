import test from 'node:test'
import assert from 'node:assert/strict'
import { frustumSizeAt, projectLandmark, screenToWorld } from './projection.js'

const close = (got, want, tol = 1e-6) =>
  assert.ok(Math.abs(got - want) <= tol, `expected ${want}, got ${got}`)

// A portrait phone (390x844) displaying a landscape 1280x720 stream.
const PORTRAIT = [1280, 720, 390, 844]

test('centre of the frame maps to centre of the screen', () => {
  const p = projectLandmark({ x: 0.5, y: 0.5 }, ...PORTRAIT, false)
  close(p.x, 0.5)
  close(p.y, 0.5)
})

test('object-cover crop pushes the frame edges off-screen', () => {
  const p = projectLandmark({ x: 0, y: 0.5 }, ...PORTRAIT, false)
  assert.ok(p.x < 0, 'left edge of the video should be cropped out of view')
})

test('the visible band maps exactly to 0..1', () => {
  const scale = Math.max(390 / 1280, 844 / 720)
  const visible = 390 / (1280 * scale)
  close(projectLandmark({ x: 0.5 - visible / 2, y: 0.5 }, ...PORTRAIT, false).x, 0, 1e-9)
  close(projectLandmark({ x: 0.5 + visible / 2, y: 0.5 }, ...PORTRAIT, false).x, 1, 1e-9)
})

test('mirroring is symmetric about the centre', () => {
  const m = projectLandmark({ x: 0.3, y: 0.5 }, ...PORTRAIT, true)
  const u = projectLandmark({ x: 0.7, y: 0.5 }, ...PORTRAIT, false)
  close(m.x, u.x)
})

test('missing video metadata passes through instead of producing NaN', () => {
  const p = projectLandmark({ x: 0.4, y: 0.6 }, 0, 0, 390, 844, false)
  close(p.x, 0.4)
  close(p.y, 0.6)
  assert.ok(Number.isFinite(p.x))
})

test('a square feed on a square viewport is identity', () => {
  const p = projectLandmark({ x: 0.25, y: 0.75 }, 500, 500, 300, 300, false)
  close(p.x, 0.25)
  close(p.y, 0.75)
})

const CAM = { fov: 50, aspect: 390 / 844 }

test('frustum height follows the pinhole relation', () => {
  const { height } = frustumSizeAt(CAM, 5)
  close(height, 2 * Math.tan((50 * Math.PI) / 360) * 5)
})

test('screen centre maps to the world origin', () => {
  const w = screenToWorld(0.5, 0.5, CAM, 5)
  close(w.x, 0)
  close(w.y, 0)
})

test('screen edges map to the frustum bounds, with Y flipped', () => {
  const { width, height } = frustumSizeAt(CAM, 5)
  close(screenToWorld(1, 0.5, CAM, 5).x, width / 2)
  // Screen Y grows downward, world Y upward: the TOP of the screen is +Y.
  close(screenToWorld(0.5, 0, CAM, 5).y, height / 2)
})
