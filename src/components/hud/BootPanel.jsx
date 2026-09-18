import { useEffect, useRef, useState } from 'react'
import { BOOT_SEQUENCE } from '../../lib/constants'

/**
 * Types out the boot log one line at a time, then signals completion.
 * Uses a chain of timeouts (not an interval) so each line can have its own delay.
 */
export default function BootPanel({ onComplete }) {
  const [lines, setLines] = useState([])
  const timers = useRef([])

  useEffect(() => {
    let elapsed = 0

    BOOT_SEQUENCE.forEach(([text, delay], i) => {
      elapsed += delay
      timers.current.push(
        setTimeout(() => {
          setLines((prev) => [...prev, text])
          if (i === BOOT_SEQUENCE.length - 1) {
            timers.current.push(setTimeout(() => onComplete?.(), 400))
          }
        }, elapsed)
      )
    })

    // Clear every pending timer if the component unmounts mid-sequence.
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [onComplete])

  return (
    <div className="glass-panel hud-corners w-full max-w-md p-5">
      <div className="flex items-center justify-between">
        <p className="label">Boot Sequence</p>
        <span className="h-2 w-2 animate-pulse-glow rounded-full bg-jarvis-cyan" />
      </div>

      <div className="mt-4 space-y-1.5">
        {lines.map((line, i) => {
          const online = line.includes('ONLINE')
          return (
            <p
              key={i}
              className={`text-[11px] leading-relaxed ${
                online ? 'text-jarvis-ok' : 'text-jarvis-amber'
              }`}
            >
              <span className="text-jarvis-cyan/40">&gt;</span> {line}
            </p>
          )
        })}

        {lines.length < BOOT_SEQUENCE.length && (
          <p className="text-[11px] text-jarvis-cyan/50">
            <span className="text-jarvis-cyan/40">&gt;</span>
            <span className="ml-1 inline-block h-3 w-2 animate-pulse-glow bg-jarvis-cyan align-middle" />
          </p>
        )}
      </div>
    </div>
  )
}
