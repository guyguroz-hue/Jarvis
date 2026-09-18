import { useEffect, useRef } from 'react'
import { LOG_LEVELS } from '../../hooks/useSystemLog'

/**
 * Scrolling system log.
 *
 * Every entry carries a textual level tag (SYS / OK / WRN / ERR / AI), not just
 * a colour — the status hues are close together under red-green colour blindness,
 * so the tag is what actually conveys severity.
 */
export default function SystemLog({ entries, expanded, onToggle }) {
  const scroller = useRef(null)

  // Pin to the newest line as entries arrive.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries])

  const recent = expanded ? entries : entries.slice(-3)

  return (
    <div className="glass-panel hud-corners p-3">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between"
        aria-expanded={expanded}
      >
        <span className="label">System Log</span>
        <span className="label !text-[9px]">
          {entries.length} · {expanded ? 'collapse' : 'expand'}
        </span>
      </button>

      <div
        ref={scroller}
        className={`mt-2 space-y-0.5 overflow-y-auto ${expanded ? 'max-h-40' : 'max-h-14'}`}
      >
        {recent.length === 0 && (
          <p className="text-[10px] text-jarvis-ice/30">Awaiting system events…</p>
        )}

        {recent.map((e) => {
          const level = LOG_LEVELS[e.level] ?? LOG_LEVELS.sys
          return (
            <p key={e.id} className="flex gap-1.5 text-[10px] leading-relaxed">
              <span className="shrink-0 tabular-nums text-jarvis-ice/30">
                {e.at.toLocaleTimeString([], { hour12: false })}
              </span>
              <span className={`shrink-0 font-display ${level.color}`}>{level.tag}</span>
              <span className="min-w-0 break-words text-jarvis-ice/80">{e.text}</span>
            </p>
          )
        })}
      </div>
    </div>
  )
}
