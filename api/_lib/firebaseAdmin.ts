import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

function init() {
  if (getApps().length) return getApp()
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('missing_admin_credentials')
  }
  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  })
}

export const adminApp = init()
export const adminAuth = getAuth(adminApp)
export const adminDb = getFirestore(adminApp)
