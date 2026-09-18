import { useCallback, useEffect, useState } from 'react'
import BootPanel from './components/hud/BootPanel'
import StatusBoard from './components/hud/StatusBoard'
import { SYSTEM } from './lib/constants'

/**
 * Root shell.
 *
 * Layering model used by every later phase (back to front):
 *   z-0  video   — AR camera feed          (Phase 2)
 *   z-10 canvas  — React Three Fiber scene (Phase 3)
 *   z-20 hud     — Tailwind overlay panels (Phase 4)
 */
export default function App() {
  const [booted, setBooted] = useState(false)
  const [clock, setClock] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Memoised so BootPanel's effect doesn't re-run on every clock tick.
  const handleBooted = useCallback(() => setBooted(true), [])

  return (
    <main className="relative h-full w-full overflow-hidden bg-jarvis-void">
      {/* --- Ambient background: radial glow + grid + scanlines --- */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 40%, rgba(34,211,238,0.14), transparent 65%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(34,211,238,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />
      <div className="scanlines pointer-events-none absolute inset-0 z-0 opacity-40" />

      {/* --- HUD layer --- */}
      <div className="relative z-20 flex h-full w-full flex-col">
        {/* Top bar */}
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

        {/* Center stage */}
        <section className="flex flex-1 items-center justify-center overflow-y-auto px-4 pb-4">
          <div className="flex w-full max-w-md flex-col items-center gap-4">
            <BootPanel onComplete={handleBooted} />

            {booted && (
              <>
                <StatusBoard />
                <p className="text-center text-[11px] leading-relaxed text-jarvis-ice/50">
                  Phase 1 complete — toolchain verified.
                  <br />
                  Awaiting Phase 2: AR camera + hand tracking.
                </p>
              </>
            )}
          </div>
        </section>

        {/* Bottom bar */}
        <footer className="flex items-center justify-between border-t border-jarvis-cyan/20 px-4 py-3 sm:px-6">
          <p className="label">
            Status:{' '}
            <span className={booted ? 'text-jarvis-ok' : 'text-jarvis-amber'}>
              {booted ? 'Nominal' : 'Initialising'}
            </span>
          </p>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-jarvis-ok" />
            <p className="label">Link Active</p>
          </div>
        </footer>
      </div>
    </main>
  )
}
