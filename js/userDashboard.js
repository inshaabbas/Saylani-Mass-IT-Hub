// =============================================
// userDashboard.js — User Dashboard Controller
// Controls all sections in user-dashboard.html
// Imports all modules and wires up UI
// =============================================

import { auth, db } from "./firebase.js";
import { protectPage, logoutUser, showToast } from "./auth.js";
import {
  submitLostFoundItem, listenUserLostFound,
  renderUserLostFoundTable
} from "./lostfound.js";
import {
  submitComplaint, listenUserComplaints,
  renderUserComplaintsTable
} from "./complaints.js";
import {
  registerVolunteer, listenUserVolunteers,
  renderUserVolunteersTable, renderEventsGrid, EVENTS
} from "./volunteer.js";
import {
  listenNotifications, renderNotificationBell,
  renderNotificationsList, markAllRead, markOneRead
} from "./notifications.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ---- Current user state ----
let currentUser = null;
let currentUserData = null;
let unsubscribers = []; // Track real-time listeners to clean up

// =============================================
// INITIALIZE DASHBOARD
// =============================================
async function initDashboard() {
  try {
    // 1. Protect page - only "user" role allowed
    currentUserData = await protectPage("user");
    currentUser = currentUserData.user;

    // 2. Update UI with user info
    document.getElementById("userName").textContent = currentUserData.name || "User";
    document.getElementById("userAvatar").textContent = (currentUserData.name || "U")[0].toUpperCase();
    document.getElementById("topbarUser").textContent = currentUserData.name || "User";

    // 3. Load stats
    await loadDashboardStats();

    // 4. Start real-time listeners
    startListeners();

    // 5. Setup navigation
    setupNavigation();

    // 6. Setup forms
    setupForms();

    // 7. Load events grid
    renderEventsGrid("eventsGrid");

    // 8. Expose global functions for inline handlers
    setupGlobals();

  } catch (err) {
    console.error("Dashboard init error:", err);
  }
}

// =============================================
// LOAD STATS FOR DASHBOARD OVERVIEW
// =============================================
async function loadDashboardStats() {
  try {
    // Count user's items across collections
    const [lfSnap, cSnap, vSnap] = await Promise.all([
      getDocs(query(collection(db, "lost_found_items"), where("userId", "==", currentUser.uid))),
      getDocs(query(collection(db, "complaints"), where("userId", "==", currentUser.uid))),
      getDocs(query(collection(db, "volunteers"), where("userId", "==", currentUser.uid)))
    ]);

    document.getElementById("statLF").textContent = lfSnap.size;
    document.getElementById("statComplaints").textContent = cSnap.size;
    document.getElementById("statVolunteer").textContent = vSnap.size;

    // Count unread notifications
    const nSnap = await getDocs(query(
      collection(db, "notifications"),
      where("userId", "==", currentUser.uid),
      where("read", "==", false)
    ));
    document.getElementById("statNotif").textContent = nSnap.size;

  } catch (err) {
    console.error("Stats error:", err);
  }
}

// =============================================
// REAL-TIME LISTENERS (onSnapshot)
// Each listener fires when Firestore data changes
// =============================================
function startListeners() {
  // Lost & Found
  const lfUnsub = listenUserLostFound(currentUser.uid, (items) => {
    renderUserLostFoundTable(items, "lfTable");
    renderActivityFeed(items);
    document.getElementById("statLF").textContent = items.length;
  });
  unsubscribers.push(lfUnsub);

  // Complaints
  const cUnsub = listenUserComplaints(currentUser.uid, (items) => {
    renderUserComplaintsTable(items, "complaintsTable");
    document.getElementById("statComplaints").textContent = items.length;
  });
  unsubscribers.push(cUnsub);

  // Volunteers
  const vUnsub = listenUserVolunteers(currentUser.uid, (items) => {
    renderUserVolunteersTable(items, "volunteersTable");
    document.getElementById("statVolunteer").textContent = items.length;
  });
  unsubscribers.push(vUnsub);

  // Notifications
  const nUnsub = listenNotifications(currentUser.uid, (notifs) => {
    renderNotificationBell(notifs, "notifBadge", "notifDropdown");
    renderNotificationsList(notifs, "notifList");
    const unread = notifs.filter(n => !n.read).length;
    document.getElementById("statNotif").textContent = unread;
  });
  unsubscribers.push(nUnsub);
}

// =============================================
// SETUP SIDEBAR NAVIGATION
// =============================================
function setupNavigation() {
  const navLinks = document.querySelectorAll(".nav-link[data-section]");
  navLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = link.dataset.section;
      navigateTo(target);
    });
  });

  // Default: show dashboard
  navigateTo("dashboard");
}

