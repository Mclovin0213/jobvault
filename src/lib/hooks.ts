import { useCallback, useEffect, useRef, useState } from 'react'

export interface DebouncedSaver<T> {
  schedule: (value: T) => void
  flush: () => Promise<void>
  cancel: () => Promise<void>
}

export function useDebouncedSaver<T>(save: (value: T) => void | Promise<void>, delayMs = 500): DebouncedSaver<T> {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<{ value: T } | null>(null)
  const saveRef = useRef(save)
  const inFlightRef = useRef<Promise<void>>(Promise.resolve())
  useEffect(() => {
    saveRef.current = save
  }, [save])

  const runSave = useCallback((value: T) => {
    const job = inFlightRef.current
      .catch(() => undefined)
      .then(async () => {
        await saveRef.current(value)
      })
    inFlightRef.current = job
    return job
  }, [])

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (pendingRef.current) {
      const { value } = pendingRef.current
      pendingRef.current = null
      return runSave(value)
    }
    return inFlightRef.current
  }, [runSave])

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    pendingRef.current = null
    return inFlightRef.current
  }, [])

  const schedule = useCallback(
    (value: T) => {
      pendingRef.current = { value }
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        const pending = pendingRef.current
        pendingRef.current = null
        if (pending) void runSave(pending.value)
      }, delayMs)
    },
    [delayMs, runSave],
  )

  useEffect(() => {
    return () => {
      void flush()
    }
  }, [flush])

  return { schedule, flush, cancel }
}

// Local-edit state that reconciles to a remote value when the field is not focused.
// While focused, the user's in-flight edit always wins. On blur (or if remote
// changes when no edit is in progress), the local value snaps to the remote.
export function useReconciledDraft<T>(remote: T, equals: (a: T, b: T) => boolean = Object.is) {
  const [value, setValue] = useState<T>(remote)
  const focusedRef = useRef(false)
  const lastRemoteRef = useRef(remote)

  useEffect(() => {
    if (equals(lastRemoteRef.current, remote)) return
    lastRemoteRef.current = remote
    if (!focusedRef.current) setValue(remote)
  }, [remote, equals])

  const onFocus = useCallback(() => {
    focusedRef.current = true
  }, [])
  const onBlur = useCallback(() => {
    focusedRef.current = false
    if (!equals(lastRemoteRef.current, remote)) setValue(remote)
  }, [remote, equals])

  return { value, setValue, onFocus, onBlur }
}
