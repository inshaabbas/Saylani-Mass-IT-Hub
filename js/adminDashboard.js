// =============================================
// adminDashboard.js — Admin Dashboard Controller
// =============================================

import { auth, db } from "./firebase.js";
import { protectPage, logoutUser, showToast } from "./auth.js";
import {
  listenAllLostFound, renderAdminLostFoundTable
} from "./lostfound.js";
import {
  listenAllComplaints, renderAdminComplaintsTable
} from "./complaints.js";
import {
  listenAllVolunteers, renderAdminVolunteersTable
} from "./volunteer.js";
import {
  listenNotifications, renderNotificationBell,
  createNotification, markAllRead, markOneRead
} from "./notifications.js";
import { collection, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ---- State ----
let currentAdmin = null;
let allComplaints = [];
let allLostFound = [];
let unsubscribers = [];
let allUsers = [];

// ---- Filter state ----
let complaintFilter = { status: "all", category: "all" };

// =============================================
// INITIALIZE ADMIN DASHBOARD
// =============================================
async function initAdminDashboard() {
  try {
    console.log("=== INITIALIZING ADMIN DASHBOARD ===");
    
    const userData = await protectPage("admin");
    currentAdmin = userData.user;
    
    console.log("Admin user loaded:", currentAdmin.email);
    console.log("Admin UID:", currentAdmin.uid);

    // Update admin info in UI
    document.getElementById("adminName").textContent = userData.name || "Admin";
    document.getElementById("adminAvatar").textContent = (userData.name || "A")[0].toUpperCase();
    document.getElementById("topbarUser").textContent = userData.name || "Admin";

    // Load stats
    console.log("Loading admin stats...");
    await loadAdminStats();

    // Start real-time listeners
    console.log("Starting real-time listeners...");
    startAdminListeners();

    // Setup navigation
    console.log("Setting up navigation...");
    setupAdminNavigation();

    // Setup filters
    console.log("Setting up filters...");
    setupFilters();

    // Setup global handlers
    console.log("Setting up global handlers...");
    setupGlobals();

    // Logout button
    document.getElementById("logoutBtn")?.addEventListener("click", logoutUser);
    
    console.log("✅ Admin dashboard initialized successfully");

  } catch (err) {
    console.error("❌ Admin dashboard initialization error:", err);
  }
}

// =============================================
// LOAD OVERVIEW STATS
// =============================================
async function loadAdminStats() {
  try {
    const [usersSnap, lfSnap, cSnap, vSnap] = await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(collection(db, "lost_found_items")),
      getDocs(collection(db, "complaints")),
      getDocs(collection(db, "volunteers"))
    ]);

    allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    document.getElementById("statUsers").textContent = allUsers.length;
    document.getElementById("statLFPending").textContent =
      lfSnap.docs.filter(d => d.data().status === "Pending").length;
    document.getElementById("statOpenComplaints").textContent =
      cSnap.docs.filter(d => d.data().status !== "Resolved").length;
    document.getElementById("statVolunteers").textContent = vSnap.size;

  } catch (err) {
    console.error("Admin stats error:", err);
  }
}

// =============================================
// REAL-TIME LISTENERS
// =============================================
function startAdminListeners() {
  // --- Lost & Found ---
  const lfUnsub = listenAllLostFound((items) => {
    allLostFound = items;
    renderAdminLostFoundTable(items, "adminLFTable");
    renderDashboardLFSummary(items.slice(0, 5), "dashboardLFTable");
    document.getElementById("statLFPending").textContent =
      items.filter(i => i.status === "Pending").length;
  });
  unsubscribers.push(lfUnsub);

  // --- Complaints ---
  const cUnsub = listenAllComplaints((items) => {
    console.log("=== ADMIN DASHBOARD: Complaints Updated ===");
    console.log("Total complaints received:", items.length);
    
    allComplaints = items;
    
    // Render main table
    console.log("Rendering adminComplaintsTable with filters:", complaintFilter);
    renderAdminComplaintsTable(items, "adminComplaintsTable",
      complaintFilter.status, complaintFilter.category);
    
    // Render dashboard summary
    console.log("Rendering dashboardComplaintsTable summary");
    renderDashboardComplaintsSummary(items.slice(0, 5), "dashboardComplaintsTable");
    
    // Update stats
    const openCount = items.filter(i => i.status !== "Resolved").length;
    console.log("Open complaints count:", openCount);
    document.getElementById("statOpenComplaints").textContent = openCount;
  });
  unsubscribers.push(cUnsub);

  // --- Volunteers ---
  const vUnsub = listenAllVolunteers((items) => {
    renderAdminVolunteersTable(items, "adminVolunteersTable");
    document.getElementById("statVolunteers").textContent = items.length;
  });
  unsubscribers.push(vUnsub);

  // --- Notifications ---
  if (currentAdmin?.uid) {
    const nUnsub = listenNotifications(currentAdmin.uid, (notifs) => {
      renderNotificationBell(notifs, "notifBadge", "notifDropdown");
    });
    unsubscribers.push(nUnsub);
  }

  // --- Users (real-time) ---
  const usersUnsub = onSnapshot(collection(db, "users"), (snap) => {
    allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    document.getElementById("statUsers").textContent = allUsers.length;
  });
  unsubscribers.push(usersUnsub);
}

