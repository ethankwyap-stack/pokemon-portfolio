// Dependency-free SVG line chart of portfolio value over time.

import type { HistoryPoint } from '../types'
import { usd } from '../lib/format'

const W = 800
const H = 180
const PAD = { top: 14, right: 16, bottom: 24, left: 56 }

export default function ValueChart({ history }: { history: HistoryPoint[] }) {
  if (history.length < 2) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-sm font-medium text-ink">Value over time</p>
        <p className="mt-2 text-sm text-muted">
          {history.length === 0
            ? 'No snapshots yet — a value point is recorded automatically each day you open the app.'
            : 'One snapshot recorded. Come back tomorrow (or after prices move) to see a trend line.'}
        </p>
      </div>
    )
  }

  const values = history.map((h) => h.totalValue)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const x = (i: number) => PAD.left + (i / (history.length - 1)) * innerW
  const y = (v: number) => PAD.top + innerH - ((v - min) / span) * innerH

  const points = history.map((h, i) => `${x(i)},${y(h.totalValue)}`).join(' ')
  const last = history[history.length - 1]
  const first = history[0]

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-ink">Value over time</p>
        <p className="text-xs text-muted">
          {first.date} → {last.date}
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="Portfolio value chart">
        {/* min/max gridlines + labels */}
        {[max, min].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="#263242"
              strokeDasharray="4 4"
            />
            <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#8b98a9">
              {usd(v)}
            </text>
          </g>
        ))}
        <polyline
          points={points}
          fill="none"
          stroke="#00e0a4"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {history.map((h, i) => (
          <circle key={h.date} cx={x(i)} cy={y(h.totalValue)} r="3.5" fill="#00e0a4">
            <title>{`${h.date}: ${usd(h.totalValue)}`}</title>
          </circle>
        ))}
        <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize="11" fill="#8b98a9">
          {last.date}
        </text>
        <text x={PAD.left} y={H - 6} fontSize="11" fill="#8b98a9">
          {first.date}
        </text>
      </svg>
    </div>
  )
}
