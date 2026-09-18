import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import CameraFeed from './components/ar/CameraFeed'
import HandOverlay from './components/ar/HandOverlay'
import AssistantPanel from './components/hud/AssistantPanel'
import BootPanel from './components/hud/BootPanel'
import HudFrame from './components/hud/HudFrame'
import Reticle from './components/hud/Reticle'
import StatusBoard from './components/hud/StatusBoard'
import SystemLog from './components/hud/SystemLog'
import TrackingPanel from './components/hud/TrackingPanel'
import VitalsPanel from './components/hud/VitalsPanel'
import { useCamera } from './hooks/useCamera'
import { useDeviceTelemetry } from './hooks/useDeviceTelemetry'
import { useAssistant } from './hooks/useAssistant'
import { useHandTracking } from './hooks/useHandTracking'
import { useSystemLog } from './hooks/useSystemLog'
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
 *   z-10 <Canvas>  React Three Fiber scene — Phase 3 ✅
 *   z-14 frame / z-15 reticle              — Phase 4 ✅
 *   z-20 <div>     Tailwind HUD overlay    — Phase 4 ✅
 */
export default function App() {
  const [booted, setBooted] = useState(false)
  const [gesture, setGesture] = useState('idle')
  const [clock, setClock] = useState(() => new Date())

  // On a phone the HUD can swallow the whole screen. 'min' strips it back to
  // the header and footer for an unobstructed AR view.
  const [density, setDensity] = useState('full')
  const [logExpanded, setLogExpanded] = useState(false)
  const [lang, setLang] = useState('he-IL')

  const camera = useCamera({ facingMode: 'user' })
  const live = camera.status === 'live'
  const tracking = useHandTracking(camera.videoRef, { enabled: live })
  const vitals = useDeviceTelemetry()
  const { entries, log } = useSystemLog()
  const assistant = useAssistant({ lang, log })

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const handleBooted = useCallback(() => setBooted(true), [])

  // ---- wire real system events into the log ----
  useEffect(() => {
    if (booted) log('ok', 'Core systems nominal. Awaiting optics.')
  }, [booted, log])

  useEffect(() => {
    if (camera.status === 'live') log('ok', `Optics live · ${camera.facing} camera`)
    if (camera.status === 'requesting') log('sys', 'Requesting optical access…')
    if (camera.status === 'error') log('err', camera.error ?? 'Optics failure')
  }, [camera.status, camera.facing, camera.error, log])

  useEffect(() => {
    if (tracking.status === 'loading') log('sys', 'Loading hand-tracking model…')
    if (tracking.status === 'tracking') log('ok', 'Hand tracking online')
    if (tracking.status === 'error') log('err', tracking.error ?? 'Tracker failure')
  }, [tracking.status, tracking.error, log])

  const prevGesture = useRef('idle')
  useEffect(() => {
    if (gesture === prevGesture.current) return
    prevGesture.current = gesture
    if (gesture === 'grab') log('sys', 'Core acquired')
    if (gesture === 'scale') log('sys', 'Two-hand scaling engaged')
    if (gesture === 'hold') log('warn', 'Tracking lost — holding grab')
  }, [gesture, log])

  const statusOverrides = {
    camera: live ? 'online' : camera.status === 'error' ? 'offline' : 'standby',
    spatial: live ? 'online' : 'standby',
    hud: live ? 'online' : 'standby',
    hands:
      tracking.status === 'tracking'
        ? 'online'
        : tracking.status === 'error'
          ? 'offline'
          : 'standby',
    voice: assistant.armed ? 'online' : 'standby',
    neural: assistant.status === 'error' ? 'offline' : assistant.query ? 'online' : 'standby',
  }

  const showPanels = live && density === 'full'

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

      {/* z-10 — spatial scene */}
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

      {/* z-14 / z-15 — HUD chrome */}
      {live && <HudFrame />}
      {live && <Reticle handsRef={tracking.handsRef} active={tracking.status === 'tracking'} />}

      {/* Ambient grid, only before the feed starts */}
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

        {!booted ? (
          <section className="flex flex-1 items-center justify-center px-4 pb-4">
            <BootPanel onComplete={handleBooted} />
          </section>
        ) : !live ? (
          <section className="flex flex-1 items-center justify-center overflow-y-auto px-4 pb-4">
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
          </section>
        ) : (
          /* ---- live AR: panels hug the edges, centre stays clear ---- */
          <section className="flex flex-1 flex-col justify-between px-4 py-2">
            <div className="flex justify-end">
              {showPanels && (
                <div className="pointer-events-auto w-44 sm:w-52">
                  <TrackingPanel
                    handsRef={tracking.handsRef}
                    videoRef={camera.videoRef}
                    telemetry={tracking.telemetry}
                    mirrored={camera.isMirrored}
                    active={tracking.status === 'tracking'}
                  />
                  {tracking.status === 'loading' && (
                    <p className="mt-2 animate-pulse-glow text-center text-[10px] text-jarvis-amber">
                      Loading model…
                    </p>
                  )}
                </div>
              )}
            </div>

            {showPanels && (
              <div className="pointer-events-auto space-y-2">
                <AssistantPanel
                  assistant={assistant}
                  lang={lang}
                  onToggleLang={() => setLang((l) => (l.startsWith('he') ? 'en-US' : 'he-IL'))}
                />
                <VitalsPanel vitals={vitals} />
                <SystemLog
                  entries={entries}
                  expanded={logExpanded}
                  onToggle={() => setLogExpanded((v) => !v)}
                />
              </div>
            )}
          </section>
        )}

        <footer className="flex items-center justify-between border-t border-jarvis-cyan/20 px-4 py-3 sm:px-6">
          <p className="label">
            Optics:{' '}
            <span className={live ? 'text-jarvis-ok' : 'text-jarvis-amber'}>
              {live ? `Live · ${camera.facing === 'user' ? 'Front' : 'Rear'}` : camera.status}
            </span>
          </p>

          <div className="flex items-center gap-2">
            {live && assistant.armed && (
              <span className="font-display text-[9px] uppercase tracking-widest text-jarvis-ok">
                {assistant.speaking ? 'TX' : assistant.listening ? 'RX' : '···'}
              </span>
            )}
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
                onClick={() => setDensity((d) => (d === 'full' ? 'min' : 'full'))}
                className="pointer-events-auto rounded border border-jarvis-cyan/40 px-2 py-1 font-display text-[9px] uppercase tracking-widest text-jarvis-cyan active:bg-jarvis-cyan/20"
              >
                {density === 'full' ? 'Min' : 'Full'}
              </button>
            )}
            {live && camera.torch.supported && (
              <button
                onClick={camera.toggleTorch}
                className={`pointer-events-auto rounded border px-2 py-1 font-display text-[9px] uppercase tracking-widest active:bg-jarvis-amber/20 ${
                  camera.torch.on
                    ? 'border-jarvis-amber text-jarvis-amber'
                    : 'border-jarvis-cyan/40 text-jarvis-cyan'
                }`}
              >
                Light
              </button>
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
