import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'

/**
 * Bounded 0..1 arc meter.
 *
 * Exposes an imperative setValue() instead of taking a value prop, so a caller
 * can drive it from a rAF loop at 60fps without re-rendering React.
 */
const RadialGauge = forwardRef(function RadialGauge(
  { size = 58, stroke = 4, label = '', tone = '#22d3ee' },
  ref
) {
  const arc = useRef(null)
  const readout = useRef(null)

  const r = (size - stroke) / 2
  const circumference = useMemo(() => 2 * Math.PI * r, [r])

  useImperativeHandle(
    ref,
    () => ({
      setValue(v, text) {
        const clamped = Math.min(1, Math.max(0, v || 0))
        if (arc.current) {
          arc.current.style.strokeDashoffset = String(circumference * (1 - clamped))
        }
        if (readout.current) {
          readout.current.textContent = text ?? `${Math.round(clamped * 100)}`
        }
      },
    }),
    [circumference]
  )

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track — recessive, never competes with the value */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-jarvis-cyan/15"
        />
        {/* Value */}
        <circle
          ref={arc}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span ref={readout} className="font-display text-xs tabular-nums text-jarvis-ice">
          0
        </span>
        {label && <span className="label !text-[8px] !tracking-normal">{label}</span>}
      </div>
    </div>
  )
})

export default RadialGauge
