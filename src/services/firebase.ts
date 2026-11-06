import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

export const firebaseConfig: FirebaseOptions = {
  apiKey: 'AIzaSyCrxQ7KdAax8uNwRzP81sCHJXqcb3tCF1s',
  authDomain: 'cohost-8fdc0.firebaseapp.com',
  projectId: 'cohost-8fdc0',
  storageBucket: 'cohost-8fdc0.firebasestorage.app',
  messagingSenderId: '824086265811',
  appId: '1:824086265811:web:0c273254f988ba9cd17926',
}

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
