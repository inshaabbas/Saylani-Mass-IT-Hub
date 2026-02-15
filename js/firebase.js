// =============================================
// firebase.js — Firebase Config & Initialization
// This file connects your app to Firebase
// Import this at the top of EVERY other JS file
// =============================================

// Step 1: Import Firebase SDKs from CDN (no install needed)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// ⚠️ STEP: Replace this config with YOUR Firebase project config
// Go to Firebase Console → Your Project → Project Settings → Your Apps → Firebase SDK snippet
const firebaseConfig = {
  apiKey: "AIzaSyAJBy4abZDtzOFKywNOY4TNmcGhnFVbXpg",
  authDomain: "saylani-portal-263f8.firebaseapp.com",
  projectId: "saylani-portal-263f8",
  storageBucket: "saylani-portal-263f8.firebasestorage.app",
  messagingSenderId: "43568593954",
  appId: "1:43568593954:web:46146c751362f3aae11e7b"
};

// Step 2: Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Step 3: Export Firebase services so other files can use them
export const auth = getAuth(app);       // For login/signup
export const db = getFirestore(app);    // For storing data
export const storage = getStorage(app); // For image uploads

// Helper: Get current user
export function getCurrentUser() {
  return auth.currentUser;
}
