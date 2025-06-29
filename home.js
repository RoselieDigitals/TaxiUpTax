// -----------------------------------------------------------------------------
//  home.js  –  CLEAN, SYNCED, AND ERROR‑FREE VERSION
// -----------------------------------------------------------------------------
//  ✅ Imports (Firebase Modular SDK v9)
import { auth, db } from "./firebase-init.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  ref,
  onValue,
  update,
  set,
  remove,
  get,
  child,
  push,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
const adminSettingsRef = ref(db, "adminSettings");
onValue(
  adminSettingsRef,
  (snapshot) => {
    const settings = snapshot.val() || {};

    // Apply background color to body
    if (settings.backgroundColor) {
      document.body.style.backgroundColor = settings.backgroundColor;

      // Also apply to the main visible section
      const mainArea = document.querySelector(".main-area");
      if (mainArea) {
        mainArea.style.backgroundColor = settings.backgroundColor;
      }
    }

    // Apply background image if set
    if (settings.backgroundImage) {
      document.body.style.backgroundImage = `url(${settings.backgroundImage})`;
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundRepeat = "no-repeat";
      document.body.style.backgroundAttachment = "fixed";
    } else {
      document.body.style.backgroundImage = "none";
    }
  },
  { onlyOnce: true }
);

// -----------------------------------------------------------------------------
//  SECTION 0  ⟩  GLOBAL STATE & SHORTCUTS
// -----------------------------------------------------------------------------
let viewHistory = []; //   Keeps track of navigation stack
let menuVisible = false; //   Sidebar visibility flag
let homeToggle = 0; //   0 = will open Dashboard, 1 = will toggle sidebar

// DOM caches (resolved after DOMContentLoaded)
let mainArea, sideMenu;

document.addEventListener("DOMContentLoaded", () => {
  mainArea = document.querySelector(".main-area");
  sideMenu = document.getElementById("sideMenu");
});

// Convenience
const auto = (id) => document.getElementById(id);

if (
  window.currentUserPhoto === "https://i.postimg.cc/PJYxtq3x/default-avatar.png"
) {
  window.currentUserPhoto = "https://i.imgur.com/knDbHOH.png";
}
const brokenAvatar = "https://i.postimg.cc/PJYxtq3x/default-avatar.png";
const fallbackAvatar = "https://i.imgur.com/knDbHOH.png";

// Intercept property sets globally
const originalSrc = Object.getOwnPropertyDescriptor(
  HTMLImageElement.prototype,
  "src"
);
Object.defineProperty(HTMLImageElement.prototype, "src", {
  set(value) {
    if (value === brokenAvatar) value = fallbackAvatar;
    originalSrc.set.call(this, value);
  },
  get() {
    return originalSrc.get.call(this);
  },
  configurable: true,
});

// -----------------------------------------------------------------------------
//  SECTION 1  ⟩  NOTIFICATION CORE (unchanged)
// -----------------------------------------------------------------------------
const notifPath = (uid) => `notifications/${uid}`;
function createNotification(uid, data) {
  return push(ref(db, notifPath(uid)), {
    ...data,
    read: false,
    ts: Date.now(),
  });
}
let notifCache = [];

const iconFor = (t) =>
  ({
    "new-feedback": "💬",
    comment: "🗨️",
    reaction: "👍",
    "new-lesson": "📚",
    "new-signup": "🆕",
  }[t] || "🔔");
const timeAgo = (ms) => {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

function buildNotifItem(n) {
  const li = document.createElement("li");
  li.className = `notif-item ${n.read ? "" : "unread"}`;
  li.innerHTML = `<span class="notif-icon">${iconFor(n.type)}</span>
                  <span class="notif-text">${n.message}</span>
                  <time class="notif-time">${timeAgo(n.ts)}</time>`;
  li.onclick = () => {
    if (!n.read)
      update(ref(db, `${notifPath(auth.currentUser.uid)}/${n.id}`), {
        read: true,
      });
    if (n.link) window.location.hash = n.link;
  };
  return li;
}
function listenForNotifications(filter = "all") {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  onValue(ref(db, notifPath(uid)), (snap) => {
    notifCache = [];
    snap.forEach((c) => notifCache.push({ ...c.val(), id: c.key }));
    renderNotifications(filter);
    updateNotifBadge();
  });
}
function markAllAsRead() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const updates = {};
  notifCache.forEach((n) => {
    if (!n.read) updates[`${notifPath(uid)}/${n.id}/read`] = true;
  });
  update(ref(db), updates);
}
function updateNotifBadge() {
  const badge = auto("notifBadge");
  if (!badge) return;
  const unread = notifCache.filter((n) => !n.read).length;
  badge.textContent = unread || "";
  badge.style.display = unread ? "inline-block" : "none";
}

// -----------------------------------------------------------------------------
//  SECTION 2  ⟩  SIDEBAR HELPERS
// -----------------------------------------------------------------------------
function hideSidebar() {
  if (!sideMenu) return;
  if (window.innerWidth <= 768) {
    sideMenu.classList.remove("open");
  } else {
    sideMenu.style.display = "none";
  }
  if (mainArea) {
    mainArea.style.marginLeft = "0";
    mainArea.classList.remove("sidebar-open", "sidebar-hidden");
  }
  menuVisible = false;
}

function toggleSidebar(force) {
  const sideMenu = document.getElementById("sideMenu");
  const mainArea = document.querySelector(".main-area");
  if (!sideMenu || !mainArea) return;

  const willOpen = typeof force !== "undefined" ? force : !menuVisible;

  if (window.innerWidth <= 768) {
    // Mobile layout uses CSS class `.open`
    if (willOpen) {
      sideMenu.classList.add("open");
    } else {
      sideMenu.classList.remove("open");
    }
  } else {
    // Desktop layout uses flex/hide logic
    sideMenu.style.display = willOpen ? "flex" : "none";
    mainArea.style.marginLeft = willOpen ? "220px" : "0";
  }

  menuVisible = willOpen;
}

function resetLayout() {
  const mc = auto("mainContent");
  if (mc) mc.innerHTML = "";
}

// -----------------------------------------------------------------------------
//  SECTION 3  ⟩  NAVIGATION VIEWS
// -----------------------------------------------------------------------------
function showDashboard() {
  hideSidebar();
  resetLayout();
  viewHistory.push("dashboard");
  updateBackBtn();

  const uid = window.currentUserId;
  const userRef = ref(db, `students/${uid}`);
  const quotes = [
    "Believe in yourself and all that you are.",
    "Push yourself, because no one else is going to do it for you.",
    "Every accomplishment starts with the decision to try.",
    "Your only limit is your mind.",
    "Dream it. Wish it. Do it.",
    "Great things never come from comfort zones.",
    "Don’t stop until you’re proud.",
  ];
  const quote = quotes[Math.floor(Math.random() * quotes.length)];

  onValue(userRef, (snap) => {
    const user = snap.val() || {};
    const greet = user.name || "Student";

    auto("mainContent").innerHTML = `
      <div style="padding: 1cm 15px 90px;">
        <h2 style="font-size:28px;text-align:center;margin-bottom:30px;color:#333">Welcome, ${greet}!</h2>
        <div style="max-width:900px;margin:0 auto;background:#fff8e1;border-left:8px solid #ffca28;padding:20px 30px;border-radius:12px;margin-bottom:40px;box-shadow:0 4px 10px rgba(0,0,0,.1)">
          <h3 style="font-size:18px;font-weight:bold;margin-bottom:12px">🌟 Daily Quote</h3>
          <p style="font-size:20px;font-style:italic">${quote}</p>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center">
          ${makeChecklistPanel("lesson", "📘 Lessons")}
          ${makeChecklistPanel("scenario", "📝 Practice Scenarios")}
          ${makeChecklistPanel("exam", "🧪 Exams")}
          ${makeChecklistPanel("answer_key", "✅ Answer Keys")}
        </div>
      </div>`;

    loadChecklistData();
  });
}

function showHome() {
  auto("mainContent").innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:40px;margin-top:2cm">
        <img
          src="https://i.imgur.com/5Po4UJH.png"
          alt="My Lessons"
          style="width:300px;cursor:pointer"
          id="myLessonsBtn"
        />
        <img
          src="https://i.imgur.com/DlzkGZS.png"
          alt="Feedback Community"
          style="width:300px;cursor:pointer"
          id="feedbackCommunityBtn"
        />
      </div>
    `;

  auto("myLessonsBtn")?.addEventListener("click", renderLessonBoard);
  auto("feedbackCommunityBtn")?.addEventListener(
    "click",
    showFeedbackCommunity
  );
}

function toggleBottomHome() {
  if (homeToggle === 0) {
    homeToggle = 1;
    showDashboard();
    toggleSidebar(true); // Force open sidebar on Home tap
  } else {
    homeToggle = 0;
    toggleSidebar(false); // Collapse sidebar when toggling again
  }
}

function updateBackBtn() {
  const btn = auto("backBtn");
  if (!btn) return;
  btn.style.display = viewHistory.length > 1 ? "block" : "none";
}

function goBack() {
  hideSidebar();
  viewHistory.pop(); // current view
  const prev = viewHistory.pop();
  if (prev === "home") showHome();
  else showDashboard();
}

// -----------------------------------------------------------------------------
//  SECTION 4  ⟩  CHECKLIST HELPERS (unchanged)
// -----------------------------------------------------------------------------
function makeChecklistPanel(type, label) {
  return `
    <div id="checklist-${type}" style="background:#8ecae6;padding:20px;width:200px;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,.1)">
      <h4 style="text-align:center;color:white;font-size:20px;font-family:cursive;margin-bottom:10px">${label}</h4>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px"></ul>
    </div>`;
}

function loadChecklistData() {
  const lessonsRef = ref(db, "lessons");
  const progressRef = ref(db, `students/${window.currentUserId}/progress`);
  onValue(lessonsRef, (lSnap) => {
    const lessons = lSnap.val() || {};
    onValue(progressRef, (pSnap) => {
      const progress = pSnap.val() || {};
      const grouped = { lesson: [], scenario: [], exam: [], answer_key: [] };
      Object.values(lessons).forEach((les) => {
        if (progress[les.title] === 100 && grouped[les.type])
          grouped[les.type].push(les.title);
      });
      Object.keys(grouped).forEach((t) => {
        const ul = document.querySelector(`#checklist-${t} ul`);
        if (!ul) return;
        ul.innerHTML = grouped[t]
          .map(
            (tt) =>
              `<li style="background:white;padding:5px 10px;border-radius:8px;display:flex;align-items:center;gap:8px"><span style="color:#f87171;font-size:20px">•</span><span style="font-size:14px">${tt}</span></li>`
          )
          .join("");
      });
    });
  });
}

