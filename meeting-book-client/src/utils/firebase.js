import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDvWQXNk4-vcpTYHvPpz2XXw-C7ocsu6rE",
  authDomain: "booking-2dfd1.firebaseapp.com",
  projectId: "booking-2dfd1",
  storageBucket: "booking-2dfd1.appspot.com",
  messagingSenderId: "200521592031",
  appId: "1:200521592031:web:1d7dc53b5645a7540b0d6a",
  measurementId: "G-XP4VKSJV0D"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firestore and Auth
export const auth = getAuth(app);
export const db = getFirestore(app);

// Analytics (optional, only if needed)
const analytics = getAnalytics(app);
