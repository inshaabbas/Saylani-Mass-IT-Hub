// =============================================
// notifications.js – Notifications System
// Creates and listens to notifications in real-time
// Used by: lostfound.js, complaints.js, volunteer.js
// =============================================

import { db } from "./firebase.js";
import {
  collection, addDoc, query, where,
  onSnapshot, updateDoc, doc, serverTimestamp, writeBatch, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// =============================================
// CREATE A NOTIFICATION
// Called by other modules when status changes
// =============================================
export async function createNotification(userId, message, type = "info") {
  try {
    await addDoc(collection(db, "notifications"), {
      userId: userId,
      message: message,
      type: type,         // "complaint", "lostfound", "match", "info"
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Create notification error:", error);
  }
}

// =============================================
// LISTEN TO USER'S NOTIFICATIONS (Real-time)
// onSnapshot fires immediately + on every change
// =============================================
export function listenNotifications(userId, onUpdate) {
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId)
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort on client side
    notifications.sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
    onUpdate(notifications);
  }, (error) => {
    console.error("Listen notifications error:", error);
    onUpdate([]);
  });
}

// =============================================
// MARK ALL NOTIFICATIONS AS READ
// =============================================
export async function markAllRead(userId) {
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    where("read", "==", false)
  );

  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => {
    batch.update(doc(db, "notifications", d.id), { read: true });
  });
  await batch.commit();
}

// =============================================
// MARK SINGLE NOTIFICATION AS READ
// =============================================
export async function markOneRead(notifId) {
  await updateDoc(doc(db, "notifications", notifId), { read: true });
}

// =============================================
// RENDER NOTIFICATIONS IN DROPDOWN (Topbar bell)
// =============================================
export function renderNotificationBell(notifications, badgeId, dropdownId) {
  const badge = document.getElementById(badgeId);
  const dropdown = document.getElementById(dropdownId);

  const unread = notifications.filter(n => !n.read);

  // Update badge count
  if (badge) {
    badge.textContent = unread.length;
    badge.style.display = unread.length > 0 ? "flex" : "none";
  }

  // Update dropdown list
  if (dropdown) {
    const listEl = dropdown.querySelector(".notif-list");
    if (!listEl) return;

    if (notifications.length === 0) {
      listEl.innerHTML = `<div class="notif-item text-muted fs-sm">No notifications yet.</div>`;
      return;
    }

    listEl.innerHTML = notifications.slice(0, 8).map(n => `
      <div class="notif-item ${n.read ? "" : "unread"}" onclick="window.markNotifRead('${n.id}')">
        <div>${getNotifIcon(n.type)} ${escHtml(n.message)}</div>
        <div class="notif-time">${timeAgo(n.createdAt)}</div>
      </div>
    `).join("");
  }
}

// =============================================
// RENDER NOTIFICATIONS LIST (In notifications section)
// =============================================
export function renderNotificationsList(notifications, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (notifications.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="48" height="48">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        <p>No notifications yet.</p>
      </div>`;
    return;
  }

  container.innerHTML = notifications.map(n => `
    <div class="card-panel mb-2 ${n.read ? "" : "border-start border-3 border-success"}" style="padding: 14px 18px;">
      <div class="d-flex align-center gap-10">
        <span style="font-size:1.2rem">${getNotifIcon(n.type)}</span>
        <div style="flex:1">
          <div class="fs-sm fw-600 ${n.read ? 'text-muted' : ''}">${escHtml(n.message)}</div>
          <div class="text-muted" style="font-size:0.74rem; margin-top:3px">${timeAgo(n.createdAt)}</div>
        </div>
        ${!n.read ? `<button class="btn-outline btn-sm" onclick="window.markNotifRead('${n.id}')">Mark read</button>` : `<span class="text-muted fs-sm">Read</span>`}
      </div>
    </div>
  `).join("");
}

// ---- Helpers ----
function getNotifIcon(type) {
  const icons = {
    complaint: "📋",
    lostfound: "📦",
    match: "🔗",
    status: "✅",
    info: "ℹ️"
  };
  return icons[type] || "🔔";
}

function timeAgo(ts) {
  if (!ts) return "just now";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function escHtml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}