// -----------------------------------------------------------------------------
//  SECTION 5  ⟩  LESSON LIST (snippet unchanged)
// -----------------------------------------------------------------------------
function showLessonList() {
  const lessonsRef = ref(db, "lessons");
  onValue(lessonsRef, (snap) => {
    const lessons = snap.val() || {};
    const keys = Object.keys(lessons);
    auto("mainContent").innerHTML = `
      <h2 style="margin-bottom:20px">📚 Available Lessons</h2>
      <div id="lessonList" style="max-width:600px;margin:0 auto;text-align:center;padding-bottom:80px">
        ${keys
          .map(
            (k) =>
              `<div class="lessonItem" data-id="${k}" style="cursor:pointer;padding:16px;margin:10px 0;background:#444;color:white;border-radius:12px;font-size:16px;font-weight:bold;transition:background .3s">${lessons[k].title}</div>`
          )
          .join("")}
      </div>`;

    document.querySelectorAll(".lessonItem").forEach((it) => {
      it.onmouseenter = () => (it.style.background = "#333");
      it.onmouseleave = () => (it.style.background = "#444");
      it.onclick = () => {
        viewHistory.push("lessonDetails");
        showLessonDetails(it.dataset.id);
      };
    });
  });
}

// -----------------------------------------------------------------------------
//  SECTION 6  ⟩  EXPORT TO WINDOW
// -----------------------------------------------------------------------------
Object.assign(window, {
  // Navigation
  showDashboard,
  showHome,
  toggleBottomHome,
  goBack,
  // Lessons
  showLessonList,
  // Notifications
  renderNotifications: () => {}, // placeholder – existing in other part
  markAllAsRead,
  listenForNotifications,
  // Utilities
  hideSidebar,
  toggleSidebar,
});

// ✅ Define global service lists once (top of your script)
window.taxiServices = window.taxiServices || [
  { icon: "🧾", label: "Tax Preparation Services" },
  { icon: "💻", label: "Tax Software Provider" },
  { icon: "🏢", label: "Business Formation" },
  { icon: "💰", label: "Business Funding" },
  { icon: "🏦", label: "Business Credit" },
  { icon: "🎓", label: "Business Coaching" },
];

window.seamlessServices = window.seamlessServices || [
  { icon: "☁️", label: "Cloud Based Office" },
  { icon: "📨", label: "Unlimited E-Filing" },
  { icon: "📁", label: "Paperless Office" },
  { icon: "✍️", label: "Remote Signature" },
  { icon: "📱", label: "Branded Mobile App" },
  { icon: "🛠️", label: "Tech Support" },
  { icon: "📢", label: "Marketing Strategies" },
  { icon: "📄", label: "5 Ready‑to‑Post Flyers" },
  { icon: "🎓", label: "Tax Software Training" },
  { icon: "💳", label: "One‑Time Lifetime Pricing" },
  { icon: "🏢", label: "Office & Bank Set Up" },
  { icon: "❌", label: "No Split / Renewal Fees" },
];

function showServices() {
  hideSidebar();
  viewHistory.push("services");

  const isCreator = window.currentUserRole === "creator";
  let taxiServices = window.taxiServices;
  let seamlessServices = window.seamlessServices;

  let title1 = "📌 TAXI UP TAX SERVICES AND MORE";
  let title2 = "🖥️ SEAMLESS TAX SOFTWARE SOLUTION";

  const buildTiles = (arr, section) =>
    arr
      .map(
        (s, i) => `
        <div class="service-card" data-section="${section}" data-index="${i}">
          <div class="service-icon">${s.icon}</div>
          <div class="service-label">${s.label}</div>
          ${
            isCreator
              ? `
            <button class="svc-edit" title="Edit">✏️</button>
            <button class="svc-del" title="Delete">🗑️</button>
          `
              : ""
          }
        </div>
      `
      )
      .join("");

  document.getElementById("mainContent").innerHTML = `
    <div style="position:relative; top:1cm; height:calc(100vh - 160px); overflow-y:auto; padding:0 20px 80px; scrollbar-width:none; -ms-overflow-style:none;">
      <style>
        #mainContent::-webkit-scrollbar { width: 0; background: transparent }
        .service-card { position: relative }
        .svc-edit, .svc-del {
          display: ${isCreator ? "block" : "none"};
          position: absolute;
          top: 8px;
          width: 24px;
          height: 24px;
          border: none;
          background: #fff;
          border-radius: 50%;
          font-size: 12px;
          cursor: pointer;
          line-height: 24px;
        }
        .svc-edit { right: 38px }
        .svc-del { right: 8px }
        .edit-heading {
          cursor: pointer;
          font-size: 18px;
          margin-left: 6px;
        }
      </style>
  
      <h2 style="text-align:center; color:#007bff;">
        <span id="title1">${title1}</span>
        ${
          isCreator
            ? '<button class="edit-heading" onclick="editHeading(\'title1\')">✏️</button>'
            : ""
        }
      </h2>
      <div class="service-grid">${buildTiles(taxiServices, "taxi")}</div>
  
      <h2 style="text-align:center; margin-top:50px; color:#007bff;">
        <span id="title2">${title2}</span>
        ${
          isCreator
            ? '<button class="edit-heading" onclick="editHeading(\'title2\')">✏️</button>'
            : ""
        }
      </h2>
      <div class="service-grid">${buildTiles(
        seamlessServices,
        "seamless"
      )}</div>
  
      <div style="text-align:center; margin-top: 50px;">
        <a href="https://www.facebook.com/Taxiuptaxservicesandmore" target="_blank" style="margin: 0 15px; font-size: 48px;">📘</a>
        <a href="mailto:virginia.hall@taxiuptaxinfo.com" style="margin: 0 15px; font-size: 48px;">✉️</a>
        <a href="tel:+18009745269" style="margin: 0 15px; font-size: 48px;">📞</a>
        <a href="https://www.taxiuptaxinfo.com" target="_blank" style="margin: 0 15px; font-size: 48px;">🌐</a>
  
        <div style="margin-top: 20px; font-size: 18px;">
          <p>📍 1234 South Harris Street Sandersville GA 31082, Sandersville, GA, United States, 31082</p>
          <p style="margin-top: 10px;">📍 217 B Broad Street Wrens Georgia</p>
        </div>
      </div>
    </div>
    `;

  document.getElementById("backBtn").style.display =
    viewHistory.length > 1 ? "block" : "none";

  if (isCreator) {
    document.querySelectorAll(".svc-edit").forEach((btn) => {
      btn.onclick = (e) => {
        const parent = e.target.closest(".service-card");
        const section = parent.dataset.section;
        const index = parseInt(parent.dataset.index);
        const arr =
          section === "taxi" ? window.taxiServices : window.seamlessServices;
        const current = arr[index];
        const newLabel = prompt("Edit service label:", current.label);
        if (newLabel) {
          arr[index].label = newLabel;
          showServices();
        }
      };
    });

    document.querySelectorAll(".svc-del").forEach((btn) => {
      btn.onclick = (e) => {
        const parent = e.target.closest(".service-card");
        const section = parent.dataset.section;
        const index = parseInt(parent.dataset.index);
        const arr =
          section === "taxi" ? window.taxiServices : window.seamlessServices;
        if (confirm("Are you sure you want to delete this service?")) {
          arr.splice(index, 1);
          showServices();
        }
      };
    });
  }

  window.editHeading = (id) => {
    const span = document.getElementById(id);
    const newTitle = prompt("Edit section title:", span.textContent);
    if (newTitle) span.textContent = newTitle;
  };
}
window.showServices = showServices;

function showNotifications() {
  hideSidebar();

  document.getElementById("backBtn").style.display =
    viewHistory.length > 1 ? "block" : "none";

  const main = document.getElementById("mainContent");
  main.innerHTML = `
    <section id="notificationPanel"
      style="margin-top:1cm;height:calc(100vh - 1cm - 80px);
             overflow-y:auto;background:#f2f2f2;padding:0 12px;">
      <header style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;">
        <h2 style="margin:0;">Notifications</h2>
        <div style="display:flex;gap:8px;">
          <select id="notifFilter">
            <option value="all">ALL</option>
            <option value="unread">Unread</option>
          </select>
          <button id="markAllBtn" class="btn-dark">Mark All as Read</button>
        </div>
      </header>
      <ul id="notifList" style="list-style:none;padding:0;margin:0;"></ul>
    </section>
  `;

  document
    .getElementById("notifFilter")
    .addEventListener("change", (e) => renderNotifications(e.target.value));
  document
    .getElementById("markAllBtn")
    .addEventListener("click", markAllAsRead);

  listenForNotifications();
}

function renderNotifications(filter = "all") {
  const ul = document.getElementById("notifList");
  if (!ul) return;
  ul.innerHTML = "";
  (filter === "unread" ? notifCache.filter((n) => !n.read) : notifCache)
    .sort((a, b) => b.ts - a.ts)
    .forEach((n) => ul.appendChild(buildNotifItem(n)));
  updateNotifBadge();
}

window.showNotifications = showNotifications;

