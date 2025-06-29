import { auth } from "./firebase-init.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// 🎨 Load saved background styles from admin settings
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

// DOM elements
const coverPage = document.getElementById("coverPage");
const authPanel = document.getElementById("authPanel");
const startBtn = document.getElementById("startBtn");

const signUpForm = document.getElementById("signUpForm");
const loginForm = document.getElementById("loginForm");
const toLoginLink = document.getElementById("toLogin");

// 👉 Toggle from START screen to Sign Up form
startBtn?.addEventListener("click", () => {
  coverPage.style.display = "none";
  authPanel.classList.remove("hidden");
  signUpForm.classList.remove("hidden");
  loginForm.classList.add("hidden");
});

// 👉 Switch to LOGIN form
toLoginLink?.addEventListener("click", (e) => {
  e.preventDefault();
  signUpForm.classList.add("hidden");
  loginForm.classList.remove("hidden");

  // Dynamically add link to go back to Sign Up
  if (!document.getElementById("toSignUp")) {
    const p = document.createElement("p");
    p.innerHTML = `Don't have an account yet? <a href="#" id="toSignUp">Sign Up</a>`;
    loginForm.appendChild(p);

    document.getElementById("toSignUp").addEventListener("click", (e) => {
      e.preventDefault();
      loginForm.classList.add("hidden");
      signUpForm.classList.remove("hidden");
    });
  }
});

// 👉 Sign-Up Form Handler
signUpForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("signUpEmail").value.trim();
  const password = document.getElementById("signUpPassword").value.trim();

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    alert("🎉 Sign-up successful! Now log in.");
    signUpForm.classList.add("hidden");
    loginForm.classList.remove("hidden");
  } catch (err) {
    alert(`❌ Sign-up error: ${err.message}`);
  }
});

// 👉 Login Form Handler
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

// 👉 Show/hide password toggle
document.getElementById("showPassword")?.addEventListener("change", (e) => {
  const pwField = document.getElementById("loginPassword");
  pwField.type = e.target.checked ? "text" : "password";
});