function navigateTo(sectionId) {
  // Hide all sections
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  // Remove active from nav links
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));

  // Show target section
  const section = document.getElementById(`section-${sectionId}`);
  if (section) section.classList.add("active");

  // Activate nav link
  const navLink = document.querySelector(`.nav-link[data-section="${sectionId}"]`);
  if (navLink) navLink.classList.add("active");

  // Update topbar title
  const titles = {
    dashboard: "Dashboard",
    lostfound: "Lost & Found",
    complaints: "Complaints",
    volunteer: "Volunteer",
    notifications: "Notifications"
  };
  document.getElementById("pageTitle").textContent = titles[sectionId] || "Dashboard";
}

// =============================================
// SETUP ALL FORMS
// =============================================
function setupForms() {
  // --- Lost & Found Form ---
  const lfForm = document.getElementById("lfForm");
  if (lfForm) {
    lfForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(lfForm);
      const btn = lfForm.querySelector("button[type=submit]");
      btn.textContent = "Submitting..."; btn.disabled = true;

      const success = await submitLostFoundItem(
        currentUser.uid, currentUserData.name, formData
      );
      if (success) lfForm.reset();
      btn.textContent = "Report Item"; btn.disabled = false;
    });
  }

  // --- Complaints Form ---
  const cForm = document.getElementById("complaintForm");
  if (cForm) {
    cForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = cForm.querySelector("button[type=submit]");
      btn.textContent = "Submitting..."; btn.disabled = true;

      const success = await submitComplaint(currentUser.uid, currentUserData.name, {
        title: document.getElementById("cTitle").value,
        category: document.getElementById("cCategory").value,
        description: document.getElementById("cDescription").value,
        location: document.getElementById("cLocation").value,
        urgency: document.querySelector('input[name="urgency"]:checked')?.value || "Low"
      });
      if (success) cForm.reset();
      btn.textContent = "Submit Complaint"; btn.disabled = false;
    });
  }

  // --- Volunteer Form ---
  const vForm = document.getElementById("volunteerForm");
  if (vForm) {
    vForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = vForm.querySelector("button[type=submit]");
      btn.textContent = "Registering..."; btn.disabled = true;

      const eventId = document.getElementById("vEvent").value;
      const event = EVENTS.find(ev => ev.id === eventId);

      const success = await registerVolunteer(currentUser.uid, currentUserData.name, {
        name: document.getElementById("vName").value,
        email: document.getElementById("vEmail").value,
        phone: document.getElementById("vPhone").value,
        eventId: eventId,
        eventTitle: event ? event.title : eventId,
        availability: document.getElementById("vAvailability").value,
        skills: document.getElementById("vSkills").value
      });
      if (success) vForm.reset();
      btn.textContent = "Register"; btn.disabled = false;
    });
  }

  // --- Notification bell toggle ---
  const bell = document.getElementById("notifBell");
  const dropdown = document.getElementById("notifDropdown");
  if (bell && dropdown) {
    bell.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("show");
    });
    document.addEventListener("click", () => dropdown.classList.remove("show"));

    // Mark all read button
    const markAllBtn = document.getElementById("markAllRead");
    if (markAllBtn) {
      markAllBtn.addEventListener("click", () => markAllRead(currentUser.uid));
    }
  }
}

// =============================================
// RENDER ACTIVITY FEED ON DASHBOARD
// =============================================
function renderActivityFeed(lfItems) {
  const feed = document.getElementById("activityFeed");
  if (!feed) return;

  const recentItems = lfItems.slice(0, 5);
  if (recentItems.length === 0) {
    feed.innerHTML = `<li class="activity-item"><span class="text-muted fs-sm">No recent activity.</span></li>`;
    return;
  }

  feed.innerHTML = recentItems.map(item => `
    <li class="activity-item">
      <div class="activity-icon ${item.type === 'lost' ? 'orange' : 'green'}">
        ${item.type === 'lost' ? '📦' : '🔍'}
      </div>
      <div class="activity-body">
        <div class="activity-title">${escHtml(item.title)}</div>
        <div class="activity-meta">${formatDate(item.createdAt)}</div>
      </div>
      <span class="badge-status ${item.status === 'Found' ? 'badge-found' : 'badge-pending'}">${item.status}</span>
    </li>
  `).join("");
}

// =============================================
// GLOBAL FUNCTIONS (for onclick attributes in HTML)
// =============================================
function setupGlobals() {
  // Open volunteer modal for a specific event
  window.openVolunteerModal = (eventId, eventTitle) => {
    const modal = document.getElementById("volunteerModal");
    if (!modal) return;

    const vEventSelect = document.getElementById("vEvent");
    if (vEventSelect) {
      for (let opt of vEventSelect.options) {
        if (opt.value === eventId) { opt.selected = true; break; }
      }
    }
    modal.classList.add("show");
    navigateTo("volunteer");
    document.getElementById("volunteerFormCard")?.scrollIntoView({ behavior: "smooth" });
  };

  // Mark single notification read
  window.markNotifRead = async (notifId) => {
    await markOneRead(notifId);
  };

  // Logout button
  document.getElementById("logoutBtn")?.addEventListener("click", () => logoutUser());
}

// ---- Helpers ----
function escHtml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-PK", { day: "numeric", month: "short" });
}

// =============================================
// START THE APP
// =============================================
initDashboard();