function showProfile() {
  resetLayout();
  viewHistory.push("profile");

  const uid = window.currentUserId;
  const userRef = ref(db, `students/${uid}`);
  const progressRef = ref(db, `students/${uid}/progress`);

  onValue(userRef, (snapshot) => {
    const user = snapshot.val() || {};
    const name = user.name || "";
    const email = user.email || "";
    const contact = user.contact || "";
    const country = user.country || "";
    const role = user.role || "student";
    const photo =
      user.photo || "https://i.postimg.cc/PJYxtq3x/default-avatar.png";

    onValue(progressRef, (snap) => {
      const progress = snap.val() || {};
      const totalLessons = Object.keys(progress).length;
      const completed = Object.values(progress).filter(
        (val) => val === 100
      ).length;
      const percentage =
        totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;

      document.getElementById("mainContent").innerHTML = `
        <div style="position: relative; top: 1cm; height: calc(100vh - 160px); overflow-y: auto; scrollbar-width: none; -ms-overflow-style: none; max-width: 700px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.1);">
          <h2 style="text-align:center; color:#007bff;">👤 Profile</h2>

          <div style="display:flex; align-items:center; gap:20px; margin:20px 0;">
            <img src="${photo}" id="profilePic" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 2px solid #007bff;">
            <input type="file" id="uploadPhoto" accept="image/*">
          </div>

          <label><b>Full Name:</b></label>
          <input type="text" id="profileName" value="${name}" style="width:100%; padding:10px; margin-bottom:10px;">

          <label><b>Email:</b></label>
          <input type="email" value="${email}" readonly disabled style="width:100%; padding:10px; margin-bottom:10px; background:#eee;">

          <label><b>Contact Number:</b></label>
          <input type="text" id="profileContact" value="${contact}" style="width:100%; padding:10px; margin-bottom:10px;">

          <label><b>Country:</b></label>
          <input type="text" id="profileCountry" value="${country}" style="width:100%; padding:10px; margin-bottom:10px;">

          <label><b>Role:</b></label>
          <input type="text" value="${role}" readonly disabled style="width:100%; padding:10px; background:#eee;">

          <h3 style="margin-top:30px; color:#333;">📊 Activity Overview</h3>
          <p><b>Lessons Completed:</b> ${completed} / ${totalLessons}</p>
          <p><b>Progress:</b> ${percentage}%</p>
          <div style="height: 10px; background: #ddd; border-radius: 5px; overflow: hidden; margin-bottom: 15px;">
            <div style="width: ${percentage}%; background: #28a745; height: 100%;"></div>
          </div>

          <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px;">
            <button onclick="saveProfileChanges('${uid}')" style="flex:1; background-color: #007bff; color: white; padding: 12px; font-size: 15px; border: none; border-radius: 6px; cursor: pointer;">💾 Save Changes</button>
            <button onclick="promptPasswordChange()" style="flex:1; background-color: #ffc107; color: black; padding: 12px; font-size: 15px; border: none; border-radius: 6px; cursor: pointer;">🔑 Change Password</button>
            <button onclick="confirmDeleteAccount()" style="flex:1; background-color: #dc3545; color: white; padding: 12px; font-size: 15px; border: none; border-radius: 6px; cursor: pointer;">🗑️ Delete Account</button>
            <button onclick="logoutUser()" style="flex:1; background-color: #6c757d; color: white; padding: 12px; font-size: 15px; border: none; border-radius: 6px; cursor: pointer;">🔓 Logout</button>
          </div>
        </div>
      `;

      document
        .getElementById("uploadPhoto")
        .addEventListener("change", function () {
          const file = this.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = function (e) {
            document.getElementById("profilePic").src = e.target.result;
            update(ref(db, `students/${uid}`), { photo: e.target.result });
          };
          reader.readAsDataURL(file);
        });
    });
  });
}

function saveProfileChanges(uid) {
  const name = document.getElementById("profileName").value.trim();
  const contact = document.getElementById("profileContact").value.trim();
  const country = document.getElementById("profileCountry").value.trim();

  update(ref(db, `students/${uid}`), { name, contact, country })
    .then(() => {
      window.currentUserName = name; // ✅ Update the cached name
      alert("✅ Profile updated successfully!");
      showProfile(); // Optional: refresh the profile view
    })
    .catch((err) => {
      alert("❌ Failed to update profile: " + err.message);
    });
}

function promptPasswordChange() {
  const newPass = prompt("Enter your new password:");
  if (newPass && newPass.length >= 6) {
    auth.currentUser
      .updatePassword(newPass)
      .then(() => alert("✅ Password changed!"))
      .catch((err) => alert("❌ Error: " + err.message));
  } else if (newPass) {
    alert("Password must be at least 6 characters.");
  }
}
window.promptPasswordChange = promptPasswordChange;

function confirmDeleteAccount() {
  if (
    confirm(
      "Are you sure you want to delete your account? This cannot be undone."
    )
  ) {
    const uid = window.currentUserId;
    remove(ref(db, `students/${uid}`));
    auth.currentUser
      .delete()
      .then(() => alert("Account deleted."))
      .catch((err) => alert("❌ Error: " + err.message));
  }
}
window.confirmDeleteAccount = confirmDeleteAccount;

function logoutUser() {
  signOut(auth)
    .then(() => {
      localStorage.clear();
      sessionStorage.clear();
      location.replace("index.html?showAuth=1");
    })
    .catch((err) => alert("❌ Logout failed: " + err.message));
}

window.logoutUser = logoutUser;
window.showProfile = showProfile;

function showCreateLesson() {
  if (window.currentUserRole !== "creator") return;

  resetLayout();
  toggleSidebar(false);
  viewHistory.push("createLesson");

  document.getElementById("mainContent").innerHTML = `
      <div style="
        position: relative;
        top: 1cm;
        height: calc(100vh - 160px);
        overflow-y: auto;
        max-width: 700px;
        margin: 0 auto;
        background: white;
        padding: 30px;
        border-radius: 12px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.1);
        scrollbar-width: none;
        -ms-overflow-style: none;">
        <style>
          #mainContent::-webkit-scrollbar {
            width: 0;
            background: transparent;
          }
        </style>
  
        <h2 style="text-align: center; color: #333; margin-bottom: 25px;">📘 Create a New Lesson</h2>
  
        <form id="createLessonForm">
          <label style="font-weight: bold;">Lesson Title:</label>
          <input type="text" id="createTitle" required
                 style="width:100%; padding:10px; margin:10px 0; border:1px solid #ccc; border-radius:6px;" />
  
          <label style="font-weight: bold;">Lesson Description:</label>
          <textarea id="createDescription" required
                    style="width:100%; padding:10px; margin:10px 0; height:120px; border:1px solid #ccc; border-radius:6px;"></textarea>
  
          <label style="font-weight: bold;">External Link (optional):</label>
          <input type="url" id="createUrl"
                 style="width:100%; padding:10px; margin:10px 0; border:1px solid #ccc; border-radius:6px;" />
  
          <label style="font-weight: bold;">Lesson Type:</label>
          <select id="createType" required
                  style="width:100%; padding:10px; margin:10px 0; border:1px solid #ccc; border-radius:6px;">
            <option value="lesson">📘 Lesson</option>
            <option value="scenario">📝 Practice Scenario</option>
            <option value="exam">🧪 Exam</option>
            <option value="answer_key">✅ Answer Key</option>
            <option value="unclassified">📦 Unclassified</option>
          </select>
  
          <label style="font-weight: bold;">Upload Photo or Video (optional):</label>
          <input type="file" id="createFile" accept="image/*,video/*"
                 style="width:100%; margin:10px 0;" />
  
          <button id="createSaveBtn" type="submit"
                  style="width:100%; margin-top:20px; background:#28a745; color:#fff;
                         padding:12px; font-size:16px; font-weight:bold; border:none;
                         border-radius:6px; cursor:pointer;">
            💾 Save Lesson
          </button>
        </form>
      </div>
    `;

  // 🔄 Promisified file reader
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject("Failed to read file");
      reader.readAsDataURL(file);
    });
  }

  // 🧠 Submit handler
  document.getElementById("createLessonForm").onsubmit = async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById("createSaveBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Uploading...";

    const title = document.getElementById("createTitle").value.trim();
    const description = document
      .getElementById("createDescription")
      .value.trim();
    const url = document.getElementById("createUrl").value.trim();
    const type = document.getElementById("createType").value;
    const fileInput = document.getElementById("createFile");
    const file = fileInput.files[0];
    const lessonId = Date.now();

    const lesson = {
      title,
      description,
      url,
      type,
      timestamp: new Date().toISOString(),
    };

    try {
      if (file) {
        const maxSize = 5 * 1024 * 1024;
        const allowedTypes = ["image", "video"];
        const fileType = file.type.split("/")[0];

        if (!allowedTypes.includes(fileType)) {
          alert("⚠️ Only image or video files are allowed.");
          throw new Error("Invalid file type");
        }

        if (file.size > maxSize) {
          alert("⚠️ File is too large. Max 5 MB allowed.");
          throw new Error("File too large");
        }

        lesson.fileData = await readFileAsDataURL(file);
      }

      await set(ref(db, `lessons/${lessonId}`), lesson);
      alert("✅ Lesson created!");
      renderLessonBoard();
    } catch (err) {
      console.error("❌ Failed to create lesson:", err);
      alert("Something went wrong. Please try again.");
      saveBtn.disabled = false;
      saveBtn.textContent = "💾 Save Lesson";
    }
  };
}

/* ----------  CUSTOMER INSIGHT  ---------- */

function showCustomerInsight() {
  if (window.currentUserRole !== "creator") return;

  resetLayout();
  toggleSidebar(false); // Auto-hide sidebar when a tab is clicked
  viewHistory.push("customerInsight");

  const mainContent = document.getElementById("mainContent");
  mainContent.innerHTML = `
  <h2 style="margin-bottom: 20px; color:#000">📊 Customer Insight</h2>

  <div style="display: flex; gap: 10px; margin-bottom: 20px;">
    <button id="showStudentInfoBtn"     style="padding: 8px 14px; background: #007bff; color: white; border: none; border-radius: 6px;">📋 Student Information</button>
    <button id="showProgressAnalyticsBtn" style="padding: 8px 14px; background: #17a2b8; color: white; border: none; border-radius: 6px;">📈 Student Progress Analytics</button>
    <button id="showSalesAnalyticsBtn"   style="padding: 8px 14px; background: #28a745; color: white; border: none; border-radius: 6px;">💰 Sales Analytics</button>
  </div>

  <div id="insightScrollWrapper" class="scrollable-hint" style="overflow-y: auto; height: calc(100vh - 160px); padding-top: 1cm; padding-right: 10px;">
    <div id="insightSubContent">
      <div id="studentTableScroll" class="scrollable-hint" style="padding-bottom: 12px; margin-bottom: 20px;">
        <!-- Student Info Table will be injected here -->
      </div>
    </div>
  </div>
`;

  renderStudentInfo("all");

  document
    .getElementById("showStudentInfoBtn")
    .addEventListener("click", () => {
      const roleFilterEl = document.getElementById("roleFilter");
      const role = roleFilterEl ? roleFilterEl.value : "all";
      renderStudentInfo(role);
    });

  document
    .getElementById("showProgressAnalyticsBtn")
    .addEventListener("click", renderProgressAnalytics);
  document
    .getElementById("showSalesAnalyticsBtn")
    .addEventListener("click", renderSalesAnalytics);
}

let pendingUpdates = {};

/* ----------  STUDENT INFO TABLE  ---------- */

