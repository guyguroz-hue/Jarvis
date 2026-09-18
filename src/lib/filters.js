/**
 * One Euro filter — adaptive smoothing for noisy interactive signals.
 *
 * A fixed lerp forces an unwinnable tradeoff: smooth enough to kill jitter
 * means laggy when the hand moves fast; responsive enough to feel direct means
 * shaky when the hand is still.
 *
 * One Euro solves this by varying its cutoff with the signal's own speed:
 * slow movement gets aggressive smoothing (jitter dies), fast movement gets a
 * high cutoff (lag stays low).
 *
 * Reference: Casiez, Roussel & Vogel, "1e Filter" (CHI 2012).
 */

/** Smoothing factor for a given cutoff frequency and timestep. */
function alphaFor(cutoff, dt) {
  const tau = 1 / (2 * Math.PI * cutoff)
  return 1 / (1 + tau / dt)
}

class LowPass {
  constructor() {
    this.value = null
  }
  filter(x, alpha) {
    this.value = this.value === null ? x : alpha * x + (1 - alpha) * this.value
    return this.value
  }
  reset() {
    this.value = null
  }
}

export class OneEuroFilter {
  /**
   * @param minCutoff lower = smoother when still (more lag at rest)
   * @param beta      higher = more responsive when moving fast
   */
  constructor({ minCutoff = 1.4, beta = 0.05, dCutoff = 1.0 } = {}) {
    this.minCutoff = minCutoff
    this.beta = beta
    this.dCutoff = dCutoff
    this.x = new LowPass()
    this.dx = new LowPass()
    this.lastValue = null
    this.lastTime = null
  }

  /** @param t timestamp in SECONDS */
  filter(value, t) {
    if (!Number.isFinite(value)) return this.x.value ?? 0

    let dt = this.lastTime === null ? 1 / 60 : t - this.lastTime
    // Guard against zero/negative/huge steps (paused tab, clock jumps).
    if (!(dt > 0) || dt > 0.5) dt = 1 / 60
    this.lastTime = t

    const rate = this.lastValue === null ? 0 : (value - this.lastValue) / dt
    this.lastValue = value

    const edx = this.dx.filter(rate, alphaFor(this.dCutoff, dt))
    const cutoff = this.minCutoff + this.beta * Math.abs(edx)
    return this.x.filter(value, alphaFor(cutoff, dt))
  }

  reset() {
    this.x.reset()
    this.dx.reset()
    this.lastValue = null
    this.lastTime = null
  }
}

/** Three independent One Euro filters, for a 3D point. */
export class Vec3Filter {
  constructor(opts) {
    this.fx = new OneEuroFilter(opts)
    this.fy = new OneEuroFilter(opts)
    this.fz = new OneEuroFilter(opts)
  }
  filter(v, t, out = {}) {
    out.x = this.fx.filter(v.x, t)
    out.y = this.fy.filter(v.y, t)
    out.z = this.fz.filter(v.z, t)
    return out
  }
  reset() {
    this.fx.reset()
    this.fy.reset()
    this.fz.reset()
  }
}
