// 🧩 Firebase core
import {
  initializeApp,
  getApps,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  onValue,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// 🔐 Load config from localStorage
const savedConfig = localStorage.getItem("firebaseConfig");
if (!savedConfig) {
  alert("Firebase config not found. Please complete the setup.");
  window.location.href = "config-setup.html";
  throw new Error("Missing Firebase config");
}
const firebaseConfig = JSON.parse(savedConfig);

// ⚙️ Initialize Firebase
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// 🎨 Admin-controlled background styling
const adminSettingsRef = ref(db, "adminSettings");
onValue(
  adminSettingsRef,
  (snapshot) => {
    const settings = snapshot.val() || {};
    if (settings.backgroundColor) {
      document.body.style.backgroundColor = settings.backgroundColor;
    }
    if (settings.backgroundImage) {
      document.body.style.backgroundImage = `url(${settings.backgroundImage})`;
      document.body.style.backgroundSize = "cover";
    } else {
      document.body.style.backgroundImage = "none";
    }
  },
  { onlyOnce: true }
);

// DOM references
const coverPage = document.getElementById("coverPage");
const authPanel = document.getElementById("authPanel");
const startBtn = document.getElementById("startBtn");
const toLoginLink = document.getElementById("toLogin");

// 👉 Show Sign-Up form from Cover Page
startBtn?.addEventListener("click", () => {
  coverPage.style.display = "none";
  authPanel.classList.remove("hidden");
  document.getElementById("signUpForm").classList.remove("hidden");
  document.getElementById("loginForm").classList.add("hidden");
});

// 👉 Switch to Login form
toLoginLink?.addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("signUpForm").classList.add("hidden");
  document.getElementById("loginForm").classList.remove("hidden");

  if (!document.getElementById("toSignUp")) {
    const p = document.createElement("p");
    p.innerHTML = `Don't have an account yet? <a href="#" id="toSignUp">Sign Up</a>`;
    document.getElementById("loginForm").appendChild(p);

    document.getElementById("toSignUp").addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("loginForm").classList.add("hidden");
      document.getElementById("signUpForm").classList.remove("hidden");
    });
  }
});

// ✅ Delay form logic until DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const signUpForm = document.getElementById("signUpForm");
  const loginForm = document.getElementById("loginForm");

  // ✅ Sign-Up Handler
  signUpForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullName = document.getElementById("fullName")?.value.trim();
    const email = document.getElementById("signUpEmail")?.value.trim();
    const password = document.getElementById("signUpPassword")?.value.trim();
    const contact = document.getElementById("contactNumber")?.value.trim();
    const country = document.getElementById("country")?.value.trim();

    console.log("📥 Captured full name:", fullName);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      await set(ref(db, `students/${user.uid}`), {
        fullName,
        email,
        contact,
        country,
        role: "student",
        photoURL: "",
      });

      alert("🎉 Account created! You can now log in.");
      signUpForm.classList.add("hidden");
      loginForm.classList.remove("hidden");
    } catch (err) {
      alert(`❌ Sign-up error: ${err.message}`);
    }
  });

  // ✅ Login Handler
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "home.html";
    } catch (err) {
      document.getElementById("loginError").textContent = "❌ " + err.message;
    }
  });

  // 👁️ Show/hide password
  document.getElementById("showPassword")?.addEventListener("change", (e) => {
    const pwField = document.getElementById("loginPassword");
    pwField.type = e.target.checked ? "text" : "password";
  });
});