function renderStudentInfo(roleFilter = "all") {
  const container = document.getElementById("insightSubContent"); // ✅ Fixed container target

  container.innerHTML = `
      <div style="margin-bottom: 12px;">
        <label for="roleFilter" style="font-weight: bold; color: black;">Filter by Role:</label>
        <select id="roleFilter" style="padding: 5px;">
          <option value="all">All</option>
          <option value="student">Student</option>
          <option value="creator_admin">Creator/Admin</option>
        </select>
      </div>
  
      <!-- This wrapper creates horizontal scroll if the table overflows -->
      <div id="studentTableScroll" style="overflow-x: auto; margin-bottom: 16px;">
        <div id="studentTableWrapper"><p style="color:#000; font-weight:bold;">Loading student info...</p></div>
      </div>
    `;

  const tableWrapper = document.getElementById("studentTableWrapper");
  const studentsRef = ref(db, "students");

  onValue(
    studentsRef,
    (snapshot) => {
      const data = snapshot.val() || {};

      let tableHTML = `
          <div style="min-height: 100vh;">
            <table style="width:100%; border-collapse: collapse; background: white; color: black;">
              <thead>
                <tr style="background:#333; color:white;">
                  <th style="padding:8px; border:1px solid #ccc;">Name</th>
                  <th style="padding:8px; border:1px solid #ccc;">Email</th>
                  <th style="padding:8px; border:1px solid #ccc;">Signup Date</th>
                  <th style="padding:8px; border:1px solid #ccc;">Progress %</th>
                  <th style="padding:8px; border:1px solid #ccc;">Country</th>
                  <th style="padding:8px; border:1px solid #ccc;">Role</th>
                  <th style="padding:8px; border:1px solid #ccc;">Remarks</th>
                  <th style="padding:8px; border:1px solid #ccc;">Delete</th>
                </tr>
              </thead>
              <tbody>
        `;

      Object.entries(data).forEach(([uid, student]) => {
        const progress = student.progress || {};
        const progressPercent =
          Object.values(progress).reduce((a, b) => a + b, 0) /
          (Object.keys(progress).length || 1);
        const remarks = student.remarks || "";
        const role = student.role || "student";
        const displayRole =
          role === "creator" || role === "admin" ? "creator_admin" : "student";

        if (roleFilter !== "all" && displayRole !== roleFilter) return;

        const bgColor = displayRole === "creator_admin" ? "#f8d7da" : "#d4edda";

        tableHTML += `
            <tr id="row-${uid}" style="background-color:${bgColor};">
              <td style="padding:8px; border:1px solid #ccc;">${
                student.fullName || "-"
              }</td>
              <td style="padding:8px; border:1px solid #ccc;">${
                student.email || "-"
              }</td>
              <td style="padding:8px; border:1px solid #ccc;">${
                student.signupDate || "-"
              }</td>
              <td style="padding:8px; border:1px solid #ccc;">${Math.round(
                progressPercent
              )}%</td>
              <td style="padding:8px; border:1px solid #ccc;">${
                student.country || "-"
              }</td>
              <td style="padding:8px; border:1px solid #ccc;">
                <select onchange="handleRoleChange(this, '${uid}')" style="padding:4px;">
                  <option value="student" ${
                    displayRole === "student" ? "selected" : ""
                  }>Student</option>
                  <option value="creator_admin" ${
                    displayRole === "creator_admin" ? "selected" : ""
                  }>Creator/Admin</option>
                </select>
              </td>
              <td style="padding:8px; border:1px solid #ccc;">
                <input type="text" value="${remarks}" onchange="updateRemarks('${uid}', this.value)" style="width:100%; padding:4px;" />
              </td>
              <td style="padding:8px; border:1px solid #ccc;">
                <button onclick="deleteStudent('${uid}')" style="background:red; color:white; padding:5px 10px; border:none; border-radius:4px;">Delete</button>
              </td>
            </tr>
          `;
      });

      tableHTML += `
              </tbody>
            </table>
            <div style="text-align:center; margin-top: 20px;">
              <button onclick="saveCustomerUpdates()" style="padding:10px 20px; background:#007bff; color:white; border:none; border-radius:6px;">💾 Save Changes</button>
            </div>
          </div>
        `;

      tableWrapper.innerHTML = tableHTML;

      setTimeout(() => {
        const filterEl = document.getElementById("roleFilter");
        filterEl.value = roleFilter;
        filterEl.addEventListener("change", (e) =>
          renderStudentInfo(e.target.value)
        );
      }, 0);
    },
    { onlyOnce: true }
  );
}
window.renderStudentInfo = renderStudentInfo;

// ➕ Additional functions from customer insight tools

function handleRoleChange(selectEl, uid) {
  const newDisplayRole = selectEl.value;
  const confirmed = confirm(
    "Are you sure you want to change this user's role?"
  );
  if (!confirmed) {
    renderStudentInfo(document.getElementById("roleFilter").value);
    return;
  }

  const newTrueRole =
    newDisplayRole === "creator_admin" ? "creator" : "student";
  pendingUpdates[uid] = { ...(pendingUpdates[uid] || {}), role: newTrueRole };

  const row = document.getElementById(`row-${uid}`);
  if (row) {
    row.style.backgroundColor =
      newDisplayRole === "creator_admin" ? "#f8d7da" : "#d4edda";
  }
}
window.handleRoleChange = handleRoleChange;

function updateRemarks(uid, newRemarks) {
  pendingUpdates[uid] = { ...(pendingUpdates[uid] || {}), remarks: newRemarks };
}
window.updateRemarks = updateRemarks;

function saveCustomerUpdates() {
  const updates = Object.entries(pendingUpdates);
  if (updates.length === 0) {
    alert("No changes to save.");
    return;
  }

  updates.forEach(([uid, data]) => {
    update(ref(db, `students/${uid}`), data)
      .then(() => console.log("✅ Updated:", uid))
      .catch((err) => console.error("❌ Failed to update:", uid, err));
  });

  alert("✅ All changes saved.");
  pendingUpdates = {};
  renderStudentInfo(document.getElementById("roleFilter").value);
}
window.saveCustomerUpdates = saveCustomerUpdates;

function deleteStudent(uid) {
  if (confirm("Are you sure you want to delete this student?")) {
    remove(ref(db, `students/${uid}`))
      .then(() => {
        alert("❌ Student deleted.");
        renderStudentInfo(document.getElementById("roleFilter").value);
      })
      .catch((err) => alert("Error: " + err.message));
  }
}
window.deleteStudent = deleteStudent;

function renderProgressAnalytics() {
  const container = document.getElementById("insightSubContent");
  container.innerHTML = `<p style="color:#000; font-weight:bold;">Loading analytics...</p>`;

  const studentsRef = ref(db, "students");
  const adminSettingsRef = ref(db, "adminSettings");

  Promise.all([get(studentsRef), get(adminSettingsRef)]).then(
    ([studentsSnap, adminSnap]) => {
      const students = studentsSnap.val() || {};
      const settings = adminSnap.val() || {};
      const signupAmount = parseFloat(settings.amountPerSignup) || 0;
      const currency = settings.currencySymbol?.split(" ")[0] || "₱";

      let userCount = 0;
      let totalProgress = 0;
      let activeUsers = 0;
      let revenue = 0;

      const deviceCounts = { Mobile: 0, Desktop: 0, Tablet: 0, Unknown: 0 };
      const labels = [];
      const progressData = [];

      Object.values(students).forEach((s) => {
        if (s.email?.includes("testuser") || s.fullName?.includes("Test"))
          return;
        userCount++;
        revenue += signupAmount;
        const progress = s.progress || {};
        const percent =
          Object.values(progress).reduce((a, b) => a + b, 0) /
          (Object.keys(progress).length || 1);
        totalProgress += percent;
        if (percent > 0) activeUsers++;
        labels.push(s.fullName || "-");
        progressData.push(Math.round(percent));

        const device = (s.device || "Unknown").toLowerCase();
        if (device.includes("mobile")) deviceCounts.Mobile++;
        else if (device.includes("tablet")) deviceCounts.Tablet++;
        else if (
          device.includes("desktop") ||
          device.includes("windows") ||
          device.includes("mac")
        )
          deviceCounts.Desktop++;
        else deviceCounts.Unknown++;
      });

      const avgSession = (totalProgress / userCount).toFixed(2);

      container.innerHTML = `
          <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 30px;">
            ${makeStatBox("👤 User Count", userCount, "+3.2%", "#28a745")}
            ${makeStatBox(
              "⏱ Avg Session Duration",
              avgSession + "%",
              "-1.8%",
              "#dc3545"
            )}
            ${makeStatBox("🔥 Active Users", activeUsers, "+7.4%", "#28a745")}
            ${makeStatBox(
              "💰 Revenue",
              currency + revenue.toLocaleString(),
              userCount > 0 ? "+12.9%" : "0%",
              "#28a745"
            )}
          </div>
    
          <div style="display: flex; flex-wrap: wrap; gap: 30px;">
            <div style="flex: 1; min-width: 300px;">
              <canvas id="progressLineChart"></canvas>
            </div>
            <div style="flex: 1; min-width: 300px;">
              <canvas id="deviceBarChart"></canvas>
            </div>
          </div>
        `;

      new Chart(document.getElementById("progressLineChart"), {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Student Progress %",
              data: progressData,
              borderColor: "#007bff",
              backgroundColor: "rgba(0, 123, 255, 0.1)",
              fill: true,
              tension: 0.3,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: true },
          },
        },
      });

      new Chart(document.getElementById("deviceBarChart"), {
        type: "bar",
        data: {
          labels: Object.keys(deviceCounts),
          datasets: [
            {
              label: "Device Acquisition",
              data: Object.values(deviceCounts),
              backgroundColor: ["#28a745", "#007bff", "#ffc107", "#6c757d"],
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
          },
        },
      });
    }
  );
}
window.renderProgressAnalytics = renderProgressAnalytics;

