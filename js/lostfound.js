// =============================================
// lostfound.js – Lost & Found Module  
// User: Submit items, view own posts
// Admin: View all, update status
// Image upload: Cloudinary
// Also handles keyword matching for notifications
// =============================================

import { db } from "./firebase.js";
import { showToast } from "./auth.js";
import { createNotification } from "./notifications.js";
import {
  collection, addDoc, query, where,
  onSnapshot, doc, updateDoc, serverTimestamp, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// =============================================
// CLOUDINARY CONFIG
// =============================================
const CLOUDINARY_CLOUD_NAME = "dvc5boxn8";
const CLOUDINARY_UPLOAD_PRESET = "femhack";
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// =============================================
// UPLOAD IMAGE TO CLOUDINARY
// =============================================
async function uploadToCloudinary(file) {
  try {
    console.log("=== UPLOADING IMAGE TO CLOUDINARY ===");
    console.log("File:", file.name, "Size:", file.size, "bytes");
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("cloud_name", CLOUDINARY_CLOUD_NAME);
    
    console.log("Uploading to:", CLOUDINARY_URL);
    
    const response = await fetch(CLOUDINARY_URL, {
      method: "POST",
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Cloudinary upload failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("✅ Image uploaded successfully!");
    console.log("Image URL:", data.secure_url);
    
    return data.secure_url;
    
  } catch (error) {
    console.error("❌ Cloudinary upload error:", error);
    throw error;
  }
}

// =============================================
// SUBMIT LOST/FOUND ITEM (User)
// =============================================
export async function submitLostFoundItem(userId, userName, formData) {
  try {
    console.log("=== SUBMITTING LOST/FOUND ITEM ===");
    
    let imageURL = "";

    // Upload image to Cloudinary if provided
    const imageFile = formData.get("image");
    if (imageFile && imageFile.size > 0) {
      console.log("Image provided, uploading to Cloudinary...");
      showToast("Uploading image...", "info");
      imageURL = await uploadToCloudinary(imageFile);
      console.log("Image uploaded:", imageURL);
    } else {
      console.log("No image provided");
    }

    // Save to Firestore
    console.log("Saving to Firestore...");
    const itemData = {
      title: formData.get("title"),
      description: formData.get("description"),
      category: formData.get("category"),
      location: formData.get("location"),
      type: formData.get("type"),
      imageURL: imageURL,
      userId: userId,
      userName: userName,
      status: "Pending",
      createdAt: serverTimestamp()
    };
    
    console.log("Item data:", itemData);
    
    const itemRef = await addDoc(collection(db, "lost_found_items"), itemData);
    
    console.log("✅ Item saved with ID:", itemRef.id);
    showToast("Item reported successfully!", "success");

    // Check for keyword matches after submission
    await checkKeywordMatch(itemRef.id, formData.get("title"), userId);

    return true;
  } catch (error) {
    console.error("❌ Lost & Found submit error:", error);
    console.error("Error details:", error.message);
    showToast("Failed to submit. Please try again.", "error");
    return false;
  }
}

// =============================================
// KEYWORD MATCHING
// =============================================
async function checkKeywordMatch(newItemId, newTitle, userId) {
  try {
    const keywords = newTitle.toLowerCase().split(" ").filter(w => w.length > 3);
    if (keywords.length === 0) return;

    const allItems = await getDocs(collection(db, "lost_found_items"));

    allItems.forEach((docSnap) => {
      if (docSnap.id === newItemId) return;
      const item = docSnap.data();
      const itemTitle = item.title.toLowerCase();

      const matched = keywords.some(kw => itemTitle.includes(kw));
      if (matched) {
        createNotification(
          userId,
          `🔍 Possible match found! "${item.title}" may match your report.`,
          "match"
        );
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
// =============================================
export function listenUserLostFound(userId, renderFn) {
  console.log("=== SETTING UP USER LOST & FOUND LISTENER ===");
  console.log("Listening for userId:", userId);
  
  const q = query(
    collection(db, "lost_found_items"),
    where("userId", "==", userId)
  );

  return onSnapshot(q, 
    (snapshot) => {
      console.log("📨 User L&F Snapshot Received");
      console.log("Total documents:", snapshot.size);
      
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      items.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });
      
      console.log("Sorted items:", items.length);
      renderFn(items);
    },
    (error) => {
      console.error("❌ Listen user L&F error:", error);
      renderFn([]);
    }
  );
}

// =============================================
// LISTEN TO ALL ITEMS (Admin only)
// =============================================
export function listenAllLostFound(renderFn) {
  console.log("=== SETTING UP ALL LOST & FOUND LISTENER (ADMIN) ===");
  
  const q = query(collection(db, "lost_found_items"));

  return onSnapshot(q, 
    (snapshot) => {
      console.log("📨 All L&F Snapshot Received (Admin)");
      console.log("Total documents:", snapshot.size);
      
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      items.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });
      
      renderFn(items);
    },
    (error) => {
      console.error("❌ Listen all L&F error:", error);
      renderFn([]);
    }
  );
}

// =============================================
// UPDATE ITEM STATUS (Admin)
// =============================================
export async function updateLostFoundStatus(itemId, newStatus, itemOwnerId) {
  try {
    console.log("=== UPDATING L&F STATUS ===");
    console.log("Item ID:", itemId);
    console.log("New Status:", newStatus);
    
    await updateDoc(doc(db, "lost_found_items", itemId), {
      status: newStatus
    });

    // Notify the item owner with short ID
    const shortId = itemId.slice(0, 8);
    await createNotification(
      itemOwnerId,
      `#${shortId} status updated to "${newStatus}".`,
      "lostfound"
    );

    console.log("✅ Status updated successfully");
    showToast(`Status updated to ${newStatus}`, "success");
  } catch (error) {
    console.error("❌ Update status error:", error);
    showToast("Failed to update status.", "error");
  }
}

// =============================================
// RENDER ITEMS TABLE (User view)
// =============================================
export function renderUserLostFoundTable(items, containerId) {
  console.log("=== RENDERING USER L&F TABLE ===");
  console.log("Container ID:", containerId);
  console.log("Items to render:", items.length);
  
  const container = document.getElementById(containerId);
  if (!container) {
    console.error("❌ Container not found:", containerId);
    return;
  }

  if (items.length === 0) {
    console.log("No items, showing empty state");
    container.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <p>No items reported yet.</p>
      </div>`;
    return;
  }

  console.log("Rendering table with", items.length, "items");

  container.innerHTML = `
    <table class="table-custom">
      <thead>
        <tr>
          <th>Image</th>
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
            <td>
              ${item.imageURL ? 
                `<img src="${item.imageURL}" alt="${escHtml(item.title)}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;" />` 
                : 
                `<div style="width:50px;height:50px;background:#e0e0e0;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:#666;">No Image</div>`
              }
            </td>
            <td class="fw-600">${escHtml(item.title)}</td>
            <td><span class="badge-status ${item.type === 'lost' ? 'badge-pending' : 'badge-found'}">${cap(item.type)}</span></td>
            <td>${escHtml(item.category || "—")}</td>
            <td>${getStatusBadge(item.status)}</td>
            <td class="text-muted fs-sm">${formatDate(item.createdAt)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
    
  console.log("✅ Table rendered successfully");
}

// =============================================
// RENDER ITEMS TABLE (Admin view with actions)
// =============================================
export function renderAdminLostFoundTable(items, containerId) {
  console.log("=== RENDERING ADMIN L&F TABLE ===");
  console.log("Container ID:", containerId);
  console.log("Items:", items.length);
  
  const container = document.getElementById(containerId);
  if (!container) {
    console.error("❌ Container not found:", containerId);
    return;
  }

  if (items.length === 0) {
    console.log("No items, showing empty state");
    container.innerHTML = `<div class="empty-state"><p>No reports yet.</p></div>`;
    return;
  }

  console.log("Rendering admin table");

  container.innerHTML = `
    <table class="table-custom">
      <thead>
        <tr>
          <th>ID</th>
          <th>Image</th>
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
            <td>
              ${item.imageURL ? 
                `<img src="${item.imageURL}" alt="${escHtml(item.title)}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;cursor:pointer;" onclick="window.viewImage('${item.imageURL}')" />` 
                : 
                `<div style="width:50px;height:50px;background:#e0e0e0;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:0.6rem;color:#666;">No Img</div>`
              }
            </td>
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
  
  // Image viewer function
  window.viewImage = (url) => {
    window.open(url, '_blank');
  };
  
  console.log("✅ Admin table rendered successfully");
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