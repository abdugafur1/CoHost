
import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'

export const firebaseConfig: FirebaseOptions = {
  apiKey: 'AIzaSyCrxQ7KdAax8uNwRzP81sCHJXqcb3tCF1s',
  authDomain: 'cohost-8fdc0.firebaseapp.com',
  projectId: 'cohost-8fdc0',
  storageBucket: 'cohost-8fdc0.firebasestorage.app',
  messagingSenderId: '824086265811',
  appId: '1:824086265811:web:0c273254f988ba9cd17926',
}

const useEmulators =
  import.meta.env.MODE === 'e2e' &&
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'

if (useEmulators) {
  firebaseConfig.projectId = 'demo-cohost'
  firebaseConfig.authDomain = 'demo-cohost.firebaseapp.com'
}

export const app = getApps().length
  ? getApps()[0]
  : initializeApp(firebaseConfig)

if (useEmulators && app.options.projectId !== 'demo-cohost') {
  throw new Error('E2E mode must use the demo-cohost Firebase project.')
}

export const auth = getAuth(app)
export const db = getFirestore(app)

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099')
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
