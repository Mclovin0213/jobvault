import { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type { Application, Status, WorkArrangement } from '@/types'

function fromDoc(snap: QueryDocumentSnapshot<DocumentData>): Application {
  const d = snap.data()
  return {
    id: snap.id,
    url: d.url ?? '',
    company: d.company ?? '',
    role: d.role ?? '',
    salary: d.salary ?? '',
    location: d.location ?? '',
    workArrangement: (d.workArrangement ?? '') as WorkArrangement,
    source: d.source ?? '',
    tags: Array.isArray(d.tags) ? d.tags : [],
    status: (d.status ?? 'pending') as Status,
    notes: d.notes ?? '',
    deadline: d.deadline ?? null,
    followUpDate: d.followUpDate ?? null,
    appliedAt: d.appliedAt ?? null,
    createdAt: d.createdAt ?? null,
    addedBy: d.addedBy ?? '',
    addedByName: d.addedByName ?? '',
  }
}

export function useApplications() {
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'applications'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      snap => {
        setApps(snap.docs.map(fromDoc))
        setLoading(false)
      },
      err => {
        setError(err.message)
        setLoading(false)
      },
    )
    return unsub
  }, [])

  return { apps, loading, error }
}
