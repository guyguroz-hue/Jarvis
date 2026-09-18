import { SUBSYSTEMS, STATUS_COLORS } from '../../lib/constants'

/**
 * Subsystem readout.
 *
 * `overrides` lets the app report LIVE state (e.g. camera actually streaming)
 * rather than the static per-phase defaults: <StatusBoard overrides={{ camera: 'online' }} />
 */
export default function StatusBoard({ overrides = {} }) {
  return (
    <div className="glass-panel hud-corners w-full max-w-md p-5">
      <p className="label">Subsystems</p>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
        {SUBSYSTEMS.map((sys) => {
          const status = overrides[sys.id] ?? sys.status
          return (
          <div key={sys.id} className="flex items-center justify-between gap-2">
            <span className="truncate text-[11px] text-jarvis-ice/80">{sys.label}</span>
            <span
              className={`shrink-0 font-display text-[9px] uppercase tracking-wider ${
                STATUS_COLORS[status]
              }`}
            >
              {status}
            </span>
          </div>
          )
        })}
      </div>

      <p className="mt-4 border-t border-jarvis-cyan/20 pt-3 text-[10px] text-jarvis-ice/40">
        Subsystems activate as each build phase is deployed.
      </p>
    </div>
  )
}
