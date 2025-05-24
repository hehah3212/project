// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAqxfeEt3YRCiBSh-u2MfFccg8P_-mnjQY",
  authDomain: "book-691ea.firebaseapp.com",
  projectId: "book-691ea",
  storageBucket: "book-691ea.appspot.com",
  messagingSenderId: "106780558240",
  appId: "1:106780558240:web:9322063264ecd98aab1ac5",
  measurementId: "G-E4RF7KVED8",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);