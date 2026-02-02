import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC4KaSZlweOJki5BSAicvHfozMiUBmiYNY",
  authDomain: "sanbitu-footbal-club.firebaseapp.com",
  projectId: "sanbitu-footbal-club",
  storageBucket: "sanbitu-footbal-club.firebasestorage.app",
  messagingSenderId: "298770001495",
  appId: "1:298770001495:web:549d920a9a7bcde809bd12"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable offline persistence
enableMultiTabIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled in one tab at a time.
    console.warn('Firestore persistence failed: Multiple tabs open');
  } else if (err.code === 'unimplemented') {
    // The current browser does not support all of the features required to enable persistence
    console.warn('Firestore persistence failed: Browser not supported');
  }
});

export default app;
