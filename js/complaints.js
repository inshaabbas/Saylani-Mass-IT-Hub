// =============================================
// complaints.js – Complaints Module
// User: Submit complaints, view own
// Admin: View all, update status
// =============================================

import { db } from "./firebase.js";
import { showToast } from "./auth.js";
import { createNotification } from "./notifications.js";
import {
  collection, addDoc, query, where,
  onSnapshot, doc, updateDoc, serverTimestamp, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// =============================================
// SUBMIT COMPLAINT (User)
// =============================================
export async function submitComplaint(userId, userName, formData) {
  try {
    console.log("=== SUBMITTING COMPLAINT ===");
    console.log("User ID:", userId);
    console.log("User Name:", userName);
    console.log("Form Data:", formData);
    
    const complaintData = {
      title: formData.title,
      category: formData.category,
      description: formData.description,
      location: formData.location,
      urgency: formData.urgency,
      userId: userId,
      userName: userName,
      status: "Submitted",
      createdAt: serverTimestamp()
    };
    
    console.log("Complaint Data to be saved:", complaintData);
    
    const docRef = await addDoc(collection(db, "complaints"), complaintData);
    
    console.log("✅ Complaint saved successfully! ID:", docRef.id);
    showToast("Complaint submitted successfully!", "success");
    return true;
    
  } catch (error) {
    console.error("❌ SUBMIT COMPLAINT ERROR ===");
    console.error("Error object:", error);
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    
    let errorMessage = "Failed to submit complaint.";
    
    if (error.code === "permission-denied") {
      errorMessage = "Permission denied. Check Firestore security rules.";
      console.error("🔒 FIRESTORE RULES ISSUE - User cannot write to complaints collection");
    } else if (error.code === "unauthenticated") {
      errorMessage = "Not logged in. Please login again.";
      console.error("🔐 AUTHENTICATION ISSUE - User not authenticated");
    } else if (error.code === "unavailable") {
      errorMessage = "Network error. Check your internet connection.";
      console.error("🌐 NETWORK ISSUE - Firestore unavailable");
    }
    
    showToast(errorMessage, "error");
    return false;
  }
}

// =============================================
// LISTEN TO USER'S COMPLAINTS (Real-time)
// =============================================
export function listenUserComplaints(userId, renderFn) {
  console.log("=== SETTING UP USER COMPLAINTS LISTENER ===");
  console.log("Listening for userId:", userId);
  
  const q = query(
    collection(db, "complaints"),
    where("userId", "==", userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      console.log("📨 User Complaints Snapshot Received");
      console.log("Total documents:", snapshot.size);
      
      const complaints = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log("Document ID:", doc.id, "Data:", data);
        complaints.push({ id: doc.id, ...data });
      });
      
      // Sort by createdAt (newest first)
      complaints.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });
      
      console.log("Sorted complaints:", complaints.length, "items");
      console.log("Calling renderFn with complaints");
      renderFn(complaints);
    },
    (error) => {
      console.error("❌ LISTEN USER COMPLAINTS ERROR ===");
      console.error("Error:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      
      if (error.code === "permission-denied") {
        console.error("🔒 FIRESTORE RULES ISSUE - User cannot read complaints");
        showToast("Cannot load complaints. Check Firestore rules.", "error");
      }
      
      renderFn([]);
    }
  );
}

// =============================================
// LISTEN TO ALL COMPLAINTS (Admin - Real-time)
// =============================================
export function listenAllComplaints(renderFn) {
  console.log("=== SETTING UP ALL COMPLAINTS LISTENER (ADMIN) ===");
  
  const q = query(collection(db, "complaints"));

  return onSnapshot(
    q,
    (snapshot) => {
      console.log("📨 All Complaints Snapshot Received (Admin)");
      console.log("Total documents:", snapshot.size);
      
      const complaints = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log("Document ID:", doc.id, "User:", data.userName);
        complaints.push({ id: doc.id, ...data });
      });
      
      // Sort by createdAt (newest first)
      complaints.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });
      
      console.log("Sorted complaints:", complaints.length, "items");
      console.log("Calling renderFn with all complaints");
      renderFn(complaints);
    },
    (error) => {
      console.error("❌ LISTEN ALL COMPLAINTS ERROR ===");
      console.error("Error:", error);
      console.error("Error code:", error.code);
      
      if (error.code === "permission-denied") {
        console.error("🔒 FIRESTORE RULES ISSUE - Admin cannot read all complaints");
        showToast("Cannot load complaints. Check admin permissions.", "error");
      }
      
      renderFn([]);
    }
  );
}

// =============================================
// UPDATE COMPLAINT STATUS (Admin)
// =============================================
export async function updateComplaintStatus(complaintId, newStatus, ownerId) {
  try {
    console.log("=== UPDATING COMPLAINT STATUS ===");
    console.log("Complaint ID:", complaintId);
    console.log("New Status:", newStatus);
    console.log("Owner ID:", ownerId);
    
    await updateDoc(doc(db, "complaints", complaintId), {
      status: newStatus
    });

    console.log("✅ Status updated successfully");

    // Notify the complaint owner
    await createNotification(
      ownerId,
      `Your complaint status was updated to "${newStatus}".`,
      "complaint"
    );

    showToast(`Status updated to "${newStatus}"`, "success");
  } catch (error) {
    console.error("❌ UPDATE COMPLAINT ERROR ===");
    console.error("Error:", error);
    showToast("Failed to update status.", "error");
  }
}

