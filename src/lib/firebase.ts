import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// This config is meant to be public — it's embedded in every visitor's
// browser automatically. Actual security comes from the Realtime Database
// rules (configured separately in the Firebase console), not from keeping
// this secret.
const firebaseConfig = {
  apiKey: 'AIzaSyB3HfsxPoJDffBeP6Q2TgPBh6Y5EtsuffM',
  authDomain: 'word-stack-941a1.firebaseapp.com',
  databaseURL: 'https://word-stack-941a1-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'word-stack-941a1',
  storageBucket: 'word-stack-941a1.firebasestorage.app',
  messagingSenderId: '994492399913',
  appId: '1:994492399913:web:8139aaf938a17d98447738'
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
