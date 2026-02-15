
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAJBy4abZDtzOFKywNOY4TNmcGhnFVbXpg",
  authDomain: "saylani-portal-263f8.firebaseapp.com",
  projectId: "saylani-portal-263f8",
  storageBucket: "saylani-portal-263f8.firebasestorage.app",
  messagingSenderId: "43568593954",
  appId: "1:43568593954:web:46146c751362f3aae11e7b"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);       // For login/signup
export const db = getFirestore(app);    // For storing data
export const storage = getStorage(app); // For image uploads

export function getCurrentUser() {
  return auth.currentUser;
}
