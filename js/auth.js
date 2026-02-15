// =============================================
// auth.js — Authentication Logic
// Handles: Login, Signup, Role Check, Redirect
// =============================================

import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ---- ADMIN EMAILS (all lowercase) ----
const ADMIN_EMAILS = ["admin@saylani.org", "smit@saylani.org"];

// ---- SHOW TOAST ----
function showToast(msg, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast-msg ${type}`;
  toast.innerHTML = `<span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// =============================================
// SIGNUP FUNCTION
// =============================================
async function signupUser(name, email, password) {
  try {
    const emailLower = email.toLowerCase();

    // 1. Create user in Firebase Auth
    const userCred = await createUserWithEmailAndPassword(auth, emailLower, password);
    const user = userCred.user;

    // 2. Determine role based on email (force admin if in ADMIN_EMAILS)
    const role = ADMIN_EMAILS.includes(emailLower) ? "admin" : "user";

    // 3. Save user data to Firestore "users" collection
    await setDoc(doc(db, "users", user.uid), {
      name,
      email: emailLower,
      role,
      createdAt: serverTimestamp()
    });

    console.log("Signup complete:", emailLower, "Role:", role);

    // 4. Show success message
    showToast("Account created successfully! Please login.", "success");

    // 5. Logout and redirect to login page
    await signOut(auth);
    
    // Small delay to show the toast
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1500);

  } catch (error) {
    showToast(getErrorMessage(error.code), "error");
  }
}

// =============================================
// LOGIN FUNCTION
// =============================================
async function loginUser(email, password) {
  try {
    const emailLower = email.toLowerCase();

    // 1. Sign in with Firebase Auth
    const userCred = await signInWithEmailAndPassword(auth, emailLower, password);
    const user = userCred.user;

    // 2. Get role from Firestore
    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (!userDoc.exists()) {
      showToast("User profile not found. Please sign up.", "error");
      return;
    }

    const { role } = userDoc.data();
    console.log("Login:", user.email, "Firestore Role:", role);

    // 3. Redirect based on Firestore role ONLY
    if (role === "admin") {
      window.location.href = "admin-dashboard.html";
    } else {
      window.location.href = "user-dashboard.html";
    }

  } catch (error) {
    showToast(getErrorMessage(error.code), "error");
  }
}

// =============================================
// LOGOUT FUNCTION
// =============================================
async function logoutUser() {
  await signOut(auth);
  window.location.href = "index.html";
}

// =============================================
// PROTECT DASHBOARD PAGES
// =============================================
async function protectPage(requiredRole) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        window.location.href = "index.html";
        return;
      }

      const { role } = userDoc.data();
      console.log("Protect Page:", user.email, "Role:", role, "Required:", requiredRole);

      if (role !== requiredRole) {
        if (role === "admin") {
          window.location.href = "admin-dashboard.html";
        } else {
          window.location.href = "user-dashboard.html";
        }
        return;
      }

      resolve({ user, ...userDoc.data() });
    });
  });
}

// =============================================
// FRIENDLY ERROR MESSAGES
// =============================================
function getErrorMessage(code) {
  const messages = {
    "auth/email-already-in-use": "This email is already registered.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password. Try again.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment."
  };
  return messages[code] || "Something went wrong. Please try again.";
}

// =============================================
// LOGIN PAGE SETUP
// =============================================
function setupLoginPage() {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const btn = loginForm.querySelector("button[type=submit]");
    btn.textContent = "Signing in...";
    btn.disabled = true;
    await loginUser(email, password);
    btn.textContent = "Log In";
    btn.disabled = false;
  });
}

// =============================================
// SIGNUP PAGE SETUP
// =============================================
function setupSignupPage() {
  const signupForm = document.getElementById("signupForm");
  if (!signupForm) return;

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    const btn = signupForm.querySelector("button[type=submit]");
    btn.textContent = "Creating account...";
    btn.disabled = true;
    await signupUser(name, email, password);
    btn.textContent = "Sign Up";
    btn.disabled = false;
  });
}

// ---- Export everything ----
export { loginUser, signupUser, logoutUser, protectPage, showToast, setupLoginPage, setupSignupPage };