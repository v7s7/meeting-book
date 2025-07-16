import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAQNyeFBViieNuxUJ2NDmnGXrX_H-Vx-7k",
  authDomain: "meeting-book-2c02d.firebaseapp.com",
  projectId: "meeting-book-2c02d",
  storageBucket: "meeting-book-2c02d.firebasestorage.app",
  messagingSenderId: "839569951648",
  appId: "1:839569951648:web:2ec0e0dbce67da693a32c5"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);