function renderSalesAnalytics() {
  const container = document.getElementById("insightSubContent");
  container.innerHTML = `<p style="color:#000; font-weight:bold;">Loading sales analytics...</p>`;

  const settingsRef = ref(db, "adminSettings");
  const studentsRef = ref(db, "students");

  Promise.all([get(settingsRef), get(studentsRef)]).then(
    ([settingsSnap, studentsSnap]) => {
      const settings = settingsSnap.val() || {};
      const students = studentsSnap.val() || {};
      const resellPrice = parseFloat(settings.resellPrice || 0);
      const resellCount = parseInt(settings.resellCount || 0);
      const salesLog = settings.resellSalesLog || [];
      const currency = settings.currencySymbol?.split(" ")[0] || "₱";

      const totalResellRevenue = resellPrice * resellCount;

      const monthCounts = {};
      Object.values(students).forEach((s) => {
        if (!s.signupDate) return;
        const month = new Date(s.signupDate).toLocaleString("default", {
          month: "short",
          year: "numeric",
        });
        monthCounts[month] = (monthCounts[month] || 0) + 1;
      });
      const monthLabels = Object.keys(monthCounts);
      const monthData = Object.values(monthCounts);

      const dateLabels = salesLog.map((log) => log.date);
      const revenueData = salesLog.map((log) => log.amount);

      container.innerHTML = `
            <div style="overflow-x:auto; padding-bottom:120px;">
              <div style="display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 30px;">
                ${makeStatBox(
                  "💰 Total Resell Revenue",
                  currency + totalResellRevenue.toLocaleString(),
                  "+15%",
                  "#28a745"
                )}
                ${makeStatBox("📦 Resell Count", resellCount, "", "#007bff")}
                ${makeStatBox(
                  "💲 Price Per Resell",
                  currency + resellPrice.toLocaleString(),
                  "",
                  "#ffc107"
                )}
                ${makeStatBox(
                  "📈 Forecasted Revenue",
                  currency + (resellPrice * (resellCount + 2)).toLocaleString(),
                  "+10%",
                  "#17a2b8"
                )}
              </div>
    
              <div style="display: flex; flex-wrap: wrap; gap: 30px;">
                <div style="flex: 1; min-width: 300px;">
                  <canvas id="revenueLineChart"></canvas>
                </div>
                <div style="flex: 1; min-width: 300px;">
                  <canvas id="customersBarChart"></canvas>
                </div>
              </div>
            </div>
          `;

      new Chart(document.getElementById("revenueLineChart"), {
        type: "line",
        data: {
          labels: dateLabels,
          datasets: [
            {
              label: "📅 Revenue Over Time",
              data: revenueData,
              borderColor: "#28a745",
              backgroundColor: "rgba(40, 167, 69, 0.1)",
              fill: true,
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: true } },
        },
      });

      new Chart(document.getElementById("customersBarChart"), {
        type: "bar",
        data: {
          labels: monthLabels,
          datasets: [
            {
              label: "📊 New Customers per Month",
              data: monthData,
              backgroundColor: "#007bff",
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
        },
      });
    }
  );
}
window.renderSalesAnalytics = renderSalesAnalytics;

function makeStatBox(title, value, change, borderColor) {
  const changeColor = change.includes("-") ? "#dc3545" : "#28a745";
  const arrow = change.includes("-") ? "▼" : "▲";
  return `
      <div style="
        flex: 1 1 240px;
        max-width: 100%;
        box-sizing: border-box;
        border: 3px solid ${borderColor};
        padding: 15px;
        border-radius: 8px;
      ">
        <small style="color: #666;">${title}</small>
        <h2 style="margin: 0; font-size: 24px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
          ${value}
        </h2>
        <span style="color: ${changeColor}; font-size: 13px;">
          ${arrow} ${change}
        </span>
      </div>
    `;
}

function renderAdminTools() {
  const container = document.getElementById("mainContent");
  toggleSidebar(false);
  if (!container) return;

  container.innerHTML = `
      <h2 style="color: #000; margin-bottom: 16px; margin-top: 1cm;">🛠 Admin Tools</h2>
  
      <div class="admin-tools-grid">
        <div>
          <label>📷 Change Startup/Cover Page Image URL:</label>
          <input id="startupImageUrl" type="text" placeholder="Enter image URL..." />
        </div>
        <div>
          <label>🖼 Change Background Image URL:</label>
          <input id="backgroundImageUrl" type="text" placeholder="Enter background image URL..." />
        </div>
        <div>
          <label>🎨 Or Choose Background Color:</label>
          <input id="backgroundColor" type="color" />
        </div>
        <div>
          <label>💵 Set Price per Enrolled Student (<span id="currencyLabel1">₱</span>):</label>
          <input id="amountPerSignup" type="number" min="0" />
        </div>
        <div>
          <label>💰 Set Price for Reselling App (<span id="currencyLabel2">₱</span>):</label>
          <input id="resellPrice" type="number" min="0" />
        </div>
        <div>
          <label>📦 Set Resell Count:</label>
          <input id="resellCount" type="number" min="0" />
        </div>
        <div>
          <label>🌍 Choose Currency Preference:</label>
          <select id="currencySymbol" style="padding: 10px; border-radius: 6px; width: 100%;">
            <option value="₱ PHP">₱ PHP</option>
            <option value="$ USD">$ USD</option>
            <option value="€ EUR">€ EUR</option>
            <option value="¥ JPY">¥ JPY</option>
            <option value="₹ INR">₹ INR</option>
          </select>
        </div>
      </div>
  
      <div style="margin-bottom: 20px; text-align:center;">
        <label style="font-weight: bold; color: #000; display:block; margin-bottom:10px;">📈 App Performance Chart:</label>
        <canvas id="appStatusGauge" width="150" height="80" style="margin:auto;"></canvas>
      </div>
  
      <div style="margin-bottom: 20px;">
        <label style="font-weight: bold; color: #000;">⬇️ Download Reports:</label><br>
        <button onclick="downloadCSV('students')" style="margin-right: 10px; padding: 8px 12px;">Download Students CSV</button>
        <button onclick="downloadCSV('sales')" style="padding: 8px 12px;">Download Sales CSV</button>
      </div>
  
      <div style="text-align: center;">
        <button onclick="saveAdminSettings()" style="background-color: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 6px;">💾 Save Admin Settings</button>
      </div>
    `;

  const adminSettingsRef = ref(db, "adminSettings");
  onValue(adminSettingsRef, (snapshot) => {
    const data = snapshot.val() || {};
    document.getElementById("startupImageUrl").value = data.startupImage || "";
    document.getElementById("backgroundImageUrl").value =
      data.backgroundImage || "";
    document.getElementById("backgroundColor").value =
      data.backgroundColor || "#ffffff";
    document.getElementById("amountPerSignup").value =
      data.amountPerSignup || "";
    document.getElementById("resellPrice").value = data.resellPrice || "";
    document.getElementById("resellCount").value = data.resellCount || "";
    document.getElementById("currencySymbol").value =
      data.currencySymbol || "₱ PHP";

    const currency = data.currencySymbol || "₱ PHP";
    const symbolOnly = currency.split(" ")[0];
    document.getElementById("currencyLabel1").textContent = symbolOnly;
    document.getElementById("currencyLabel2").textContent = symbolOnly;

    // Apply styles on load
    if (data.backgroundColor) {
      document.body.style.backgroundColor = data.backgroundColor;
      const mainArea = document.querySelector(".main-area");
      if (mainArea) {
        mainArea.style.backgroundColor = data.backgroundColor;
      }
    }

    if (data.backgroundImage) {
      document.body.style.backgroundImage = `url(${data.backgroundImage})`;
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundRepeat = "no-repeat";
      document.body.style.backgroundAttachment = "fixed";
    } else {
      document.body.style.backgroundImage = "none";
    }

    if (window.appStatusGaugeChart) window.appStatusGaugeChart.destroy();
    const usage = parseFloat(data.usagePercentage || 65);
    const ctx = document.getElementById("appStatusGauge").getContext("2d");

    window.appStatusGaugeChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Used", "Remaining"],
        datasets: [
          {
            data: [usage, 100 - usage],
            backgroundColor: ["#28a745", "#e9ecef"],
            borderWidth: 0,
          },
        ],
      },
      options: {
        cutout: "75%",
        plugins: { legend: { display: false } },
        responsive: false,
      },
    });
  });
}
window.renderAdminTools = renderAdminTools;

function downloadCSV(type) {
  let dataRef;
  let fileName;

  if (type === "students") {
    dataRef = ref(db, "students");
    fileName = "students.csv";
  } else if (type === "sales") {
    dataRef = ref(db, "sales");
    fileName = "sales.csv";
  } else {
    alert("Unknown CSV type.");
    return;
  }

  onValue(
    dataRef,
    (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        alert("No data available to download.");
        return;
      }

      const keys = Object.keys(data);
      const headers = Object.keys(data[keys[0]]);
      const csvRows = [headers.join(",")];

      keys.forEach((key) => {
        const row = headers.map((h) => {
          const val = data[key][h];
          return typeof val === "string" ? `"${val.replace(/"/g, '""')}"` : val;
        });
        csvRows.push(row.join(","));
      });

      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", fileName);
      link.click();
    },
    { onlyOnce: true }
  );
}
window.downloadCSV = downloadCSV;

function saveAdminSettings() {
  const settings = {
    startupImage: document.getElementById("startupImageUrl")?.value || "",
    backgroundImage: document.getElementById("backgroundImageUrl")?.value || "",
    backgroundColor:
      document.getElementById("backgroundColor")?.value || "#ffffff",
    amountPerSignup: document.getElementById("amountPerSignup")?.value || "0",
    resellPrice: document.getElementById("resellPrice")?.value || "0",
    resellCount: document.getElementById("resellCount")?.value || "0",
    currencySymbol: document.getElementById("currencySymbol")?.value || "₱ PHP",
    updatedAt: new Date().toISOString(),
  };

  set(ref(db, "adminSettings"), settings)
    .then(() => {
      alert("✅ Admin settings saved successfully!");
    })
    .catch((err) => {
      alert("❌ Failed to save settings: " + err.message);
    });
}
window.saveAdminSettings = saveAdminSettings;

document.addEventListener("DOMContentLoaded", () => {
  const insightTab = document.querySelector(
    ".menuItem[onclick*='showCustomerInsight']"
  );
  if (insightTab) {
    insightTab.addEventListener("click", showCustomerInsight);
  }
});

function showLessonDetails(lessonId) {
  const lessonRef = ref(db, `lessons/${lessonId}`);
  onValue(
    lessonRef,
    (snapshot) => {
      const lesson = snapshot.val();
      if (!lesson) return;

      const isCreator = ["creator", "admin"].includes(window.currentUserRole);
      const progressRef = ref(db, `students/${window.currentUserId}/progress`);

      document.getElementById(
        "mainContent"
      ).innerHTML = `<div style="position: relative; top: 1cm; height: calc(100vh - 160px); overflow-y: auto; scrollbar-width: none; -ms-overflow-style: none;">
        <style>
          #mainContent::-webkit-scrollbar { display: none; }
        </style>
        <div style="
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
          color: #000;
          text-align: center;
          background: white;
          border-radius: 12px;
        ">
          <h2 style="font-size: 24px; font-weight: bold; color: #007bff; margin-bottom: 16px;">${
            lesson.title
          }</h2>

          ${
            lesson.fileData
              ? `<div style="margin-bottom: 16px;">
              ${
                lesson.fileData.startsWith("data:image")
                  ? `<img src="${lesson.fileData}" style="max-width:100%; border-radius:10px;" />`
                  : `<video controls src="${lesson.fileData}" style="max-width:100%; border-radius:10px;"></video>`
              }
            </div>`
              : ""
          }

          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">${
            lesson.description
          }</p>

          ${
            lesson.url
              ? `<a href="${lesson.url}" target="_blank" style="display: inline-block; background-color: #e6f3ff; color: #007bff; font-weight: bold; padding: 10px 18px; border-radius: 8px; font-size: 16px; text-decoration: none; margin-bottom: 20px;">🔗 Visit Lesson Link</a>`
              : ""
          }

          <div style="margin-top: 20px; display: flex; justify-content: center; gap: 12px;">
            ${
              isCreator
                ? `
              <button onclick="window.showEditLesson('${lessonId}')" style="background-color: #ffc107; color: black; padding: 10px 20px; font-size: 15px; border: none; border-radius: 8px; cursor: pointer;">✏️ Edit</button>
              <button onclick="window.confirmDeleteLesson('${lessonId}', '${lesson.title}')" style="background-color: #dc3545; color: white; padding: 10px 20px; font-size: 15px; border: none; border-radius: 8px; cursor: pointer;">🗑️ Delete</button>`
                : ""
            }
            <button id="markCompleteBtn" style="background-color: #28a745; color: white; padding: 10px 20px; font-size: 15px; border: none; border-radius: 8px; cursor: pointer;">✔️ Mark as Complete</button>
          </div>
        </div>
      </div>`;

      onValue(
        progressRef,
        (snap) => {
          const progressData = snap.val() || {};
          const isComplete = progressData[lesson.title] === 100;
          const btn = document.getElementById("markCompleteBtn");
          if (isComplete) {
            btn.textContent = "Completed";
            btn.disabled = true;
            btn.style.backgroundColor = "#6c757d";
            btn.style.cursor = "default";
          } else {
            btn.addEventListener("click", () => {
              update(progressRef, { [lesson.title]: 100 });
            });
          }
        },
        { onlyOnce: true }
      );
    },
    { onlyOnce: true }
  );
}
window.showLessonDetails = showLessonDetails;

