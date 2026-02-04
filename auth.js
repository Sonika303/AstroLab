"use strict";

/* ================= FIREBASE ================= */
firebase.initializeApp({
  apiKey: "AIzaSyALzPqt1EdWG9cWeFf2gZP8Z470D0puPds",
  authDomain: "astrolab-b8956.firebaseapp.com",
  databaseURL: "https://astrolab-b8956-default-rtdb.firebaseio.com",
  projectId: "astrolab-b8956"
});

const auth = firebase.auth();
const db = firebase.database();

/* ================= ELEMENTS ================= */
const formCard = document.getElementById("formCard");
const formTitle = document.getElementById("formTitle");
const submitBtn = document.getElementById("submitBtn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const usernameInput = document.getElementById("username");
const error = document.getElementById("error");

let mode = "login";

/* ================= AUTH STATE ================= */
auth.onAuthStateChanged(user => {
  if (user) {
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui;background:linear-gradient(135deg,#eef2ff,#f8fafc);">
        <div style="background:#fff;padding:32px;border-radius:18px;box-shadow:0 30px 60px rgba(0,0,0,.12);text-align:center;max-width:360px;">
          <h2 style="margin:0 0 12px;">You’re signed in</h2>
          <p style="color:#64748b;margin:0 0 20px;">
            Your account is already active.<br>
            You can safely close this page.
          </p>
          <button onclick="window.close()" style="padding:12px 20px;border-radius:12px;border:none;background:#6366f1;color:#fff;font-weight:600;cursor:pointer;">
            Close
          </button>
        </div>
      </div>
    `;
  }
});

/* ================= UI ================= */
window.openLogin = function () {
  mode = "login";
  formTitle.textContent = "Login";
  submitBtn.textContent = "Login";
  usernameInput.style.display = "none";
  formCard.classList.add("active");
};

window.openSignup = function () {
  mode = "signup";
  formTitle.textContent = "Sign Up";
  submitBtn.textContent = "Create Account";
  usernameInput.style.display = "block";
  formCard.classList.add("active");
};

submitBtn.onclick = () => {
  error.textContent = "";
  mode === "login" ? login() : signup();
};

/* ================= LOGIC ================= */
function signup() {
  const e = emailInput.value.trim();
  const p = passwordInput.value.trim();
  const u = usernameInput.value.trim().toLowerCase();

  if (!e || !p || !u) {
    error.textContent = "All fields required";
    return;
  }

  auth.createUserWithEmailAndPassword(e, p)
    .then(res =>
      db.ref("presence/" + res.user.uid).set({
        username: u,
        role: "client",
        online: false,
        busy: false,
        credits: 20,
        ratePerMinute: 2,
        firstChatUsed: false,
        lastSeen: Date.now()
      })
    )
    .catch(err => error.textContent = err.message);
}

function login() {
  auth.signInWithEmailAndPassword(
    emailInput.value.trim(),
    passwordInput.value.trim()
  ).catch(err => error.textContent = err.message);
}

window.googleLogin = function () {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider)
    .then(res => {
      const u = res.user;
      const ref = db.ref("presence/" + u.uid);
      ref.once("value").then(snap => {
        if (!snap.exists()) {
          ref.set({
            username: "user_" + u.uid.slice(0, 6),
            role: "client",
            online: false,
            busy: false,
            credits: 20,
            ratePerMinute: 2,
            firstChatUsed: false,
            avatar: u.photoURL || "",
            lastSeen: Date.now()
          });
        }
      });
    })
    .catch(err => error.textContent = err.message);
};

window.forgotPassword = function () {
  const e = emailInput.value.trim();
  if (!e) {
    error.textContent = "Enter email first";
    return;
  }
  auth.sendPasswordResetEmail(e)
    .then(() => alert("Password reset email sent"))
    .catch(err => error.textContent = err.message);
};
