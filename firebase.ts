import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getMessaging, isSupported } from "firebase/messaging";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDjKYzt_x4LcdJR2UgOM91_cx3ZTktrShA",
  authDomain: "teak-infusion.firebaseapp.com",
  projectId: "teak-infusion",
  storageBucket: "teak-infusion.firebasestorage.app",
  messagingSenderId: "976405757455",
  appId: "1:976405757455:web:fc17259fbf8c94c8db6d7a",
  measurementId: "G-E077LQN5TV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore Database
export const db = getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Analytics (optional)
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Initialize Messaging
export let messaging: any = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      messaging = getMessaging(app);
    }
  });
}

export { app };
