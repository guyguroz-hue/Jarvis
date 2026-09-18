import { useEffect, useRef } from 'react'
import { LM, toScreenSpace } from '../../lib/handUtils'

/**
 * Live XYZ + pinch readout.
 *
 * Writes numbers straight into DOM nodes via refs inside a rAF loop. Rendering
 * these through React state would re-render the tree ~60x/second for the sake of
 * a few digits — the exact cost the tracking architecture exists to avoid.
 */
export default function TrackingPanel({ handsRef, telemetry, mirrored, active }) {
  const xRef = useRef(null)
  const yRef = useRef(null)
  const zRef = useRef(null)
  const pinchRef = useRef(null)
  const barRef = useRef(null)
  const handRef = useRef(null)

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
          pinchRef.current.textContent = '--'
          handRef.current.textContent = 'NONE'
          barRef.current.style.width = '0%'
        }
        return
      }

      const p = toScreenSpace(hand.landmarks[LM.INDEX_TIP], mirrored)
      xRef.current.textContent = p.x.toFixed(3)
      yRef.current.textContent = p.y.toFixed(3)
      zRef.current.textContent = p.z.toFixed(3)
      pinchRef.current.textContent = `${Math.round(hand.pinch * 100)}%`
      handRef.current.textContent = hand.isPinching ? 'PINCH' : 'OPEN'
      handRef.current.className = hand.isPinching
        ? 'font-display text-[10px] text-jarvis-amber'
        : 'font-display text-[10px] text-jarvis-ok'
      barRef.current.style.width = `${Math.round(hand.pinch * 100)}%`
    }

    raf = requestAnimationFrame(update)
    return () => cancelAnimationFrame(raf)
  }, [handsRef, mirrored, active])

  return (
    <div className="glass-panel hud-corners p-3">
      <div className="flex items-center justify-between">
        <p className="label">Telemetry</p>
        <span ref={handRef} className="font-display text-[10px] text-jarvis-ice/40">
          NONE
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          ['X', xRef],
          ['Y', yRef],
          ['Z', zRef],
        ].map(([axis, ref]) => (
          <div key={axis}>
            <p className="label !text-[9px]">{axis}</p>
            <p ref={ref} className="font-mono text-[11px] tabular-nums text-jarvis-cyan">
              --.--
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between">
          <span className="label !text-[9px]">Pinch</span>
          <span ref={pinchRef} className="font-mono text-[10px] text-jarvis-ice/70">
            --
          </span>
        </div>
        <div className="mt-1 h-1 w-full overflow-hidden rounded bg-jarvis-cyan/15">
          <div ref={barRef} className="h-full bg-jarvis-cyan transition-none" style={{ width: 0 }} />
        </div>
      </div>

      <div className="mt-3 flex justify-between border-t border-jarvis-cyan/20 pt-2">
        <span className="label !text-[9px]">
          Hands <span className="text-jarvis-cyan">{telemetry.handCount}</span>
        </span>
        <span className="label !text-[9px]">
          {telemetry.fps} FPS
          {telemetry.delegate ? ` · ${telemetry.delegate}` : ''}
        </span>
      </div>
    </div>
  )
}
