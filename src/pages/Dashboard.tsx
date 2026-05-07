import type { Application } from '@/types'
import { StatCard } from '@/components/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ActivityChart,
  BacklogChart,
  FunnelChart,
  SourceBreakdown,
  UserBreakdown,
  WeekdayHeatmap,
} from '@/components/charts'
import {
  appliedTodayCount,
  computeStreak,
  pendingCount,
  totalApplied,
} from '@/lib/stats'

export function Dashboard({ apps }: { apps: Application[] }) {
  const streak = computeStreak(apps)
  const today = appliedTodayCount(apps)
  const applied = totalApplied(apps)
  const backlog = pendingCount(apps)

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Track your application activity and conversion.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Streak"
          value={streak}
          subtitle={streak === 1 ? 'day in a row' : 'days in a row'}
        />
        <StatCard label="Applied today" value={today} />
        <StatCard label="Total applied" value={applied} />
        <StatCard label="Pending backlog" value={backlog} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Last 30 days</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityChart apps={apps} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <FunnelChart apps={apps} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Backlog burn-down (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <BacklogChart apps={apps} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Weekday heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            <WeekdayHeatmap apps={apps} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By source</CardTitle>
          </CardHeader>
          <CardContent>
            <SourceBreakdown apps={apps} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Contributors</CardTitle>
          </CardHeader>
          <CardContent>
            <UserBreakdown apps={apps} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
