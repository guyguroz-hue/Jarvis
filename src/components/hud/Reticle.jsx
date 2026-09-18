import { useEffect, useRef } from 'react'

/**
 * Centre targeting reticle. Fades out once a hand is being tracked, so it
 * reads as "searching" rather than permanent chrome.
 *
 * Opacity is written straight to the node from a rAF loop — driving it through
 * React state would re-render the tree every frame.
 */
export default function Reticle({ handsRef, active }) {
  const root = useRef(null)

  useEffect(() => {
    if (!active) return
    let raf
    let shown = 1

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const target = handsRef.current.hands.length ? 0.12 : 0.55
      shown += (target - shown) * 0.08
      if (root.current) root.current.style.opacity = shown.toFixed(3)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [handsRef, active])

  return (
    <div
      ref={root}
      className="pointer-events-none absolute left-1/2 top-1/2 z-[15] -translate-x-1/2 -translate-y-1/2"
      style={{ opacity: 0.55 }}
    >
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="46" stroke="#22d3ee" strokeWidth="1" strokeOpacity="0.5" />
        <circle
          cx="60"
          cy="60"
          r="54"
          stroke="#22d3ee"
          strokeWidth="1"
          strokeOpacity="0.35"
          strokeDasharray="6 10"
          className="origin-center animate-sweep"
        />
        {/* Crosshair ticks */}
        <path d="M60 6v14M60 100v14M6 60h14M100 60h14" stroke="#22d3ee" strokeWidth="1.5" />
        <circle cx="60" cy="60" r="2" fill="#22d3ee" />
      </svg>
    </div>
  )
}
