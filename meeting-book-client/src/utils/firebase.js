import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ✅ Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDvWQXNk4-vcpTYHvPpz2XXw-C7ocsu6rE",
  authDomain: "booking-2dfd1.firebaseapp.com",
  projectId: "booking-2dfd1",
  storageBucket: "booking-2dfd1.appspot.com",
  messagingSenderId: "200521592031",
  appId: "1:200521592031:web:1d7dc53b5645a7540b0d6a",
  measurementId: "G-XP4VKSJV0D"
};

// ✅ Initialize only what you use
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