// =============================================
// RENDER USER COMPLAINTS TABLE
// =============================================
export function renderUserComplaintsTable(complaints, containerId) {
  console.log("=== RENDERING USER COMPLAINTS TABLE ===");
  console.log("Container ID:", containerId);
  console.log("Complaints to render:", complaints.length);
  
  const container = document.getElementById(containerId);
  if (!container) {
    console.error("❌ Container not found:", containerId);
    return;
  }

  if (complaints.length === 0) {
    console.log("No complaints, showing empty state");
    container.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
        <p>No complaints submitted yet.</p>
      </div>`;
    return;
  }

  console.log("Rendering table with", complaints.length, "complaints");
  
  container.innerHTML = `
    <table class="table-custom">
      <thead>
        <tr>
          <th>ID</th>
          <th>Title</th>
          <th>Category</th>
          <th>Location</th>
          <th>Status</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${complaints.map((c, i) => `
          <tr>
            <td class="text-muted fs-sm">#${String(i + 1).padStart(3, "0")}</td>
            <td class="fw-600">${escHtml(c.title || c.category)}</td>
            <td>${escHtml(c.category)}</td>
            <td class="fs-sm">${escHtml(c.location || "—")}</td>
            <td>${getStatusBadge(c.status)}</td>
            <td class="text-muted fs-sm">${formatDate(c.createdAt)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
    
  console.log("✅ Table rendered successfully");
}

// =============================================
// RENDER ADMIN COMPLAINTS TABLE
// =============================================
export function renderAdminComplaintsTable(complaints, containerId, filterStatus = "all", filterCategory = "all") {
  console.log("=== RENDERING ADMIN COMPLAINTS TABLE ===");
  console.log("Container ID:", containerId);
  console.log("Total complaints:", complaints.length);
  console.log("Filter - Status:", filterStatus, "Category:", filterCategory);
  
  const container = document.getElementById(containerId);
  if (!container) {
    console.error("❌ Container not found:", containerId);
    return;
  }

  let filtered = complaints;
  if (filterStatus !== "all") {
    filtered = filtered.filter(c => c.status === filterStatus);
  }
  if (filterCategory !== "all") {
    filtered = filtered.filter(c => c.category === filterCategory);
  }
  
  console.log("Filtered complaints:", filtered.length);

  if (filtered.length === 0) {
    console.log("No complaints match filter, showing empty state");
    container.innerHTML = `<div class="empty-state"><p>No complaints match the filter.</p></div>`;
    return;
  }

  console.log("Rendering admin table with", filtered.length, "complaints");

  container.innerHTML = `
    <table class="table-custom">
      <thead>
        <tr>
          <th>ID</th>
          <th>Title</th>
          <th>Category</th>
          <th>Location</th>
          <th>Urgency</th>
          <th>User</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map((c, i) => `
          <tr>
            <td class="text-muted fs-sm">#${String(i + 1).padStart(3, "0")}</td>
            <td class="fw-600">${escHtml(c.title || c.category)}</td>
            <td>${escHtml(c.category)}</td>
            <td class="fs-sm">${escHtml(c.location || "—")}</td>
            <td>${getUrgencyBadge(c.urgency)}</td>
            <td class="fs-sm">${escHtml(c.userName || "User")}</td>
            <td>${getStatusBadge(c.status)}</td>
            <td>
              <select class="status-select" data-id="${c.id}" data-owner="${c.userId}" onchange="window.updateComplaintStatus(this)">
                <option ${c.status === "Submitted" ? "selected" : ""}>Submitted</option>
                <option ${c.status === "In Progress" ? "selected" : ""}>In Progress</option>
                <option ${c.status === "Resolved" ? "selected" : ""}>Resolved</option>
              </select>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;

  // Expose to window for inline handlers
  window.updateComplaintStatus = async (select) => {
    const { id, owner } = select.dataset;
    await updateComplaintStatus(id, select.value, owner);
  };
  
  console.log("✅ Admin table rendered successfully");
}

// ---- Helpers ----
function getStatusBadge(status) {
  const map = {
    "Submitted": "badge-submitted",
    "In Progress": "badge-progress",
    "Resolved": "badge-resolved"
  };
  return `<span class="badge-status ${map[status] || 'badge-submitted'}">${status}</span>`;
}

function getUrgencyBadge(urgency) {
  const colors = { Low: "#2e7d32", Medium: "#e65100", High: "#c62828" };
  const color = colors[urgency] || "#666";
  return `<span style="color:${color}; font-weight:600; font-size:0.8rem;">● ${urgency || "—"}</span>`;
}

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}

function escHtml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}