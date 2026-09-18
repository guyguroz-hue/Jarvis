import { useMemo } from 'react'

/**
 * Minimal time-series trace for a single measure.
 *
 * One series, so no legend — the caption names it. Only the latest value is
 * labelled rather than every point, and the baseline stays recessive.
 */
export default function Sparkline({
  data = [],
  width = 120,
  height = 26,
  tone = '#22d3ee',
  max,
}) {
  const { points, latest } = useMemo(() => {
    if (data.length < 2) return { points: '', latest: data[data.length - 1] ?? 0 }

    const ceiling = max ?? Math.max(...data, 1)
    const step = width / (data.length - 1)

    const pts = data
      .map((v, i) => {
        const y = height - (Math.min(v, ceiling) / ceiling) * (height - 2) - 1
        return `${(i * step).toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')

    return { points: pts, latest: data[data.length - 1] }
  }, [data, width, height, max])

  return (
    <div className="flex items-center gap-2">
      <svg width={width} height={height} className="overflow-visible">
        <line
          x1="0"
          y1={height - 1}
          x2={width}
          y2={height - 1}
          stroke="currentColor"
          strokeWidth="1"
          className="text-jarvis-cyan/15"
        />
        {points && (
          <polyline
            points={points}
            fill="none"
            stroke={tone}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
      </svg>
      <span className="font-mono text-[10px] tabular-nums text-jarvis-ice/70">{latest}</span>
    </div>
  )
}
