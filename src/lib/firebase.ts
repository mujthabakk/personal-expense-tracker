import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;

export function getFirebase() {
  if (!isFirebaseConfigured()) return null;
  if (!app) {
    app = initializeApp(config);
    auth = getAuth(app);
    firestore = getFirestore(app);
  }
  return { app, auth: auth!, firestore: firestore! };
}

export function watchAuth(listener: (user: User | null) => void): () => void {
  const firebase = getFirebase();
  if (!firebase) return () => undefined;
  return onAuthStateChanged(firebase.auth, listener);
}

export async function signIn(email: string, password: string) {
  const firebase = getFirebase();
  if (!firebase) throw new Error('Add Firebase keys in .env.local to enable cloud sync.');
  await signInWithEmailAndPassword(firebase.auth, email.trim(), password);
}

export async function signUp(email: string, password: string) {
  const firebase = getFirebase();
  if (!firebase) throw new Error('Add Firebase keys in .env.local to enable cloud sync.');
  await createUserWithEmailAndPassword(firebase.auth, email.trim(), password);
}

export async function logOut() {
  const firebase = getFirebase();
  if (!firebase) return;
  await signOut(firebase.auth);
}

export async function resetPassword(email: string) {
  const firebase = getFirebase();
  if (!firebase) throw new Error('Add Firebase keys in .env.local to enable cloud sync.');
  await sendPasswordResetEmail(firebase.auth, email.trim());
}

export function authErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (code.includes('invalid-email')) return 'Enter a valid email address.';
  if (code.includes('email-already-in-use')) return 'An account with this email already exists.';
  if (code.includes('weak-password')) return 'Use at least 8 characters.';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'Email or password is incorrect.';
  }
  if (code.includes('too-many-requests')) return 'Too many attempts. Wait a moment and try again.';
  if (code.includes('network')) return 'You appear to be offline.';
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Try again.';
}
