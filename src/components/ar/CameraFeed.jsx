import { forwardRef } from 'react'

/**
 * Fullscreen webcam layer (z-0) — the base of the AR stack.
 *
 * `playsInline` is mandatory: without it iOS Safari hijacks the video into a
 * native fullscreen player and the HUD disappears behind it.
 */
const CameraFeed = forwardRef(function CameraFeed({ mirrored = true, dim = 0.25 }, ref) {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-black">
      <video
        ref={ref}
        playsInline
        muted
        autoPlay
        className="h-full w-full object-cover"
        style={{ transform: mirrored ? 'scaleX(-1)' : 'none' }}
      />
      {/* Darkening wash so the cyan HUD keeps contrast over a bright room. */}
      <div
        className="pointer-events-none absolute inset-0 bg-jarvis-void"
        style={{ opacity: dim }}
      />
      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 45%, rgba(4,10,16,0.85) 100%)',
        }}
      />
    </div>
  )
})

export default CameraFeed
