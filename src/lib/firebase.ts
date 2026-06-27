import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// This config is meant to be public — it's embedded in every visitor's
// browser automatically. Actual security comes from the Realtime Database
// rules (configured separately in the Firebase console), not from keeping
// this secret.
const firebaseConfig = {
  apiKey: 'AIzaSyDiFTRInuSC9l2iknMZFLkBAO_F1ac1Vmw',
  authDomain: 'upwords-online.firebaseapp.com',
  databaseURL: 'https://upwords-online-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'upwords-online',
  storageBucket: 'upwords-online.firebasestorage.app',
  messagingSenderId: '52618703418',
  appId: '1:52618703418:web:fed4df7cf48b08e45cfb03'
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
