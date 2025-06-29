// firebase-init.js
import {
  initializeApp,
  getApps,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";

import {
  getDatabase,
  ref,
  get,
  set,
  update,
  remove,
  child,
  onValue,
  push,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// 🔁 Load Firebase config from localStorage
let savedConfig = localStorage.getItem("firebaseConfig");

if (!savedConfig) {
  alert("Firebase config not found. Please complete the setup.");
  window.location.href = "config-setup.html";
  throw new Error("Missing Firebase config");
}

const firebaseConfig = JSON.parse(savedConfig);

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// ✅ Export everything needed across your app
export { app, auth, db, ref, get, set, update, remove, child, onValue, push };

