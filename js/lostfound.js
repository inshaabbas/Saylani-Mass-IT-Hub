// =============================================
// lostfound.js – Lost & Found Module
// User: Submit items, view own posts
// Admin: View all, update status
// Also handles keyword matching for notifications
// =============================================

import { db, storage } from "./firebase.js";
import { showToast } from "./auth.js";
import { createNotification } from "./notifications.js";
import {
  collection, addDoc, query, where,
  onSnapshot, doc, updateDoc, serverTimestamp, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// =============================================
// SUBMIT LOST/FOUND ITEM (User)
// =============================================
export async function submitLostFoundItem(userId, userName, formData) {
  try {
    let imageURL = "";

    // Upload image if provided
    const imageFile = formData.get("image");
    if (imageFile && imageFile.size > 0) {
      const imageRef = ref(storage, `lostfound/${userId}_${Date.now()}`);
      const snapshot = await uploadBytes(imageRef, imageFile);
      imageURL = await getDownloadURL(snapshot.ref);
    }

    // Save to Firestore
    const itemRef = await addDoc(collection(db, "lost_found_items"), {
      title: formData.get("title"),
      description: formData.get("description"),
      category: formData.get("category"),
      location: formData.get("location"),
      type: formData.get("type"),       // "lost" or "found"
      imageURL: imageURL,
      userId: userId,
      userName: userName,
      status: "Pending",
      createdAt: serverTimestamp()
    });

    showToast("Item reported successfully!", "success");

    // Check for keyword matches after submission
    await checkKeywordMatch(itemRef.id, formData.get("title"), userId);

    return true;
  } catch (error) {
    console.error("Lost & Found submit error:", error);
    showToast("Failed to submit. Please try again.", "error");
    return false;
  }
}

// =============================================
// KEYWORD MATCHING
// If user posts "Lost Wallet" and another posted
// "Found Wallet" → send match notification
// =============================================
async function checkKeywordMatch(newItemId, newTitle, userId) {
  try {
    // Extract keywords (words > 3 chars)
    const keywords = newTitle.toLowerCase().split(" ").filter(w => w.length > 3);
    if (keywords.length === 0) return;

    // Get all items except current
    const allItems = await getDocs(collection(db, "lost_found_items"));

    allItems.forEach((docSnap) => {
      if (docSnap.id === newItemId) return;
      const item = docSnap.data();
      const itemTitle = item.title.toLowerCase();

      // Check if any keyword matches
      const matched = keywords.some(kw => itemTitle.includes(kw));
      if (matched) {
        // Notify the user who posted the new item
        createNotification(
          userId,
          `🔍 Possible match found! "${item.title}" may match your report.`,
          "match"
        );
        // Also notify the other item's owner
        if (item.userId !== userId) {
          createNotification(
            item.userId,
            `🔍 Possible match for your item! Check "${newTitle}".`,
            "match"
          );
        }
      }
    });
  } catch (err) {
    console.error("Keyword match error:", err);
  }
}

// =============================================
// LISTEN TO USER'S OWN ITEMS (Real-time)
// onSnapshot → updates immediately when DB changes
// =============================================
export function listenUserLostFound(userId, renderFn) {
  const q = query(
    collection(db, "lost_found_items"),
    where("userId", "==", userId)
  );

  // onSnapshot gives real-time updates
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
    console.error("Listen user L&F error:", error);
    renderFn([]);
  });
}

// =============================================
// LISTEN TO ALL ITEMS (Admin only)
// =============================================
export function listenAllLostFound(renderFn) {
  const q = query(collection(db, "lost_found_items"));

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
    console.error("Listen all L&F error:", error);
    renderFn([]);
  });
}

// =============================================
// UPDATE ITEM STATUS (Admin)
// =============================================
export async function updateLostFoundStatus(itemId, newStatus, itemOwnerId) {
  try {
    await updateDoc(doc(db, "lost_found_items", itemId), {
      status: newStatus
    });

    // Notify the item owner
    await createNotification(
      itemOwnerId,
      `Your lost/found item status was updated to "${newStatus}".`,
      "status"
    );

    showToast(`Status updated to ${newStatus}`, "success");
  } catch (error) {
    console.error("Update status error:", error);
    showToast("Failed to update status.", "error");
  }
}

// =============================================
// RENDER ITEMS TABLE (User view)
// =============================================
export function renderUserLostFoundTable(items, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <p>No items reported yet.</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <table class="table-custom">
      <thead>
        <tr>
          <th>Title</th>
          <th>Type</th>
          <th>Category</th>
          <th>Status</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td class="fw-600">${escHtml(item.title)}</td>
            <td><span class="badge-status ${item.type === 'lost' ? 'badge-pending' : 'badge-found'}">${cap(item.type)}</span></td>
            <td>${escHtml(item.category || "—")}</td>
            <td>${getStatusBadge(item.status)}</td>
            <td class="text-muted fs-sm">${formatDate(item.createdAt)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
}

// =============================================
// RENDER ITEMS TABLE (Admin view with actions)
// =============================================
export function renderAdminLostFoundTable(items, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>No reports yet.</p></div>`;
    return;
  }

  container.innerHTML = `
    <table class="table-custom">
      <thead>
        <tr>
          <th>ID</th>
          <th>Title</th>
          <th>Type</th>
          <th>Category</th>
          <th>User</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, i) => `
          <tr>
            <td class="text-muted fs-sm">#${String(i + 1).padStart(3, "0")}</td>
            <td class="fw-600">${escHtml(item.title)}</td>
            <td><span class="badge-status ${item.type === 'lost' ? 'badge-pending' : 'badge-found'}">${cap(item.type)}</span></td>
            <td>${escHtml(item.category || "—")}</td>
            <td class="fs-sm">${escHtml(item.userName || "User")}</td>
            <td>${getStatusBadge(item.status)}</td>
            <td>
              <select class="status-select" data-id="${item.id}" data-owner="${item.userId}" onchange="window.updateLFStatus(this)">
                <option ${item.status === "Pending" ? "selected" : ""}>Pending</option>
                <option ${item.status === "Found" ? "selected" : ""}>Found</option>
              </select>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;

  // Expose update function to window for inline handler
  window.updateLFStatus = async (select) => {
    const { id, owner } = select.dataset;
    await updateLostFoundStatus(id, select.value, owner);
  };
}

// ---- Helpers ----
function getStatusBadge(status) {
  const classes = {
    "Pending": "badge-pending",
    "Found": "badge-found",
    "In Progress": "badge-progress",
    "Resolved": "badge-resolved"
  };
  return `<span class="badge-status ${classes[status] || 'badge-submitted'}">${status}</span>`;
}

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}

function escHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cap(str) {
  return str ? str[0].toUpperCase() + str.slice(1) : "";
}