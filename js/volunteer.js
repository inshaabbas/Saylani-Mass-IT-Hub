// =============================================
// volunteer.js – Volunteer Registration Module
// User: Register for events
// Admin: View all registrations in table
// =============================================

import { db } from "./firebase.js";
import { showToast } from "./auth.js";
import {
  collection, addDoc, query, where,
  onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Sample events data (can be moved to Firestore later)
export const EVENTS = [
  {
    id: "community-cleanup",
    title: "Community Cleanup",
    date: "Saturday, 22nd June",
    location: "City Park",
    image: "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=400&q=80",
    featured: true
  },
  {
    id: "tech-workshop",
    title: "Tech Workshop",
    date: "June 5",
    location: "SMIT Campus",
    image: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400&q=80",
    featured: false
  },
  {
    id: "health-camp",
    title: "Health Camp",
    date: "July 5",
    location: "Community Center",
    image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&q=80",
    featured: false
  }
];

// =============================================
// REGISTER AS VOLUNTEER (User)
// =============================================
export async function registerVolunteer(userId, userName, formData) {
  try {
    // Check if already registered for this event
    const existing = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const { getDocs } = existing;

    const q = query(
      collection(db, "volunteers"),
      where("userId", "==", userId),
      where("eventId", "==", formData.eventId)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      showToast("You already registered for this event!", "info");
      return false;
    }

    await addDoc(collection(db, "volunteers"), {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      eventId: formData.eventId,
      eventTitle: formData.eventTitle,
      availability: formData.availability,
      skills: formData.skills,
      userId: userId,
      userName: userName,
      status: "Registered",
      createdAt: serverTimestamp()
    });

    showToast("Volunteer registration successful! 🎉", "success");
    return true;
  } catch (error) {
    console.error("Volunteer registration error:", error);
    showToast("Registration failed. Please try again.", "error");
    return false;
  }
}

// =============================================
// LISTEN TO USER'S REGISTRATIONS (Real-time)
// =============================================
export function listenUserVolunteers(userId, renderFn) {
  const q = query(
    collection(db, "volunteers"),
    where("userId", "==", userId)
  );

  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort on client side
    items.sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
    renderFn(items);
  }, (error) => {
    console.error("Listen user volunteers error:", error);
    renderFn([]);
  });
}

// =============================================
// LISTEN TO ALL REGISTRATIONS (Admin)
// =============================================
export function listenAllVolunteers(renderFn) {
  const q = query(collection(db, "volunteers"));

  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort on client side
    items.sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
    renderFn(items);
  }, (error) => {
    console.error("Listen all volunteers error:", error);
    renderFn([]);
  });
}

// =============================================
// RENDER EVENTS GRID (User)
// =============================================
export function renderEventsGrid(containerId, onRegister) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const featured = EVENTS.find(e => e.featured);
  const regular = EVENTS.filter(e => !e.featured);

  container.innerHTML = `
    ${featured ? `
      <div class="event-card mb-3">
        <div class="event-card-img-featured" style="background: linear-gradient(135deg, #66b032, #0057a8);">
          <div class="event-overlay">
            <h4>${escHtml(featured.title)}</h4>
            <p>${escHtml(featured.date)} • ${escHtml(featured.location)}</p>
          </div>
        </div>
        <div class="event-card-footer mt-2">
          <span class="text-muted fs-sm">${escHtml(featured.location)}</span>
          <button class="btn-green btn-sm" onclick="window.openVolunteerModal('${featured.id}', '${featured.title}')">
            Register
          </button>
        </div>
      </div>
    ` : ""}
    <div class="events-grid">
      ${regular.map(ev => `
        <div class="event-card">
          <div class="event-card-img" style="background: linear-gradient(135deg, #e8f5d9, #e0eef8); display:flex; align-items:center; justify-content:center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="#66b032" opacity="0.5">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
          <div class="event-card-body">
            <div class="event-card-title">${escHtml(ev.title)}</div>
            <div class="event-card-date">${escHtml(ev.date)}</div>
          </div>
          <div class="event-card-footer">
            <span class="text-muted fs-sm">${escHtml(ev.location)}</span>
            <button class="btn-green btn-sm" onclick="window.openVolunteerModal('${ev.id}', '${ev.title}')">
              Register
            </button>
          </div>
        </div>
      `).join("")}
    </div>`;
}

// =============================================
// RENDER USER'S REGISTRATIONS TABLE
// =============================================
export function renderUserVolunteersTable(items, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>No event registrations yet.</p></div>`;
    return;
  }

  container.innerHTML = `
    <table class="table-custom">
      <thead>
        <tr>
          <th>Event</th>
          <th>Availability</th>
          <th>Skills</th>
          <th>Status</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td class="fw-600">${escHtml(item.eventTitle)}</td>
            <td>${escHtml(item.availability)}</td>
            <td class="fs-sm">${escHtml(item.skills || "—")}</td>
            <td><span class="badge-status badge-found">${item.status}</span></td>
            <td class="text-muted fs-sm">${formatDate(item.createdAt)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
}

// =============================================
// RENDER ADMIN VOLUNTEERS TABLE
// =============================================
export function renderAdminVolunteersTable(items, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>No volunteer registrations yet.</p></div>`;
    return;
  }

  container.innerHTML = `
    <table class="table-custom">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Event</th>
          <th>Availability</th>
          <th>Skills</th>
          <th>Status</th>
          <th>Registered</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td class="fw-600">${escHtml(item.name || item.userName)}</td>
            <td class="fs-sm">${escHtml(item.email || "—")}</td>
            <td>${escHtml(item.eventTitle)}</td>
            <td>${escHtml(item.availability)}</td>
            <td class="fs-sm">${escHtml(item.skills || "—")}</td>
            <td><span class="badge-status badge-found">${item.status}</span></td>
            <td class="text-muted fs-sm">${formatDate(item.createdAt)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
}

// ---- Helpers ----
function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}

function escHtml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}