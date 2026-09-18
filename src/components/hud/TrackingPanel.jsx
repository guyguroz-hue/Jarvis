import { useEffect, useRef, useState } from 'react'
import { LM } from '../../lib/handUtils'
import { projectLandmark } from '../../lib/projection'
import RadialGauge from './RadialGauge'
import Sparkline from './Sparkline'

const HISTORY = 24

/**
 * Live hand telemetry: XYZ, pinch meter, and an FPS trace.
 *
 * Per-frame values are written straight into DOM nodes and the gauge's
 * imperative handle from a single rAF loop. Rendering them through React state
 * would re-render the tree ~60x/second to move a few digits.
 */
export default function TrackingPanel({ handsRef, videoRef, telemetry, mirrored, active }) {
  const xRef = useRef(null)
  const yRef = useRef(null)
  const zRef = useRef(null)
  const stateRef = useRef(null)
  const gauge = useRef(null)

  // FPS history. telemetry.fps updates once a second, so state is fine here.
  const [fpsHistory, setFpsHistory] = useState([])
  useEffect(() => {
    if (!telemetry.fps) return
    setFpsHistory((h) => [...h, telemetry.fps].slice(-HISTORY))
  }, [telemetry.fps])

  useEffect(() => {
    if (!active) return
    let raf

    const update = () => {
      raf = requestAnimationFrame(update)
      const hand = handsRef.current.hands[0]

      if (!hand) {
        if (xRef.current) {
          xRef.current.textContent = '--.--'
          yRef.current.textContent = '--.--'
          zRef.current.textContent = '--.--'
          stateRef.current.textContent = 'NONE'
          stateRef.current.className = 'font-display text-[10px] text-jarvis-ice/40'
          gauge.current?.setValue(0)
        }
        return
      }

      const video = videoRef?.current
      const p = projectLandmark(
        hand.landmarks[LM.INDEX_TIP],
        video?.videoWidth ?? 0,
        video?.videoHeight ?? 0,
        window.innerWidth,
        window.innerHeight,
        mirrored
      )

      xRef.current.textContent = p.x.toFixed(3)
      yRef.current.textContent = p.y.toFixed(3)
      zRef.current.textContent = p.z.toFixed(3)

      // Text state, not colour alone — the status hues are hard to separate
      // under red-green colour blindness.
      const label = hand.stale ? 'HOLD' : hand.isPinching ? 'PINCH' : 'OPEN'
      const tone = hand.stale
        ? 'text-jarvis-alert'
        : hand.isPinching
          ? 'text-jarvis-amber'
          : 'text-jarvis-ok'
      stateRef.current.textContent = label
      stateRef.current.className = `font-display text-[10px] ${tone}`

      gauge.current?.setValue(hand.pinch)
    }

    raf = requestAnimationFrame(update)
    return () => cancelAnimationFrame(raf)
  }, [handsRef, videoRef, mirrored, active])

  return (
    <div className="glass-panel hud-corners p-3">
      <div className="flex items-center justify-between">
        <p className="label">Telemetry</p>
        <span ref={stateRef} className="font-display text-[10px] text-jarvis-ice/40">
          NONE
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <RadialGauge ref={gauge} label="pinch" />

        <div className="min-w-0 flex-1 space-y-1">
          {[
            ['X', xRef],
            ['Y', yRef],
            ['Z', zRef],
          ].map(([axis, ref]) => (
            <div key={axis} className="flex items-baseline justify-between gap-2">
              <span className="label !text-[9px]">{axis}</span>
              <span ref={ref} className="font-mono text-[11px] tabular-nums text-jarvis-cyan">
                --.--
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 border-t border-jarvis-cyan/20 pt-2">
        <div className="flex items-center justify-between">
          {/* Kept terse: this panel is ~176px wide on a phone and longer
              labels wrap onto a second line. */}
          <span className="label !text-[9px]">FPS</span>
          <span className="label !text-[9px] whitespace-nowrap">
            {telemetry.handCount}H{telemetry.delegate ? ` · ${telemetry.delegate}` : ''}
          </span>
        </div>
        <div className="mt-1">
          <Sparkline data={fpsHistory} width={112} height={24} />
        </div>
      </div>
    </div>
  )
}
