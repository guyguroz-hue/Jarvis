import { useCallback, useRef, useState } from 'react'

const MAX_ENTRIES = 60

/**
 * Append-only system log with a bounded ring buffer.
 *
 * Levels carry a text TAG as well as a colour. That is deliberate: the status
 * hues (green/amber/red) sit close together under protanopia, so colour alone
 * must never be the only thing distinguishing one state from another.
 */
export function useSystemLog() {
  const [entries, setEntries] = useState([])
  const seq = useRef(0)

  const log = useCallback((level, text) => {
    const entry = {
      id: ++seq.current,
      level,
      text,
      at: new Date(),
    }
    setEntries((prev) => {
      const next = [...prev, entry]
      return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next
    })
    return entry
  }, [])

  const clear = useCallback(() => setEntries([]), [])

  return { entries, log, clear }
}

/** Visual + textual treatment per level. The tag is the accessible signal. */
export const LOG_LEVELS = {
  sys: { tag: 'SYS', color: 'text-jarvis-cyan' },
  ok: { tag: 'OK ', color: 'text-jarvis-ok' },
  warn: { tag: 'WRN', color: 'text-jarvis-amber' },
  err: { tag: 'ERR', color: 'text-jarvis-alert' },
  ai: { tag: 'AI ', color: 'text-jarvis-ice' },
  user: { tag: 'YOU', color: 'text-white' },
}
