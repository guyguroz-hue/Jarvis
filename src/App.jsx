import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import CameraFeed from './components/ar/CameraFeed'
import HandOverlay from './components/ar/HandOverlay'
import BootPanel from './components/hud/BootPanel'
import StatusBoard from './components/hud/StatusBoard'
import TrackingPanel from './components/hud/TrackingPanel'
import { useCamera } from './hooks/useCamera'
import { useHandTracking } from './hooks/useHandTracking'
import { SYSTEM } from './lib/constants'

/**
 * Three.js is ~800KB. Lazy-loading keeps it out of the initial page load, so
 * the HUD boots instantly and the 3D engine is fetched only when the camera
 * goes live and the scene actually mounts.
 */
const Scene = lazy(() => import('./components/three/Scene'))

/**
 * Root shell.
 *
 * Layer stack (back to front):
 *   z-0  <video>   AR camera feed          — Phase 2 ✅
 *   z-5  <canvas>  hand skeleton overlay   — Phase 2 ✅
 *   z-10 <Canvas>  React Three Fiber scene — Phase 3
 *   z-20 <div>     Tailwind HUD overlay    — Phase 4
 */
export default function App() {
  const [booted, setBooted] = useState(false)
  const [gesture, setGesture] = useState('idle')
  const [clock, setClock] = useState(() => new Date())

  const camera = useCamera({ facingMode: 'user' })
  const live = camera.status === 'live'

  const tracking = useHandTracking(camera.videoRef, { enabled: live })

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const handleBooted = useCallback(() => setBooted(true), [])

  const statusOverrides = {
    camera: live ? 'online' : camera.status === 'error' ? 'offline' : 'standby',
    spatial: live ? 'online' : 'standby',
    hands:
      tracking.status === 'tracking'
        ? 'online'
        : tracking.status === 'error'
          ? 'offline'
          : 'standby',
  }

  return (
    <main className="relative h-full w-full overflow-hidden bg-jarvis-void">
      {/* z-0 — camera */}
      <CameraFeed ref={camera.videoRef} mirrored={camera.isMirrored} />

      {/* z-5 — hand skeleton */}
      <HandOverlay
        handsRef={tracking.handsRef}
        videoRef={camera.videoRef}
        mirrored={camera.isMirrored}
        active={tracking.status === 'tracking'}
      />

      {/* z-10 — spatial scene. Mounted only once the feed is live so the
          WebGL context isn't created while the user is still at the gate. */}
      {live && (
        <Suspense fallback={null}>
          <Scene
            handsRef={tracking.handsRef}
            videoRef={camera.videoRef}
            mirrored={camera.isMirrored}
            onGesture={setGesture}
          />
        </Suspense>
      )}

      {/* Ambient grid + scanlines, only while the camera is off */}
      {!live && (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{
              background:
                'radial-gradient(ellipse at 50% 40%, rgba(34,211,238,0.14), transparent 65%)',
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 z-[1] opacity-[0.18]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(34,211,238,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.5) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
              maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
            }}
          />
        </>
      )}
      <div className="scanlines pointer-events-none absolute inset-0 z-[6] opacity-30" />

      {/* z-20 — HUD */}
      <div className="pointer-events-none relative z-20 flex h-full w-full flex-col">
        <header className="flex items-start justify-between p-4 sm:p-6">
          <div>
            <h1 className="animate-flicker font-display text-lg font-extrabold tracking-[0.3em] text-jarvis-cyan text-glow sm:text-2xl">
              {SYSTEM.name}
            </h1>
            <p className="mt-1 hidden text-[10px] tracking-wide text-jarvis-ice/50 sm:block">
              {SYSTEM.subtitle}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-sm tabular-nums text-jarvis-cyan sm:text-base">
              {clock.toLocaleTimeString([], { hour12: false })}
            </p>
            <p className="label mt-1">
              v{SYSTEM.version} · {SYSTEM.build}
            </p>
          </div>
        </header>

        <section className="flex flex-1 items-center justify-center overflow-y-auto px-4 pb-4">
          {!booted ? (
            <BootPanel onComplete={handleBooted} />
          ) : !live ? (
            <div className="pointer-events-auto flex w-full max-w-md flex-col items-center gap-4">
              <StatusBoard overrides={statusOverrides} />

              {camera.error && (
                <div className="glass-panel w-full p-3 !border-jarvis-alert/50">
                  <p className="label !text-jarvis-alert">Optics Fault</p>
                  <p className="mt-1 text-[11px] text-jarvis-alert/90">{camera.error}</p>
                </div>
              )}

              <button
                onClick={() => camera.start()}
                disabled={camera.status === 'requesting'}
                className="w-full rounded border border-jarvis-cyan/50 bg-jarvis-cyan/10 py-3 font-display text-xs uppercase tracking-[0.25em] text-jarvis-cyan active:bg-jarvis-cyan/25 disabled:opacity-50"
              >
                {camera.status === 'requesting' ? 'Requesting…' : 'Initialise Optics'}
              </button>

              <p className="text-center text-[10px] leading-relaxed text-jarvis-ice/40">
                Camera access requires HTTPS and a direct tap.
              </p>
            </div>
          ) : (
            /* Live AR: compact side panel, screen stays clear */
            <div className="pointer-events-auto ml-auto w-44 self-start sm:w-52">
              <TrackingPanel
                handsRef={tracking.handsRef}
                videoRef={camera.videoRef}
                telemetry={tracking.telemetry}
                mirrored={camera.isMirrored}
                active={tracking.status === 'tracking'}
              />

              {tracking.status === 'loading' && (
                <p className="mt-2 animate-pulse-glow text-center text-[10px] text-jarvis-amber">
                  Loading neural model…
                </p>
              )}
              {tracking.status === 'error' && (
                <p className="mt-2 text-center text-[10px] text-jarvis-alert">{tracking.error}</p>
              )}
            </div>
          )}
        </section>

        <footer className="flex items-center justify-between border-t border-jarvis-cyan/20 px-4 py-3 sm:px-6">
          <p className="label">
            Optics:{' '}
            <span className={live ? 'text-jarvis-ok' : 'text-jarvis-amber'}>
              {live ? `Live · ${camera.facing === 'user' ? 'Front' : 'Rear'}` : camera.status}
            </span>
          </p>

          <div className="flex items-center gap-3">
            {live && (
              <span
                className={`font-display text-[9px] uppercase tracking-widest ${
                  gesture === 'idle' ? 'text-jarvis-ice/40' : 'text-jarvis-amber'
                }`}
              >
                {gesture}
              </span>
            )}
            {live && (
              <button
                onClick={camera.flip}
                className="pointer-events-auto rounded border border-jarvis-cyan/40 px-2 py-1 font-display text-[9px] uppercase tracking-widest text-jarvis-cyan active:bg-jarvis-cyan/20"
              >
                Flip
              </button>
            )}
            <span
              className={`h-1.5 w-1.5 animate-pulse-glow rounded-full ${
                live ? 'bg-jarvis-ok' : 'bg-jarvis-amber'
              }`}
            />
          </div>
        </footer>
      </div>
    </main>
  )
}
