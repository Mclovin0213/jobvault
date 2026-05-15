import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { restAdapter } from '@/storage/rest/adapter'
import type { NewApplication } from '@/storage/adapter'
import type { Application } from '@/types'

const POLL_MS = 5000

export interface UseApplications {
  apps: Application[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  mutate: (updater: (prev: Application[]) => Application[]) => void
  create: (input: NewApplication) => Promise<Application | null>
  update: (id: string, patch: Partial<Application>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export function useApplications(): UseApplications {
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const refetch = useCallback(async () => {
    try {
      const list = await restAdapter.listApplications()
      if (!mountedRef.current) return
      setApps(list)
      setError(null)
    } catch (e) {
      if (!mountedRef.current) return
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    let timer: ReturnType<typeof setInterval> | null = null
    let initial: ReturnType<typeof setTimeout> | null = null
    const tick = () => {
      void refetch()
    }
    const start = () => {
      if (timer) return
      timer = setInterval(tick, POLL_MS)
    }
    const stop = () => {
      if (!timer) return
      clearInterval(timer)
      timer = null
    }
    const onVis = () => {
      if (document.hidden) stop()
      else {
        tick()
        start()
      }
    }
    initial = setTimeout(tick, 0)
    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      mountedRef.current = false
      if (initial) clearTimeout(initial)
      stop()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [refetch])

  const mutate = useCallback((updater: (prev: Application[]) => Application[]) => {
    setApps(prev => updater(prev))
  }, [])

  const update = useCallback(async (id: string, patch: Partial<Application>) => {
    let prevRow: Application | undefined
    setApps(prev =>
      prev.map(a => {
        if (a.id !== id) return a
        prevRow = a
        return { ...a, ...patch }
      }),
    )
    try {
      await restAdapter.updateApplication(id, patch)
      void refetch()
    } catch (e) {
      if (prevRow) {
        const restore = prevRow
        setApps(prev => prev.map(a => (a.id === id ? restore : a)))
      }
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }, [refetch])

  const remove = useCallback(async (id: string) => {
    let removed: Application | undefined
    let index = -1
    setApps(prev => {
      index = prev.findIndex(a => a.id === id)
      if (index < 0) return prev
      removed = prev[index]
      return prev.filter(a => a.id !== id)
    })
    try {
      await restAdapter.deleteApplication(id)
    } catch (e) {
      if (removed && index >= 0) {
        const row = removed
        const at = index
        setApps(prev => {
          if (prev.some(a => a.id === id)) return prev
          const next = [...prev]
          next.splice(Math.min(at, next.length), 0, row)
          return next
        })
      }
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }, [])

  const create = useCallback(async (input: NewApplication): Promise<Application | null> => {
    try {
      const created = await restAdapter.createApplication(input)
      mutate(prev => [created, ...prev])
      return created
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed')
      return null
    }
  }, [mutate])

  return { apps, loading, error, refetch, mutate, create, update, remove }
}
