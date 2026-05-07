import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { Application, Status } from '@/types'
import { STATUSES, STATUS_LABELS } from '@/types'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { ApplicationRow } from '@/components/ApplicationRow'
import { cn } from '@/lib/utils'

export function Applications({ apps, loading }: { apps: Application[]; loading: boolean }) {
  const [search, setSearch] = useState('')
  const [activeStatuses, setActiveStatuses] = useState<Set<Status>>(new Set())
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set())
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())

  const allSources = useMemo(() => {
    const s = new Set<string>()
    for (const a of apps) if (a.source.trim()) s.add(a.source.trim())
    return Array.from(s).sort()
  }, [apps])

  const allTags = useMemo(() => {
    const s = new Set<string>()
    for (const a of apps) for (const t of a.tags) s.add(t)
    return Array.from(s).sort()
  }, [apps])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return apps.filter(a => {
      if (activeStatuses.size && !activeStatuses.has(a.status)) return false
      if (activeSources.size && !activeSources.has(a.source.trim())) return false
      if (activeTags.size && !a.tags.some(t => activeTags.has(t))) return false
      if (q) {
        const hay = [a.company, a.role, a.url, a.notes, a.location].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [apps, search, activeStatuses, activeSources, activeTags])

  function toggle<T>(set: Set<T>, value: T, setter: (v: Set<T>) => void) {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setter(next)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
          <span className="text-sm text-[var(--color-muted-foreground)]">
            {filtered.length}/{apps.length}
          </span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by company, role, url, notes…"
            className="pl-8"
          />
        </div>
        <FilterChips
          label="Status"
          options={STATUSES}
          getLabel={s => STATUS_LABELS[s]}
          active={activeStatuses}
          onToggle={v => toggle(activeStatuses, v, setActiveStatuses)}
        />
        {allSources.length > 0 && (
          <FilterChips
            label="Source"
            options={allSources}
            getLabel={s => s}
            active={activeSources}
            onToggle={v => toggle(activeSources, v, setActiveSources)}
          />
        )}
        {allTags.length > 0 && (
          <FilterChips
            label="Tags"
            options={allTags}
            getLabel={s => s}
            active={activeTags}
            onToggle={v => toggle(activeTags, v, setActiveTags)}
          />
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-sm text-[var(--color-muted-foreground)]">
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-[var(--color-muted-foreground)]">
              {apps.length === 0
                ? 'No applications yet. Head to Add Links to paste some URLs.'
                : 'No matches for your filters.'}
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map(app => (
                <ApplicationRow key={app.id} app={app} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function FilterChips<T>({
  label,
  options,
  getLabel,
  active,
  onToggle,
}: {
  label: string
  options: T[]
  getLabel: (v: T) => string
  active: Set<T>
  onToggle: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {label}
      </span>
      {options.map(o => {
        const isActive = active.has(o)
        return (
          <button
            key={String(o)}
            onClick={() => onToggle(o)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
              isActive
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                : 'hover:bg-[var(--color-accent)]',
            )}
          >
            {getLabel(o)}
          </button>
        )
      })}
    </div>
  )
}
