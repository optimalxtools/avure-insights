// lib/firebaseAdmin.ts
import 'server-only';

import { getApps, getApp, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import serviceAccount from '@/keys/firebase-admin.json';

/** Create/return an Admin app in *this* process, then pass it explicitly. */
function ensureAdminApp(): App {
  if (getApps().length) return getApp();
  
  return initializeApp({
    credential: cert(serviceAccount as any),
  });
}

export function getAdminAuth(): Auth {
  const app = ensureAdminApp();   // <- guaranteed in this process
  return getAuth(app);            // <- pass the app (no reliance on "default")
}

export function getAdminDb(): Firestore {
  const app = ensureAdminApp();   // <- guaranteed in this process
  return getFirestore(app);       // <- use Firestore with the named app
}
