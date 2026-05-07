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
}

export function ActivityChart({ apps }: { apps: Application[] }) {
  const data = dailyCounts(apps, 30)
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--color-accent)', opacity: 0.3 }} />
        <Bar dataKey="count" fill="oklch(0.6 0.2 260)" radius={[4, 4, 0, 0]} />
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
        <YAxis dataKey="stage" type="category" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={80} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--color-accent)', opacity: 0.3 }} />
        <Bar dataKey="count" fill="oklch(0.7 0.16 160)" radius={[0, 4, 4, 0]} />
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
        <Line type="monotone" dataKey="backlog" stroke="oklch(0.7 0.18 50)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function WeekdayHeatmap({ apps }: { apps: Application[] }) {
  const data = weekdayHeatmap(apps)
  const max = Math.max(1, ...data.map(d => d.count))
  return (
    <div className="grid grid-cols-7 gap-2">
      {data.map(d => {
        const intensity = d.count / max
        const bg = `oklch(0.65 ${0.15 * intensity} 250 / ${0.2 + 0.8 * intensity})`
        return (
          <div key={d.day} className="flex flex-col items-center gap-1.5">
            <div
              className="flex h-16 w-full items-center justify-center rounded-md border text-sm font-medium"
              style={{ background: bg }}
              title={`${d.day}: ${d.count}`}
            >
              {d.count || ''}
            </div>
            <div className="text-xs text-[var(--color-muted-foreground)]">{d.day}</div>
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
        <YAxis dataKey="source" type="category" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={100} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--color-accent)', opacity: 0.3 }} />
        <Bar dataKey="total" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={`oklch(0.7 0.15 ${(i * 47) % 360})`} />
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
          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
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
