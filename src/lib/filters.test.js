import test from 'node:test'
import assert from 'node:assert/strict'
import { OneEuroFilter } from './filters.js'

// Deterministic noise — a seeded LCG, so this test can never flake.
function noise(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296 - 0.5
  }
}

test('attenuates jitter on a stationary signal', () => {
  const f = new OneEuroFilter({ minCutoff: 1.0, beta: 0.02 })
  const rand = noise(42)
  let t = 0
  let inErr = 0
  let outErr = 0
  let n = 0

  for (let i = 0; i < 300; i++) {
    t += 1 / 60
    const noisy = 100 + rand() * 10 // +/-5 units around 100
    const out = f.filter(noisy, t)
    if (i > 60) {
      // Skip warm-up, then compare input vs output deviation.
      inErr += Math.abs(noisy - 100)
      outErr += Math.abs(out - 100)
      n++
    }
  }

  const ratio = outErr / inErr
  assert.ok(ratio < 0.4, `filter should cut deviation by >60%, only got ${(1 - ratio) * 100}%`)
})

test('keeps up with fast movement instead of lagging behind', () => {
  const f = new OneEuroFilter({ minCutoff: 1.0, beta: 0.7 })
  let t = 0
  let out = 0
  // A steady ramp — a sluggish filter would trail far behind the input.
  for (let i = 0; i < 120; i++) {
    t += 1 / 60
    out = f.filter(i * 10, t)
  }
  const target = 119 * 10
  assert.ok(Math.abs(out - target) < target * 0.05, `tracked to ${out}, expected near ${target}`)
})

test('survives a zero or negative timestep', () => {
  const f = new OneEuroFilter()
  f.filter(10, 1)
  const same = f.filter(12, 1) // dt === 0
  const back = f.filter(14, 0.5) // clock went backwards
  assert.ok(Number.isFinite(same) && Number.isFinite(back))
})

test('ignores non-finite input rather than poisoning its state', () => {
  const f = new OneEuroFilter()
  f.filter(5, 0.1)
  const out = f.filter(NaN, 0.2)
  assert.ok(Number.isFinite(out))
  assert.ok(Number.isFinite(f.filter(6, 0.3)))
})
