import { formatUptime } from '../../hooks/useDeviceTelemetry'

/**
 * Device vitals as stat tiles.
 *
 * These are single headline values, so they get a number and a label — a gauge
 * would add decoration without adding information. Unsupported readings are
 * omitted rather than faked.
 */
export default function VitalsPanel({ vitals }) {
  const tiles = [
    { key: 'up', label: 'Uptime', value: formatUptime(vitals.uptime) },
    vitals.battery !== null && {
      key: 'pwr',
      label: 'Power',
      value: `${Math.round(vitals.battery * 100)}%`,
      note: vitals.charging ? 'CHG' : null,
    },
    vitals.link && { key: 'net', label: 'Link', value: vitals.link.toUpperCase() },
    vitals.cores && { key: 'cpu', label: 'Cores', value: String(vitals.cores) },
    vitals.memory && { key: 'mem', label: 'Memory', value: `${vitals.memory}G` },
  ].filter(Boolean)

  return (
    <div className="glass-panel hud-corners p-3">
      <p className="label">Vitals</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        {tiles.map((t) => (
          <div key={t.key} className="min-w-[52px]">
            <p className="label !text-[8px]">{t.label}</p>
            <p className="font-display text-xs tabular-nums text-jarvis-ice">
              {t.value}
              {t.note && <span className="ml-1 text-[8px] text-jarvis-ok">{t.note}</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