function renderLessonBoard() {
  const container = document.getElementById("mainContent");
  if (!container) return;

  const isCreator = ["creator", "admin"].includes(window.currentUserRole);

  container.innerHTML = `
    <div class="lesson-board-wrapper">
      <style>
        .lesson-board-wrapper {
          margin-top: 1cm;
          height: calc(100vh - 160px);
          overflow-y: auto;
          padding-right: 5px;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .lesson-board-wrapper::-webkit-scrollbar {
          width: 0px;
          background: transparent;
        }
        .lesson-columns-row {
          display: flex;
          gap: 20px;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 30px;
        }
        .lesson-column {
          flex: 1 1 320px;
          max-width: 340px;
          min-height: 400px;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
          padding: 15px;
        }
        .lesson-column h3 {
          text-align: center;
          color: #333;
          font-size: 18px;
          margin-bottom: 10px;
        }
        .lesson-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .lesson-btn {
          padding: 10px;
          border: none;
          border-radius: 6px;
          background: #444;
          color: white;
          cursor: pointer;
          font-size: 14px;
          font-weight: bold;
          transition: background 0.2s;
        }
        .lesson-btn.done {
          background-color: #28a745 !important;
        }
        .lesson-btn:hover {
          background-color: #666;
        }
      </style>

      <h2 style="color: #000; text-align: center; margin-bottom: 25px;">
        📚 Lesson Management Board
      </h2>

      ${
        isCreator
          ? `
        <div class="lesson-columns-row">
          ${makeLessonColumn("lesson", "📘 Lesson")}
          ${makeLessonColumn("scenario", "📝 Practice Scenarios")}
          ${makeLessonColumn("exam", "🧪 Exam")}
        </div>
        <div class="lesson-columns-row">
          ${makeLessonColumn("answer_key", "✅ Answer Key")}
          ${makeLessonColumn("unclassified", "📦 Unclassified Lessons")}
        </div>`
          : `
        <div class="lesson-columns-row">
          ${makeLessonColumn("lesson", "📘 Lesson")}
          ${makeLessonColumn("scenario", "📝 Practice Scenarios")}
        </div>
        <div class="lesson-columns-row">
          ${makeLessonColumn("exam", "🧪 Exam")}
          ${makeLessonColumn("answer_key", "✅ Answer Key")}
        </div>`
      }
    </div>
  `;

  loadAndDisplayLessons();
}

function makeLessonColumn(type, title) {
  return `
    <div id="col-${type}" class="lesson-column"
         ondragover="allowDrop(event)"
         ondrop="dropLesson(event, '${type}')">
      <h3>${title}</h3>
      <div class="lesson-list"></div>
    </div>
  `;
}
let dragAutoScrollInterval;

function allowDrop(e) {
  e.preventDefault();
}

function handleAutoScrollDuringDrag(e) {
  const wrapper = document.querySelector(".lesson-board-wrapper");
  if (!wrapper) return;

  const rect = wrapper.getBoundingClientRect();
  const threshold = 80;
  const scrollSpeed = 10;

  if (e.clientY - rect.top < threshold) {
    wrapper.scrollTop -= scrollSpeed;
  } else if (rect.bottom - e.clientY < threshold) {
    wrapper.scrollTop += scrollSpeed;
  }
}

function dragLesson(e) {
  e.dataTransfer.setData("lessonId", e.target.dataset.id);
  dragAutoScrollInterval = setInterval(() => {
    handleAutoScrollDuringDrag(e);
  }, 50);
  document.addEventListener("dragover", handleAutoScrollDuringDrag);
}

function dropLesson(event, targetType) {
  event.preventDefault();
  const lessonId = event.dataTransfer.getData("lessonId");
  const lessonRef = ref(db, `lessons/${lessonId}`);
  update(lessonRef, { type: targetType })
    .then(() => {
      console.log(`Moved lesson ${lessonId} to ${targetType}`);
      renderLessonBoard();
    })
    .catch((err) => console.error("Drop failed:", err));

  clearInterval(dragAutoScrollInterval);
  document.removeEventListener("dragover", handleAutoScrollDuringDrag);
}
function loadAndDisplayLessons() {
  const lessonRef = ref(db, "lessons");
  const userRef = ref(db, `students/${window.currentUserId}/completedLessons`);

  onValue(userRef, (userSnap) => {
    const completedLessons = userSnap.val() || {};

    onValue(
      lessonRef,
      (snapshot) => {
        const data = snapshot.val() || {};
        const allTypes = [
          "lesson",
          "scenario",
          "exam",
          "answer_key",
          "unclassified",
        ];

        allTypes.forEach((type) => {
          const col = document.querySelector(`#col-${type} .lesson-list`);
          if (col) col.innerHTML = "";
        });

        Object.entries(data).forEach(([id, lesson]) => {
          // 🔐 Ensure new or legacy lessons default to unclassified
          if (!lesson.type) {
            update(ref(db, `lessons/${id}`), { type: "unclassified" });
            lesson.type = "unclassified";
          }

          const type = lesson.type || "unclassified";
          const column = document.querySelector(`#col-${type} .lesson-list`);
          if (!column) return;

          const btn = document.createElement("button");
          btn.textContent = lesson.title || "Untitled";
          btn.className = "lesson-btn";
          btn.dataset.id = id;
          btn.setAttribute("ondragstart", "dragLesson(event)");
          btn.setAttribute("draggable", "true");

          if (completedLessons[id]) {
            btn.classList.add("done");
          }

          btn.onclick = () => window.showLessonDetails(id);
          column.appendChild(btn);
        });
      },
      { onlyOnce: true }
    );
  });
}

// 🔌 Export helpers to window
window.renderLessonBoard = renderLessonBoard;
window.makeLessonColumn = makeLessonColumn;
window.allowDrop = allowDrop;
window.dragLesson = dragLesson;
window.dropLesson = dropLesson;
window.loadAndDisplayLessons = loadAndDisplayLessons;

/* -------- EDIT LESSON -------- */

function showEditLesson(lessonId) {
  const lessonRef = ref(db, `lessons/${lessonId}`);

  onValue(lessonRef, (snapshot) => {
    const lesson = snapshot.val();
    if (!lesson) return;

    /* main edit form */
    document.getElementById("mainContent").innerHTML = `
      <div style="
        position: relative;
        top: 1cm;
        height: calc(100vh - 160px);
        overflow-y: auto;
        max-width: 700px;
        margin: 0 auto;
        background: white;
        padding: 30px;
        border-radius: 12px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.1);
        scrollbar-width: none;
        -ms-overflow-style: none;
      ">
        <style>
          #mainContent::-webkit-scrollbar {
            width: 0;
            background: transparent;
          }
        </style>

        <h2 style="text-align: center; color: #333; margin-bottom: 25px;">✏️ Edit Lesson</h2>

        <form id="editLessonForm">
          <label style="font-weight: bold;">Lesson Title:</label>
          <input type="text" id="editTitle" value="${
            lesson.title || ""
          }" required
                 style="width:100%; padding:10px; margin:10px 0; border:1px solid #ccc; border-radius:6px;" />

          <label style="font-weight: bold;">Lesson Description:</label>
          <textarea id="editDescription" required
                    style="width:100%; padding:10px; margin:10px 0; height:120px; border:1px solid #ccc; border-radius:6px;">
${lesson.description || ""}</textarea>

          <label style="font-weight: bold;">External Link (optional):</label>
          <input type="url" id="editUrl" value="${lesson.url || ""}"
                 style="width:100%; padding:10px; margin:10px 0; border:1px solid #ccc; border-radius:6px;" />

          <label style="font-weight: bold;">Lesson Type:</label>
          <select id="editType" required
                  style="width:100%; padding:10px; margin:10px 0; border:1px solid #ccc; border-radius:6px;">
            <option value="lesson"       ${
              lesson.type === "lesson" ? "selected" : ""
            }>📘 Lesson</option>
            <option value="scenario"     ${
              lesson.type === "scenario" ? "selected" : ""
            }>📝 Practice Scenario</option>
            <option value="exam"         ${
              lesson.type === "exam" ? "selected" : ""
            }>🧪 Exam</option>
            <option value="answer_key"   ${
              lesson.type === "answer_key" ? "selected" : ""
            }>✅ Answer Key</option>
            <option value="unclassified" ${
              lesson.type === "unclassified" ? "selected" : ""
            }>📦 Unclassified</option>
          </select>

          <label style="font-weight: bold;">Upload New File (optional):</label>
          <input type="file" id="editFile" accept="image/*,video/*"
                 style="width:100%; margin:10px 0;" />

          ${
            lesson.fileData
              ? `
                <p style="font-weight:bold; margin-top:10px;">Current Preview:</p>
                ${
                  lesson.fileData.startsWith("data:image")
                    ? `<img src="${lesson.fileData}" style="max-width:100%; border-radius:8px; margin-bottom:10px;" />`
                    : `<video controls src="${lesson.fileData}" style="max-width:100%; border-radius:8px; margin-bottom:10px;"></video>`
                }
              `
              : ""
          }

          <div style="display:flex; gap:10px; margin-top:20px;">
            <button id="saveBtn" type="submit"
                    style="flex:1; background:#007bff; color:#fff; padding:12px;
                           font-size:16px; font-weight:bold; border:none; border-radius:6px; cursor:pointer;">
              💾 Save Changes
            </button>
            <button type="button" onclick="renderLessonBoard()"
                    style="flex:1; background:#dc3545; color:#fff; padding:12px;
                           font-size:16px; font-weight:bold; border:none; border-radius:6px; cursor:pointer;">
              ❌ Cancel
            </button>
          </div>
        </form>
      </div>
    `;

    /* submit handler */
    document.getElementById("editLessonForm").onsubmit = async (e) => {
      e.preventDefault();

      const updatedData = {
        title: document.getElementById("editTitle").value.trim(),
        description: document.getElementById("editDescription").value.trim(),
        url: document.getElementById("editUrl").value.trim(),
        type: document.getElementById("editType").value,
      };

      const fileInput = document.getElementById("editFile");
      const file = fileInput.files[0];
      const saveBtn = document.getElementById("saveBtn");

      saveBtn.disabled = true;
      saveBtn.textContent = "Uploading...";

      /* validate and possibly embed new file */
      if (file) {
        const maxSize = 5 * 1024 * 1024; // 5 MB
        const allowedTypes = ["image", "video"];
        const fileType = file.type.split("/")[0];

        if (!allowedTypes.includes(fileType)) {
          alert("⚠️ Only image or video files are allowed.");
          saveBtn.disabled = false;
          saveBtn.textContent = "💾 Save Changes";
          return;
        }
        if (file.size > maxSize) {
          alert("⚠️ File is too large. Max 5 MB allowed.");
          saveBtn.disabled = false;
          saveBtn.textContent = "💾 Save Changes";
          return;
        }

        const reader = new FileReader();
        reader.onload = async (ev) => {
          updatedData.fileData = ev.target.result;
          await update(ref(db, `lessons/${lessonId}`), updatedData);
          alert("✅ Lesson updated with new file!");
          renderLessonBoard();
        };
        reader.readAsDataURL(file);
      } else {
        await update(ref(db, `lessons/${lessonId}`), updatedData);
        alert("✅ Lesson updated!");
        renderLessonBoard();
      }
    };
  });
}

