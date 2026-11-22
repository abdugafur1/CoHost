import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

const useEmulators = import.meta.env.MODE === 'e2e'
const productionConfig: FirebaseOptions = {
  apiKey: 'AIzaSyCrxQ7KdAax8uNwRzP81sCHJXqcb3tCF1s',
  authDomain: 'cohost-8fdc0.firebaseapp.com',
  projectId: 'cohost-8fdc0',
  storageBucket: 'cohost-8fdc0.firebasestorage.app',
  messagingSenderId: '824086265811',
  appId: '1:824086265811:web:0c273254f988ba9cd17926',
}

export const firebaseConfig: FirebaseOptions = useEmulators
  ? { apiKey: 'demo-key', authDomain: '127.0.0.1:9099', projectId: 'demo-cohost' }
  : productionConfig

const emulatorAppName = 'cohost-e2e'
const existingApp = useEmulators
  ? getApps().find((app) => app.name === emulatorAppName)
  : getApps()[0]
export const app = existingApp ?? initializeApp(firebaseConfig, useEmulators ? emulatorAppName : undefined)
export const auth = getAuth(app)
export const db = getFirestore(app)

if (useEmulators && !existingApp) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099')
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
