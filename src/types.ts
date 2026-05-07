import type { Timestamp } from 'firebase/firestore'

export type Status = 'pending' | 'applied' | 'interview' | 'offer' | 'rejected'
export const STATUSES: Status[] = ['pending', 'applied', 'interview', 'offer', 'rejected']

export type WorkArrangement = 'remote' | 'hybrid' | 'onsite' | ''
export const WORK_ARRANGEMENTS: WorkArrangement[] = ['', 'remote', 'hybrid', 'onsite']

export interface Application {
  id: string
  url: string
  company: string
  role: string
  salary: string
  location: string
  workArrangement: WorkArrangement
  source: string
  tags: string[]
  status: Status
  notes: string
  deadline: Timestamp | null
  followUpDate: Timestamp | null
  appliedAt: Timestamp | null
  createdAt: Timestamp | null
  addedBy: string
  addedByName: string
}

export const STATUS_LABELS: Record<Status, string> = {
  pending: 'Pending',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
}