// =============================================
// SETUP NAVIGATION
// =============================================
function setupAdminNavigation() {
  const navLinks = document.querySelectorAll(".nav-link[data-section]");
  navLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      navigateAdminTo(link.dataset.section);
    });
  });

  navigateAdminTo("dashboard");
}

function navigateAdminTo(sectionId) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));

  const section = document.getElementById(`section-${sectionId}`);
  if (section) section.classList.add("active");

  const link = document.querySelector(`.nav-link[data-section="${sectionId}"]`);
  if (link) link.classList.add("active");

  const titles = {
    dashboard: "Admin Dashboard",
    users: "Users Management",
    lostfound: "Lost & Found — All Reports",
    complaints: "Complaints Management",
    volunteers: "Volunteer Registrations",
    notifications: "Notifications"
  };
  document.getElementById("pageTitle").textContent = titles[sectionId] || "Dashboard";
}

// =============================================
// FILTER SETUP FOR COMPLAINTS
// =============================================
function setupFilters() {
  const statusFilter = document.getElementById("filterStatus");
  const categoryFilter = document.getElementById("filterCategory");

  if (statusFilter) {
    statusFilter.addEventListener("change", () => {
      complaintFilter.status = statusFilter.value;
      renderAdminComplaintsTable(
        allComplaints, "adminComplaintsTable",
        complaintFilter.status, complaintFilter.category
      );
    });
  }

  if (categoryFilter) {
    categoryFilter.addEventListener("change", () => {
      complaintFilter.category = categoryFilter.value;
      renderAdminComplaintsTable(
        allComplaints, "adminComplaintsTable",
        complaintFilter.status, complaintFilter.category
      );
    });
  }
}

// =============================================
// GLOBAL HANDLERS
// =============================================
function setupGlobals() {
  // Notifications bell
  const bell = document.getElementById("notifBell");
  const dropdown = document.getElementById("notifDropdown");
  if (bell && dropdown) {
    bell.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("show");
    });
    document.addEventListener("click", () => dropdown.classList.remove("show"));
  }

  // Mark all read
  document.getElementById("markAllRead")?.addEventListener("click", () => {
    markAllRead(currentAdmin.uid);
  });

  // Mark single read
  window.markNotifRead = async (id) => await markOneRead(id);

  // Broadcast notification to all users
  const broadcastBtn = document.getElementById("broadcastBtn");
  if (broadcastBtn) {
    broadcastBtn.addEventListener("click", async () => {
      const msg = document.getElementById("broadcastMsg").value.trim();
      if (!msg) return showToast("Please enter a message.", "error");

      const usersSnap = await getDocs(collection(db, "users"));
      const promises = usersSnap.docs
        .filter(d => d.data().role === "user")
        .map(d => createNotification(d.id, msg, "info"));
      await Promise.all(promises);

      document.getElementById("broadcastMsg").value = "";
      showToast("Announcement sent to all users!", "success");
    });
  }
}

// =============================================
// RENDER DASHBOARD SUMMARY TABLES
// =============================================
function renderDashboardComplaintsSummary(complaints, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (complaints.length === 0) {
    container.innerHTML = "<p class='text-muted fs-sm'>No recent complaints.</p>";
    return;
  }

  container.innerHTML = `
    <table class="table-custom">
      <thead>
        <tr>
          <th>Title</th>
          <th>Status</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${complaints.map(c => `
          <tr>
            <td class="fw-600 fs-sm">${escHtml(c.title || c.category)}</td>
            <td>${getStatusBadge(c.status)}</td>
            <td class="text-muted fs-sm">${formatDate(c.createdAt)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderDashboardLFSummary(items, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = "<p class='text-muted fs-sm'>No recent L&F reports.</p>";
    return;
  }

  container.innerHTML = `
    <table class="table-custom">
      <thead>
        <tr>
          <th>Title</th>
          <th>Type</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td class="fw-600 fs-sm">${escHtml(item.title)}</td>
            <td><span class="badge-status ${item.type === 'lost' ? 'badge-pending' : 'badge-found'}">${cap(item.type)}</span></td>
            <td>${getStatusBadge(item.status)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function getStatusBadge(status) {
  const map = {
    "Submitted": "badge-submitted",
    "In Progress": "badge-progress",
    "Resolved": "badge-resolved",
    "Pending": "badge-pending",
    "Found": "badge-found"
  };
  return `<span class="badge-status ${map[status] || 'badge-submitted'}">${status}</span>`;
}

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-PK", { day: "numeric", month: "short" });
}

function escHtml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cap(str) {
  return str ? str[0].toUpperCase() + str.slice(1) : "";
}

// =============================================
// START DASHBOARD
// =============================================
initAdminDashboard();