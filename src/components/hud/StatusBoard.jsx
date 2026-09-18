import { SUBSYSTEMS, STATUS_COLORS } from '../../lib/constants'

/** Subsystem readout. Each row flips to ONLINE as its phase is built. */
export default function StatusBoard() {
  return (
    <div className="glass-panel hud-corners w-full max-w-md p-5">
      <p className="label">Subsystems</p>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
        {SUBSYSTEMS.map((sys) => (
          <div key={sys.id} className="flex items-center justify-between gap-2">
            <span className="truncate text-[11px] text-jarvis-ice/80">{sys.label}</span>
            <span
              className={`shrink-0 font-display text-[9px] uppercase tracking-wider ${
                STATUS_COLORS[sys.status]
              }`}
            >
              {sys.status}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-4 border-t border-jarvis-cyan/20 pt-3 text-[10px] text-jarvis-ice/40">
        Subsystems activate as each build phase is deployed.
      </p>
    </div>
  )
}