window.showEditLesson = showEditLesson;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  window.currentUserId = user.uid;

  const userRef = ref(db, `students/${user.uid}`);
  onValue(
    userRef,
    (snap) => {
      const d = snap.val() || {};

      window.currentUserRole = d.role || "student";
      window.currentUserName = d.fullName || "Student";

      // ✅ Basic image fallback — in case d.photoURL is empty or undefined
      const defaultAvatar = "https://i.postimg.cc/PJYxtq3x/default-avatar.png";
      const img = new Image();
      img.src = d.photoURL || defaultAvatar;
      img.onload = () => {
        window.currentUserPhoto = img.src;
      };
      img.onerror = () => {
        window.currentUserPhoto = defaultAvatar;
      };

      // ✅ Ensure sidebar & mainArea exist before manipulating
      const sideMenu = document.getElementById("sideMenu");
      const mainArea = document.querySelector(".main-area");

      if (sideMenu && mainArea) {
        if (window.currentUserRole !== "creator") {
          sideMenu.style.display = "none";
          mainArea.style.marginLeft = "0";
        } else {
          sideMenu.style.display = "flex";
          mainArea.style.marginLeft = "220px";
        }
      }

      // Continue with dashboard setup
      listenForNotifications?.();
      viewHistory.push("dashboard");
      showDashboard?.();
    },
    { onlyOnce: true }
  );
});

document.addEventListener("DOMContentLoaded", () => {
  // 🔗 Hook Customer Insight sidebar menu if present
  const insightTab = document.querySelector(
    ".menuItem[onclick*='showCustomerInsight']"
  );
  if (insightTab) {
    insightTab.addEventListener("click", showCustomerInsight);
  }

  // 🔗 Hook first image on home screen to render board
  const firstImageBtn = document.getElementById("firstImageBtn");
  if (firstImageBtn) {
    firstImageBtn.addEventListener("click", (e) => {
      e.preventDefault();
      renderLessonBoard();
    });
  }

  // 🍔 Hook hamburger button
  const hamburger = document.getElementById("hamburgerBtn");
  if (hamburger) {
    hamburger.addEventListener("click", toggleSidebar);
  }
});
document.addEventListener("DOMContentLoaded", () => {
  auto("topTabHome")?.addEventListener("click", showHome);
  auto("topTabServices")?.addEventListener("click", showServices);

  auto("sidebarDashboard")?.addEventListener("click", showDashboard);
  auto("sidebarCreateLesson")?.addEventListener("click", showCreateLesson);
  auto("sidebarInsight")?.addEventListener("click", showCustomerInsight);
  auto("sidebarAdmin")?.addEventListener("click", renderAdminTools);

  auto("bottomNavHome")?.addEventListener("click", toggleBottomHome);
  auto("bottomNavNotif")?.addEventListener("click", showNotifications);
  auto("bottomNavProfile")?.addEventListener("click", showProfile);

  auto("myLessonsBtn")?.addEventListener("click", renderLessonBoard);
  auto("feedbackCommunityBtn")?.addEventListener(
    "click",
    showFeedbackCommunity
  );
  auto("backBtn")?.addEventListener("click", goBack);
  auto("hamburgerBtn")?.addEventListener("click", toggleSidebar);
});

window.confirmDeleteLesson = (lessonId, lessonTitle) => {
  const confirmed = confirm(
    `Are you sure you want to delete "${lessonTitle}"?\nThis action cannot be undone.`
  );
  if (!confirmed) return;

  remove(ref(db, `lessons/${lessonId}`))
    .then(() => {
      alert("✅ Lesson successfully deleted.");
      showLessonList(); // Fallback to list view
    })
    .catch((err) => {
      alert("Error deleting lesson: " + err.message);
    });
};

function showFeedbackCommunity() {
  hideSidebar();
  resetLayout();
  viewHistory.push("feedbackCommunity");

  const uid = window.currentUserId;
  const role = window.currentUserRole;
  const name = window.currentUserName || "User";
  const rawPhoto = window.currentUserPhoto || "";
  const broken = "https://i.postimg.cc/PJYxtq3x/default-avatar.png";
  const fallback = "https://i.imgur.com/knDbHOH.png";
  const photo = !rawPhoto || rawPhoto === broken ? fallback : rawPhoto;
  const firstName = (name || "").split(" ")[0] || "User";

  const content = document.getElementById("mainContent");
  content.innerHTML = "";

  const container = document.createElement("div");
  container.style = `
      position: relative;
      margin-top: 6vh;
      height: calc(100dvh - 160px);
      overflow-y: auto;
      padding: 0 5vw 100px;
      max-width: 100%;
      scrollbar-width: none;
    `;

  const title = document.createElement("h2");
  title.style.textAlign = "center";
  title.style.color = "#007bff";
  title.textContent = "💬 Feedback Community";
  container.appendChild(title);

  const postBox = document.createElement("div");
  postBox.style = `
      background: #fff;
      padding: 18px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,.12);
      margin-bottom: 28px;
    `;
  postBox.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;">
        <img src="${photo}" style="width:46px;height:46px;border-radius:50%;object-fit:cover;">
        <strong>${name}</strong>
        <button id="closePostBox" style="margin-left:auto;font-size:22px;background:none;border:none;cursor:pointer;">❌</button>
      </div>
      <textarea id="newFeedback" placeholder="What's on your mind, ${firstName}?"
        style="width:100%;padding:12px;margin-top:12px;border:1px solid #ccc;border-radius:8px;min-height:90px;resize:none;"></textarea>
      <div style="display:flex;gap:16px;font-size:26px;margin-top:10px;">
        <input id="postImage" type="file" accept="image/*" style="display:none;">
        <span id="photoIcon" title="Add photo/video" style="cursor:pointer;">🖼️</span>
      </div>
      <div id="previewContainer" style="margin-top:10px;"></div>
      <button id="postFeedback" disabled
        style="margin-top:12px;width:100%;padding:12px;font-size:17px;background:#007bff;
              color:#fff;border:none;border-radius:8px;opacity:.6;cursor:pointer;">Post</button>
    `;
  container.appendChild(postBox);

  const feedbackList = document.createElement("div");
  feedbackList.id = "feedbackList";
  container.appendChild(feedbackList);
  content.appendChild(container);

  document.getElementById("backBtn").style.display =
    viewHistory.length > 1 ? "block" : "none";

  const txt = document.getElementById("newFeedback");
  const imgI = document.getElementById("postImage");
  const btn = document.getElementById("postFeedback");
  const previewContainer = document.getElementById("previewContainer");

  const enable = () => {
    btn.disabled = !(txt.value.trim() || imgI.files.length);
    btn.style.opacity = btn.disabled ? 0.6 : 1;
  };

  txt.addEventListener("input", enable);

  imgI.addEventListener("change", () => {
    enable();
    previewContainer.innerHTML = "";

    const file = imgI.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = document.createElement("img");
        preview.id = "imagePreview";
        preview.src = e.target.result;
        preview.style = "max-width:100%;border-radius:8px;";
        previewContainer.appendChild(preview);
      };
      reader.readAsDataURL(file);
    }
  });

  document
    .getElementById("photoIcon")
    .addEventListener("click", () => imgI.click());

  document.getElementById("closePostBox").addEventListener("click", () => {
    txt.value = "";
    imgI.value = "";
    previewContainer.innerHTML = "";
    enable();
  });

  btn.addEventListener("click", () => {
    const message = txt.value.trim();
    const file = imgI.files[0];
    if (!message && !file) return;

    const save = (imgData) => {
      const pid = Date.now() + "_" + uid;
      const postData = {
        uid,
        name,
        photo,
        message,
        imageData: imgData || null,
        timestamp: Date.now(),
        comments: {},
        reactions: {},
      };

      set(ref(db, `feedbackPosts/${pid}`), postData).then(() => {
        txt.value = "";
        imgI.value = "";
        previewContainer.innerHTML = "";
        enable();

        get(child(ref(db), "students")).then((ss) => {
          ss.forEach((snap) => {
            if (snap.key !== uid) {
              createNotification(snap.key, {
                type: "new-feedback",
                message: `${name} posted new feedback.`,
                link: `#/feedback/${pid}`,
              });
            }
          });
        });
      });
    };

    if (file) {
      const fr = new FileReader();
      fr.onload = (e) => save(e.target.result);
      fr.readAsDataURL(file);
    } else {
      save();
    }
  });

  onValue(ref(db, "feedbackPosts"), (ss) => {
    feedbackList.innerHTML = "";
    const all = ss.val() || {};
    const sorted = Object.entries(all).sort(
      (a, b) => b[1].timestamp - a[1].timestamp
    );
    sorted.forEach(([pid, post]) => renderPost(pid, post));
  });
}

