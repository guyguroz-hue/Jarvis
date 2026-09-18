import { useEffect, useState } from 'react'

/**
 * Real device vitals for the HUD — battery, link type, memory, uptime.
 *
 * Everything here changes slowly, so plain state is fine; none of it is on the
 * per-frame path. Unsupported APIs simply report null and the HUD hides the row
 * rather than inventing a number.
 */
export function useDeviceTelemetry() {
  const [vitals, setVitals] = useState({
    battery: null, // 0..1
    charging: false,
    link: null, // '4g' | 'wifi' | ...
    memory: null, // GB
    cores: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? null : null,
    uptime: 0, // seconds since mount
  })

  // Uptime ticker.
  useEffect(() => {
    const started = Date.now()
    const id = setInterval(
      () => setVitals((v) => ({ ...v, uptime: Math.floor((Date.now() - started) / 1000) })),
      1000
    )
    return () => clearInterval(id)
  }, [])

  // Battery — Chrome/Android only; Safari does not implement it.
  useEffect(() => {
    let battery
    let cancelled = false

    const sync = () =>
      !cancelled &&
      setVitals((v) => ({ ...v, battery: battery.level, charging: battery.charging }))

    navigator.getBattery?.().then((b) => {
      if (cancelled) return
      battery = b
      sync()
      b.addEventListener('levelchange', sync)
      b.addEventListener('chargingchange', sync)
    })

    return () => {
      cancelled = true
      battery?.removeEventListener('levelchange', sync)
      battery?.removeEventListener('chargingchange', sync)
    }
  }, [])

  // Network + memory.
  useEffect(() => {
    const conn = navigator.connection
    const sync = () =>
      setVitals((v) => ({
        ...v,
        link: conn?.effectiveType ?? null,
        memory: navigator.deviceMemory ?? null,
      }))
    sync()
    conn?.addEventListener('change', sync)
    return () => conn?.removeEventListener('change', sync)
  }, [])

  return vitals
}

/** Seconds -> mm:ss (or h:mm:ss past an hour). */
export function formatUptime(s) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}
