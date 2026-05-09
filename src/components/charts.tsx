import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Application } from '@/types'
import {
  backlogBurndown,
  bySource,
  byUser,
  dailyCounts,
  funnelCounts,
  weekdayHeatmap,
} from '@/lib/stats'

const tooltipStyle = {
  background: 'var(--color-popover)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--color-popover-foreground)',
  boxShadow: '0 8px 24px -8px oklch(0 0 0 / 0.4)',
}

const CHART_PALETTE = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]

export function ActivityChart({ apps }: { apps: Application[] }) {
  const data = dailyCounts(apps, 30)
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.95} />
            <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--color-primary)', opacity: 0.08 }} />
        <Bar dataKey="count" fill="url(#activityFill)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function FunnelChart({ apps }: { apps: Application[] }) {
  const data = funnelCounts(apps)
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
        <XAxis type="number" allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={11} />
        <YAxis dataKey="stage" type="category" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={56} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--color-primary)', opacity: 0.08 }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function BacklogChart({ apps }: { apps: Application[] }) {
  const data = backlogBurndown(apps, 30)
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line
          type="monotone"
          dataKey="backlog"
          stroke="var(--color-chart-5)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, fill: 'var(--color-chart-5)', stroke: 'var(--color-background)', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function WeekdayHeatmap({ apps }: { apps: Application[] }) {
  const data = weekdayHeatmap(apps)
  const max = Math.max(1, ...data.map(d => d.count))
  return (
    <div className="grid grid-cols-7 gap-1 sm:gap-2">
      {data.map(d => {
        const intensity = d.count / max
        const isPeak = d.count > 0 && d.count === max
        return (
          <div key={d.day} className="flex flex-col items-center gap-1 sm:gap-1.5">
            <div
              className={
                'flex h-12 w-full items-center justify-center rounded-md border border-[var(--color-border)] text-xs font-semibold tabular-nums transition-colors sm:h-16 sm:text-sm ' +
                (isPeak ? 'ring-1 ring-inset ring-[var(--color-primary)]/40' : '')
              }
              style={{
                background: `color-mix(in oklch, var(--color-chart-1) ${Math.round(15 + 75 * intensity)}%, transparent)`,
                color: intensity > 0.5 ? 'oklch(0.99 0.005 265)' : 'var(--color-foreground)',
              }}
              title={`${d.day}: ${d.count}`}
            >
              {d.count || ''}
            </div>
            <div className="text-[10px] text-[var(--color-muted-foreground)] sm:text-xs">{d.day}</div>
          </div>
        )
      })}
    </div>
  )
}

export function SourceBreakdown({ apps }: { apps: Application[] }) {
  const data = bySource(apps).slice(0, 8)
  if (data.length === 0) {
    return <div className="text-sm text-[var(--color-muted-foreground)]">No data yet.</div>
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 32)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <XAxis type="number" allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={11} />
        <YAxis dataKey="source" type="category" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={72} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--color-primary)', opacity: 0.08 }} />
        <Bar dataKey="total" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function UserBreakdown({ apps }: { apps: Application[] }) {
  const data = byUser(apps)
  if (data.length === 0) {
    return <div className="text-sm text-[var(--color-muted-foreground)]">No contributions yet.</div>
  }
  return (
    <ul className="space-y-2">
      {data.map(u => (
        <li
          key={u.name}
          className="flex items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-background)]/40 px-3 py-2 text-sm transition-colors hover:border-[var(--color-primary)]/30"
        >
          <span className="font-medium">{u.name}</span>
          <span className="text-[var(--color-muted-foreground)]">
            {u.added} added · {u.applied} applied
          </span>
        </li>
      ))}
    </ul>
  )
}