function renderPost(pid, postData) {
  const uid = window.currentUserId;
  const role = window.currentUserRole;
  const feedbackList = document.getElementById("feedbackList");
  if (!feedbackList) return;

  const canDel = role !== "student" || postData.uid === uid;
  const timestampText = new Date(postData.timestamp).toLocaleString();

  // 🛡️ Ultimate avatar protection
  const brokenAvatar = "https://i.postimg.cc/PJYxtq3x/default-avatar.png";
  const fallbackAvatar = "https://i.imgur.com/knDbHOH.png";
  if (!postData.photo || postData.photo === brokenAvatar) {
    postData.photo = fallbackAvatar;
  }

  const wrapper = document.createElement("div");
  wrapper.id = `post_${pid}`;
  wrapper.style = `
      background: #fff;
      padding: 26px;
      border-radius: 14px;
      box-shadow: 0 3px 12px rgba(0,0,0,.12);
      margin-bottom: 28px;
    `;

  const header = document.createElement("div");
  header.style = "display:flex;gap:14px;align-items:center;";

  const img = document.createElement("img");
  img.src = postData.photo;
  img.onerror = () => (img.src = fallbackAvatar);
  img.style = "width:50px;height:50px;border-radius:50%;object-fit:cover;";
  header.appendChild(img);

  const info = document.createElement("div");
  info.innerHTML = `<b style="font-size:18px;">${postData.name}</b><br><small>${timestampText}</small>`;
  header.appendChild(info);

  if (canDel) {
    const delBtn = document.createElement("button");
    delBtn.textContent = "🗑️";
    delBtn.style =
      "margin-left:auto;background:none;border:none;color:red;font-size:20px;cursor:pointer;";
    delBtn.addEventListener("click", () => deleteFeedback(pid));
    header.appendChild(delBtn);
  }

  const message = document.createElement("div");
  message.textContent = postData.message;
  message.style = `
      background:#979788;color:#fff;padding:18px;border-radius:12px;
      font-size:20px;text-align:center;white-space:pre-wrap;margin-top:14px;
    `;

  let preview = null;
  if (postData.imageData) {
    preview = document.createElement("img");
    preview.src = postData.imageData;
    preview.style = "max-width:100%;border-radius:12px;margin-top:14px;";
  }

  const reactVals = Object.values(postData.reactions || {});
  const unique = [...new Set(reactVals)].join(" ");
  const cmtCnt = Object.keys(postData.comments || {}).length;

  const countWrapper = document.createElement("div");
  if (reactVals.length || cmtCnt) {
    countWrapper.innerHTML = `
        <div style="margin-top:6px;font-size:14px;color:#333;display:flex;gap:18px;">
          ${reactVals.length ? `${unique} ${reactVals.length}` : ""}
          ${cmtCnt ? `${cmtCnt} comment${cmtCnt > 1 ? "s" : ""}` : ""}
        </div>
      `;
  }

  const actions = document.createElement("div");
  actions.style =
    "margin-top:14px;font-size:16px;display:flex;gap:22px;color:#007bff;cursor:pointer;font-weight:bold;";

  const likeBtn = document.createElement("span");
  likeBtn.textContent = "👍 Like";
  likeBtn.addEventListener("click", () => {
    const bar = document.getElementById(`reactBar_${pid}`);
    bar.style.display = bar.style.display === "flex" ? "none" : "flex";
  });

  const cmtBtn = document.createElement("span");
  cmtBtn.textContent = "💬 Comment";
  cmtBtn.addEventListener("click", () => {
    document.getElementById(`cmtInput_${pid}`)?.focus();
  });

  actions.appendChild(likeBtn);
  actions.appendChild(cmtBtn);

  if (postData.uid === uid) {
    const editBtn = document.createElement("span");
    editBtn.textContent = "✏️ Edit";
    editBtn.addEventListener("click", () => {
      const t = prompt("Edit your post:", postData.message);
      if (t && t.trim() !== postData.message) {
        update(ref(db, `feedbackPosts/${pid}`), { message: t.trim() });
      }
    });
    actions.appendChild(editBtn);
  }

  const reactBar = document.createElement("div");
  reactBar.id = `reactBar_${pid}`;
  reactBar.style = "display:none;gap:6px;margin-top:6px;font-size:28px;";
  reactBar.classList.add("react-bar");

  ["👍", "❤️", "😆", "😮", "😢", "😡"].forEach((emoji) => {
    const btn = document.createElement("span");
    btn.textContent = emoji;
    btn.addEventListener("click", () => {
      set(ref(db, `feedbackPosts/${pid}/reactions/${uid}`), emoji);
      reactBar.style.display = "none";
    });
    reactBar.appendChild(btn);
  });

  const commentArea = document.createElement("div");
  commentArea.id = `comments_${pid}`;
  commentArea.style.marginTop = "14px";

  Object.entries(postData.comments || {}).forEach(([cid, c]) => {
    commentArea.innerHTML += renderComment(pid, cid, c);
  });

  const inputWrapper = document.createElement("div");
  inputWrapper.style = "display:flex;gap:8px;margin-top:14px;";

  const cInput = document.createElement("input");
  cInput.id = `cmtInput_${pid}`;
  cInput.placeholder = "Write a comment...";
  cInput.style = "flex:1;padding:10px;border:1px solid #ccc;border-radius:8px;";

  const sendBtn = document.createElement("button");
  sendBtn.textContent = "Send";
  sendBtn.style =
    "padding:10px 14px;background:#28a745;color:#fff;border:none;border-radius:8px;";
  sendBtn.addEventListener("click", () => {
    const t = cInput.value.trim();
    if (!t) return;
    const cid = Date.now() + "_" + uid;
    const newComment = {
      uid,
      name: window.currentUserName || "Anonymous",
      text: t,
      timestamp: Date.now(),
    };
    set(ref(db, `feedbackPosts/${pid}/comments/${cid}`), newComment).then(
      () => {
        commentArea.innerHTML += renderComment(pid, cid, newComment);
        cInput.value = "";
      }
    );
  });

  inputWrapper.appendChild(cInput);
  inputWrapper.appendChild(sendBtn);

  wrapper.appendChild(header);
  wrapper.appendChild(message);
  if (preview) wrapper.appendChild(preview);
  if (reactVals.length || cmtCnt) wrapper.appendChild(countWrapper);
  wrapper.appendChild(actions);
  wrapper.appendChild(reactBar);
  wrapper.appendChild(commentArea);
  wrapper.appendChild(inputWrapper);
  feedbackList.prepend(wrapper);

  setTimeout(() => {
    wrapper.querySelectorAll(".edit-comment").forEach((btn) => {
      btn.addEventListener("click", () => {
        const { pid, cid, text } = btn.dataset;
        editComment(pid, cid, text);
      });
    });
    wrapper.querySelectorAll(".delete-comment").forEach((btn) => {
      btn.addEventListener("click", () => {
        const { pid, cid } = btn.dataset;
        deleteComment(pid, cid);
      });
    });
  }, 0);
}

function renderComment(pid, cid, c) {
  const canEdit = c.uid === window.currentUserId;
  const canDel =
    window.currentUserRole !== "student" || c.uid === window.currentUserId;

  const tools = [];
  if (canEdit) {
    tools.push(
      `<button class="edit-comment" data-pid="${pid}" data-cid="${cid}" data-text="${c.text.replace(
        /"/g,
        "&quot;"
      )}">✏️</button>`
    );
  }
  if (canDel) {
    tools.push(
      `<button class="delete-comment" data-pid="${pid}" data-cid="${cid}">🗑️</button>`
    );
  }

  return `
      <div class="comment-block" style="background:#f0f0f0;padding:8px 10px;border-radius:8px;margin-top:8px;display:flex;justify-content:space-between;align-items:center;">
        <div style="flex:1;font-size:14px;">
          <b>${c.name}</b>
          <small>${new Date(c.timestamp).toLocaleString()}</small><br>${c.text}
        </div>
        <div style="display:flex;gap:6px;margin-left:10px;">
          ${tools.join("")}
        </div>
      </div>
    `;
}

function editComment(pid, cid, oldText) {
  const updated = prompt("Edit your comment:", oldText);
  if (updated !== null && updated.trim() !== oldText) {
    update(ref(db, `feedbackPosts/${pid}/comments/${cid}`), {
      text: updated.trim(),
      editedAt: Date.now(),
    });
  }
}

function deleteComment(pid, cid) {
  if (confirm("Delete this comment?")) {
    remove(ref(db, `feedbackPosts/${pid}/comments/${cid}`)).then(() => {
      const el = document
        .querySelector(`[data-pid="${pid}"][data-cid="${cid}"]`)
        ?.closest(".comment-block");
      if (el) el.remove();
    });
  }
}
function deleteFeedback(pid) {
  if (confirm("Delete this post?")) {
    remove(ref(db, `feedbackPosts/${pid}`)).then(() => {
      document.getElementById(`post_${pid}`)?.remove();
    });
  }
}

// 🔐 Global Access – Attach all major functions to window
Object.assign(window, {
  // 🔧 App Navigation
  showDashboard,
  showHome,
  showLessonList,
  showServices,
  goBack,
  toggleBottomHome,

  // 📚 Lesson Management
  renderLessonBoard,
  makeLessonColumn,
  allowDrop,
  dragLesson,
  dropLesson,
  loadAndDisplayLessons,
  showLessonDetails,
  showCreateLesson,
  showEditLesson,
  confirmDeleteLesson,

  // 🛠 Admin Tools
  renderAdminTools,
  saveAdminSettings,
  downloadCSV,
  renderProgressAnalytics,
  renderSalesAnalytics,
  showCustomerInsight,
  saveCustomerUpdates,
  deleteStudent,
  handleRoleChange,
  updateRemarks,

  // 👤 Profile Tools
  showProfile,
  saveProfileChanges,
  promptPasswordChange,
  confirmDeleteAccount,

  // 💬 Feedback Community
  showFeedbackCommunity,
  deleteFeedback,
  editComment,
  deleteComment,

  // 🔔 Notifications
  createNotification,
  renderNotifications,
  markAllAsRead,
  listenForNotifications,
});
const brokenURL = "https://i.postimg.cc/PJYxtq3x/default-avatar.png";
const realURL = window.currentUserPhoto || "https://i.imgur.com/knDbHOH.png";

// Wait until posts are rendered
setTimeout(() => {
  document.querySelectorAll("img").forEach((img) => {
    // If it’s showing the broken default, and the real one is available, swap it in
    if (img.src === brokenURL && realURL !== brokenURL) {
      img.src = realURL;
    }
  });
}, 1000);

async function saveLessonToFirebase(
  title,
  description,
  url,
  fileData,
  lessonId
) {
  try {
    const lesson = {
      title,
      description,
      url: url || null,
      file: fileData || null,
      timestamp: new Date().toISOString(),
    };

    const lessonRef = ref(db, `lessons/${lessonId}`);
    await set(lessonRef, lesson);

    alert("✅ Lesson saved successfully!");
  } catch (error) {
    console.error("❌ Error saving lesson:", error);
    alert("Failed to save lesson. Please try again.");
  }
}

