import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { restAdapter } from '@/storage/rest/adapter'
import type { NewApplication, NewPendingUrl } from '@/storage/adapter'
import type { Application, PendingUrl } from '@/types'

const POLL_MS = 5000

export interface UsePendingUrls {
  pending: PendingUrl[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  mutate: (updater: (prev: PendingUrl[]) => PendingUrl[]) => void
  createMany: (inputs: NewPendingUrl[]) => Promise<PendingUrl[]>
  update: (id: string, patch: Partial<PendingUrl>) => Promise<void>
  remove: (id: string) => Promise<void>
  approve: (id: string, app: NewApplication) => Promise<Application | null>
}

export function usePendingUrls(): UsePendingUrls {
  const [pending, setPending] = useState<PendingUrl[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const refetch = useCallback(async () => {
    try {
      const list = await restAdapter.listPendingUrls()
      if (!mountedRef.current) return
      setPending(list)
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

  const mutate = useCallback((updater: (prev: PendingUrl[]) => PendingUrl[]) => {
    setPending(prev => updater(prev))
  }, [])

  const update = useCallback(async (id: string, patch: Partial<PendingUrl>) => {
    let prevRow: PendingUrl | undefined
    setPending(prev =>
      prev.map(p => {
        if (p.id !== id) return p
        prevRow = p
        return {
          ...p,
          ...patch,
          extracted: patch.extracted ? { ...p.extracted, ...patch.extracted } : p.extracted,
        }
      }),
    )
    try {
      await restAdapter.updatePendingUrl(id, patch)
    } catch (e) {
      if (prevRow) {
        const restore = prevRow
        setPending(prev => prev.map(p => (p.id === id ? restore : p)))
      }
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    let removed: PendingUrl | undefined
    let index = -1
    setPending(prev => {
      index = prev.findIndex(p => p.id === id)
      if (index < 0) return prev
      removed = prev[index]
      return prev.filter(p => p.id !== id)
    })
    try {
      await restAdapter.deletePendingUrl(id)
    } catch (e) {
      if (removed && index >= 0) {
        const row = removed
        const at = index
        setPending(prev => {
          if (prev.some(p => p.id === id)) return prev
          const next = [...prev]
          next.splice(Math.min(at, next.length), 0, row)
          return next
        })
      }
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }, [])

  const createMany = useCallback(async (inputs: NewPendingUrl[]): Promise<PendingUrl[]> => {
    if (inputs.length === 0) return []
    try {
      const created: PendingUrl[] = []
      for (let i = 0; i < inputs.length; i += 200) {
        const chunk = inputs.slice(i, i + 200)
        const rows = await restAdapter.createPendingUrls(chunk)
        created.push(...rows)
      }
      mutate(prev => [...created, ...prev])
      return created
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Add failed')
      return []
    }
  }, [mutate])

  const approve = useCallback(async (id: string, app: NewApplication): Promise<Application | null> => {
    let removed: PendingUrl | undefined
    let index = -1
    setPending(prev => {
      index = prev.findIndex(p => p.id === id)
      if (index < 0) return prev
      removed = prev[index]
      return prev.filter(p => p.id !== id)
    })
    try {
      const created = await restAdapter.approvePending(id, app)
      return created
    } catch (e) {
      if (removed && index >= 0) {
        const row = removed
        const at = index
        setPending(prev => {
          if (prev.some(p => p.id === id)) return prev
          const next = [...prev]
          next.splice(Math.min(at, next.length), 0, row)
          return next
        })
      }
      toast.error(e instanceof Error ? e.message : 'Approve failed')
      return null
    }
  }, [])

  return { pending, loading, error, refetch, mutate, createMany, update, remove, approve }
}
