import test from 'node:test'
import assert from 'node:assert/strict'
import { LM, pinchLatch, pinchStrength, pinchStrength3D } from './handUtils.js'

/** A hand with thumb and index touching, in metres. */
function pinchedHand() {
  const pts = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }))
  pts[LM.WRIST] = { x: 0, y: 0, z: 0 }
  pts[LM.MIDDLE_MCP] = { x: 0, y: 0.09, z: 0 }
  pts[LM.THUMB_TIP] = { x: 0.012, y: 0.1, z: 0 }
  pts[LM.INDEX_TIP] = { x: 0.022, y: 0.104, z: 0 }
  return pts
}

/** Tilt the hand about X — the motion that foreshortens the palm on camera. */
function rotateX(pts, deg) {
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return pts.map((p) => ({ x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c }))
}

test('3D pinch is rotation-invariant', () => {
  const base = pinchedHand()
  const readings = [0, 15, 30, 45, 60, 75, 85].map((d) => pinchStrength3D(rotateX(base, d)))

  for (const r of readings) {
    assert.ok(r > 0.95, `expected a firm pinch at every angle, got ${r}`)
  }
  const spread = Math.max(...readings) - Math.min(...readings)
  assert.ok(spread < 1e-9, `3D reading drifted by ${spread} under rotation`)
})

test('2D pinch degrades under rotation — the bug this replaces', () => {
  const base = pinchedHand()
  const flat = pinchStrength(rotateX(base, 0))
  const tilted = pinchStrength(rotateX(base, 85))

  assert.ok(flat > 0.95, `flat hand should read pinched, got ${flat}`)
  // Same physical gesture, read as fully open once projected at a steep angle.
  assert.ok(tilted < 0.1, `expected projected reading to collapse, got ${tilted}`)
})

test('an open hand is not reported as a pinch', () => {
  const pts = pinchedHand()
  pts[LM.THUMB_TIP] = { x: -0.04, y: 0.06, z: 0 }
  pts[LM.INDEX_TIP] = { x: 0.03, y: 0.12, z: 0 }
  assert.ok(pinchStrength3D(pts) < 0.05)
})

test('pinch latch needs a firmer grip to engage than to hold', () => {
  const o = { enter: 0.62, exit: 0.4 }
  assert.equal(pinchLatch(0.5, false, o), false, 'mid value must not start a pinch')
  assert.equal(pinchLatch(0.5, true, o), true, 'same value must sustain one')
  assert.equal(pinchLatch(0.7, false, o), true)
  assert.equal(pinchLatch(0.3, true, o), false)
})

test('latch suppresses the chatter a single threshold produces', () => {
  const o = { enter: 0.62, exit: 0.4 }
  // A held pinch whose strength wobbles across the old 0.6 threshold.
  const signal = Array.from({ length: 200 }, (_, i) => 0.6 + Math.sin(i) * 0.05)

  let latched = false
  let latchFlips = 0
  let naive = false
  let naiveFlips = 0

  for (const v of signal) {
    const nextLatched = pinchLatch(v, latched, o)
    if (nextLatched !== latched) latchFlips++
    latched = nextLatched

    const nextNaive = v > 0.6 // the previous single-threshold behaviour
    if (nextNaive !== naive) naiveFlips++
    naive = nextNaive
  }

  assert.ok(naiveFlips > 20, `single threshold should chatter, saw ${naiveFlips} flips`)
  assert.ok(latchFlips <= 1, `latch should settle once, saw ${latchFlips} flips`)
  assert.equal(latched, true, 'the pinch should remain engaged')
})
