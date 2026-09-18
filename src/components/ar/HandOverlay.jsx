import { useEffect, useRef } from 'react'
import { HAND_CONNECTIONS, LM } from '../../lib/handUtils'
import { projectLandmark } from '../../lib/projection'

/**
 * Draws the hand skeleton onto a 2D canvas (z-5), beneath the 3D scene.
 *
 * Reads handsRef directly inside its own rAF loop rather than taking landmarks
 * as props — props would force a React re-render every frame, which is exactly
 * what the tracking hook's ref-based design avoids.
 */
export default function HandOverlay({ handsRef, videoRef, mirrored = true, active = false }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!active) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf

    const resize = () => {
      // Cap DPR at 2 — beyond that the fill cost outweighs the sharpness gain.
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      raf = requestAnimationFrame(draw)

      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)

      const { hands } = handsRef.current
      if (!hands.length) return

      // Compensate for object-cover cropping, or the skeleton drifts off the
      // real hand the further it moves from centre.
      const video = videoRef?.current
      const vw = video?.videoWidth ?? 0
      const vh = video?.videoHeight ?? 0

      for (const hand of hands) {
        const pts = hand.landmarks.map((l) => {
          const s = projectLandmark(l, vw, vh, w, h, mirrored)
          return { x: s.x * w, y: s.y * h }
        })

        const accent = hand.isPinching ? '#fbbf24' : '#22d3ee'

        // Bones
        ctx.strokeStyle = accent
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.shadowColor = accent
        ctx.shadowBlur = 8
        ctx.beginPath()
        for (const [a, b] of HAND_CONNECTIONS) {
          ctx.moveTo(pts[a].x, pts[a].y)
          ctx.lineTo(pts[b].x, pts[b].y)
        }
        ctx.stroke()

        // Joints
        ctx.fillStyle = accent
        for (const p of pts) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
          ctx.fill()
        }

        // Pinch indicator: a line between the two tips that tightens as you close.
        const thumb = pts[LM.THUMB_TIP]
        const index = pts[LM.INDEX_TIP]
        ctx.strokeStyle = hand.isPinching ? '#fbbf24' : 'rgba(125,211,252,0.5)'
        ctx.lineWidth = 1 + hand.pinch * 3
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(thumb.x, thumb.y)
        ctx.lineTo(index.x, index.y)
        ctx.stroke()
        ctx.setLineDash([])

        // Targeting reticle on the grab point
        const cx = (thumb.x + index.x) / 2
        const cy = (thumb.y + index.y) / 2
        ctx.strokeStyle = accent
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(cx, cy, 10 + hand.pinch * 10, 0, Math.PI * 2)
        ctx.stroke()
        ctx.shadowBlur = 0
      }
    }

    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [handsRef, videoRef, mirrored, active])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[5] h-full w-full"
    />
  )
}
