/* =========================================================
   🔥 FIREBASE CORE
   ========================================================= */
/* ================= FIREBASE CONFIG ================= */
const firebaseConfig = {
  apiKey: "AIzaSyALzPqt1EdWG9cWeFf2gZP8Z470D0puPds",
  authDomain: "astrolab-b8956.firebaseapp.com",
  databaseURL: "https://astrolab-b8956-default-rtdb.firebaseio.com",
  projectId: "astrolab-b8956",
  storageBucket: "astrolab-b8956.appspot.com",
  messagingSenderId: "83087467626",
  appId: "1:83087467626:web:66f6b648562f5939425613"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

const db = firebase.database();
const requestSound = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
/* ================= ASTROLOGER ACCESS CONTROL ================= */
const ASTROLOGERS = [
  "VIKQOOfZtKbycTuVZDgtyoT2QLu2"
];
requestSound.volume = 0.6;
/* =========================================================
   🧠 GLOBAL RUNTIME STATE
   ========================================================= */
/* ================= STATE ================= */
let userId = null;
let billingActive = false;
let role = "client";
let isConnected = false;
const ROLE_KEY = "astrolab_role";
const ONLINE_KEY = "astrolab_online";
const connectedRef = db.ref(".info/connected");
let chatId = null;
let chatClosing = false;
let partnerId = null;
let typingRef = null;
let typingTimeout = null;
let chatRef = null;
let queueRef = null;
let userCache = {}; // cache usernames
db.ref("presence").on("child_added", snap => {
  const d = snap.val();
  if(!d) return;
userCache[snap.key] = d.username || "User";
userCache[snap.key + "_avatar"] = d.avatar || "";   
userCache[snap.key + "_color"] = d.avatarColor || "#6366f1";
});
db.ref("presence").on("child_changed", snap => {
  const d = snap.val();
  if(!d) return;
userCache[snap.key] = d.username || "User";
userCache[snap.key + "_avatar"] = d.avatar || "";
userCache[snap.key + "_color"] = d.avatarColor || "#6366f1";
});
let creditInterval = null;
let chatStartTime = null;
let chatTimerInterval = null;
/* ================= INITIAL AVATAR ================= */
function createInitialAvatar(name, color){
  const n = (name || "U").trim();
  const parts = n.split(" ");
  const initials =
    parts.length > 1
      ? parts[0][0] + parts[1][0]
      : parts[0][0];

  const bg = color || "#6366f1";

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
    <rect width="100%" height="100%" rx="40" fill="${bg}"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
      font-family="Inter, sans-serif"
      font-size="32"
      fill="#ffffff"
      font-weight="600">
      ${initials.toUpperCase()}
    </text>
  </svg>`;

  return "data:image/svg+xml;base64," + btoa(svg);
}
/* =========================================================
   🧩 DOM ELEMENT REFERENCES
   ========================================================= */
/* ================= ELEMENTS ================= */
const clientView = document.getElementById("clientView");
const astrologerView = document.getElementById("astrologerView");
const chatView = document.getElementById("chatView");
const astrologerList = document.getElementById("astrologerList");
const queueList = document.getElementById("queueList");
const messagesDiv = document.getElementById("messages");
const msgInput = document.getElementById("msgInput");
if(msgInput){
  msgInput.addEventListener("input", () => {
    if(!chatId || !partnerId) return;

    const ref = db.ref(`chats/${chatId}/typing/${userId}`);
    ref.set(true);

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      ref.remove();
    }, 2000);
  });
}
const avatarPreview = document.getElementById("avatarPreview");
const s_name = document.getElementById("s_name");
const s_speciality = document.getElementById("s_speciality");
const s_desc = document.getElementById("s_desc");
const s_experience = document.getElementById("s_experience");
/* =========================================================
   🎨 UI HELPERS & PANELS
   ========================================================= */
/* ================= UI HELPERS ================= */
/* ---------- Settings Panel ---------- */
function toggleSettings(){
  const panel = document.getElementById("settingsPanel");
  if(!panel) return;
  panel.classList.toggle("open");
}
/* ---------- Auth UI ---------- */
function showNotSignedIn(){
  document.body.innerHTML = `
    <div class="auth-block">
      <div class="auth-card">
        <h2>Not Signed In</h2>
        <p>
          You are currently not signed in.<br>
          Please sign in to continue using AstroLab.
        </p>
        <button onclick="window.location.href='auth.html'">
          Sign In
        </button>
      </div>
    </div>
  `;
}
/* ---------- Profile UI ---------- */
function loadProfile(){
  if(!userId) return;

  db.ref("presence/"+userId).once("value").then(snap=>{
    const d = snap.val();
    if(!d) return;

s_name.value = d.username || "";
s_speciality.value = d.speciality || "";
s_experience.value = d.experience || ""; 
const picker = document.getElementById("avatarColorPicker");
if(picker){
  picker.value = d.avatarColor || "#6366f1";
}

   const fallbackAvatar =
  createInitialAvatar(d.username || "User", d.avatarColor);

avatarPreview.src = d.avatar
  ? d.avatar + "&r=" + Date.now()
  : fallbackAvatar;
  });
}
function updateProfile(name){   
const data = {
  username: name,
  speciality: s_speciality.value,
  experience: s_experience.value
};
  db.ref("presence/"+userId).update(data);
}
function saveSettings(){
  if(!userId){
    alert("You are not logged in.");
    return;
  }

  const name = s_name.value.trim().toLowerCase();
  if(!name){
    alert("Name required");
    return;
  }

  const data = {
    username: name,
    speciality: s_speciality.value,
    experience: s_experience.value
  };

  db.ref("presence/"+userId).update(data)
    .then(()=> alert("Settings saved"));
}
function uploadAvatar(file){
  if(!file || !userId) return;

  const storage = firebase.storage();
  const ref = storage.ref(`avatars/${userId}.jpg`);

  ref.put(file)
    .then(()=> ref.getDownloadURL())
    .then(url=>{
      const bustedUrl = url + "?v=" + Date.now();

      return db.ref("presence/"+userId).update({
        avatar: bustedUrl
      }).then(()=>{
        avatarPreview.src = bustedUrl;
        alert("Avatar updated");
      });
    })
    .catch(err=>{
      console.error(err);
      alert("Image upload failed");
    });
}
function saveAvatarColor(){
  if(!userId) return;

  const picker = document.getElementById("avatarColorPicker");
  if(!picker) return;

  const color = picker.value;

  db.ref("presence/"+userId).update({
    avatarColor: color
  }).then(()=>{
    loadProfile();
  });
}
/* =========================================================
   🟢 USER PRESENCE & HEARTBEAT
   ========================================================= */
/* ================= PRESENCE ================= */
/* ---------- Presence Bootstrap ---------- */
function ensurePresence(user){
  if(!user || !user.uid) return;

  const ref = db.ref("presence/" + user.uid);

  ref.once("value").then(snap=>{
    if(snap.exists()) return;

    ref.set({
      username: user.displayName || "user_" + user.uid.slice(0,6),
      avatar: user.photoURL || "",
      avatarColor: "#6366f1",
      role: "client",
      credits: 0,
      ratePerMinute: 1,
      speciality: "",
      experience: "",
      online: false,
      busy: false,
      lastSeen: Date.now()
    });
  });
}
/* ---------- Presence Healing ---------- */
function healPresence(uid){
  if(!uid) return;

  const ref = db.ref("presence/" + uid);

  ref.once("value").then(snap=>{
    if(!snap.exists() || chatId) return;

    const data = snap.val() || {};

    ref.update({
      username: data.username || "user_" + uid.slice(0,6),
      avatar: data.avatar || "",
      credits: data.credits ?? 0,
      ratePerMinute: data.ratePerMinute ?? 1,
      speciality: data.speciality || "",
      description: data.description || "",
      online: data.online ?? false,
      busy: data.busy ?? false,
      role: data.role || "client",
      lastSeen: Date.now()
    });
  });
}
/* ---------- Connection Recovery ---------- */
connectedRef.on("value", snap => {
  if (!userId) return;

  if (snap.val() === true) {
    const ref = db.ref("presence/" + userId);

    ref.update({
      lastSeen: firebase.database.ServerValue.TIMESTAMP
    });

    ref.onDisconnect().update({
      online: false,
      busy: false,
      lastSeen: firebase.database.ServerValue.TIMESTAMP
    });

    // 🔥 If role is astrologer → auto restore online
    db.ref("presence/" + userId + "/role").once("value")
      .then(rSnap => {
        if (rSnap.val() === "astrologer") {
          ref.update({
            online: true
          });
        }
      });
  }
});
/* =========================================================
   🔐 AUTH SESSION & RESTORE
   ========================================================= */
/* ================= AUTH STATE ================= */
auth.onAuthStateChanged(user => {
  if (!user) {
    showNotSignedIn();
    return;
  }
  
userId = user.uid;
// 🔊 Unlock audio on first click
document.body.addEventListener("click", ()=>{
  requestSound.play().then(()=>{
    requestSound.pause();
    requestSound.currentTime = 0;
  }).catch(()=>{});
},{ once:true });
const uidBox = document.getElementById("uidDisplay");
if(uidBox){
  uidBox.textContent = user.uid;
}
ensurePresence(user);
healPresence(user.uid);

if(ASTROLOGERS.includes(user.uid)){
  db.ref("presence/"+user.uid+"/role").set("astrologer");
}

// 🔥 LIVE ONLINE WATCHER
db.ref("presence/" + user.uid + "/online")
  .on("value", snap=>{
    const isOnline = snap.val() === true;

    const txt = document.getElementById("onlineStatusText");
    if(txt) txt.textContent = isOnline ? "Online" : "Offline";

const dot = document.getElementById("statusDot");
if(dot){
  dot.classList.toggle("online", isOnline);
}

    localStorage.setItem(ONLINE_KEY, isOnline ? "1" : "0");

    const toggle = document.getElementById("onlineToggle");
    if(toggle) toggle.checked = isOnline;
  });

db.ref("requestStatus/" + userId).on("child_added", snap=>{
  const data = snap.val();
  const astrologerId = snap.key;

  if(data?.status === "denied"){
    alert("Astrologer denied your request.");

    // 🔥 cleanup so client can re-request
    db.ref("requestStatus/" + userId + "/" + astrologerId).remove();
    db.ref("requests/" + astrologerId + "/" + userId).remove();
  }
});

setInterval(() => {
  healPresence(user.uid);
}, 60000);

  clientView.classList.remove("hidden");
  astrologerView.classList.add("hidden");
  chatView.classList.add("hidden");

setTimeout(loadProfile, 300);
watchCredits();
watchAstroRate();

  // 🔥 RESTORE ONLINE STATE AFTER REFRESH
  const wasOnline = localStorage.getItem(ONLINE_KEY) === "1";
  const savedRole = localStorage.getItem(ROLE_KEY);

  const onlineToggle = document.getElementById("onlineToggle");
  if (onlineToggle) {
    onlineToggle.checked = wasOnline;
  }

if(savedRole === "astrologer"){
  switchRole("astrologer");

  if(wasOnline){
    toggleOnline(true);
  }
}
  const onlineText = document.getElementById("onlineStatusText");
  if (onlineText) {
    onlineText.textContent = wasOnline ? "Online" : "Offline";
  }

if (savedRole) switchRole(savedRole);

if (role === "astrologer") {
  const isOnline = localStorage.getItem(ONLINE_KEY) === "1";
  if (isOnline) startQueueListener();
}

/* 🔥 REALTIME CHAT AUTO OPEN (CLIENT + ASTROLOGER) */
db.ref("chats").on("child_added", snap => {
  const meta = snap.child("meta").val();
  if (!meta) return;

  if (
    meta.active === true &&
    (meta.client === userId || meta.astrologer === userId)
  ) {
    openChat(snap.key);
  }
});

});
/* =========================================================
   🚪 LOGOUT & FULL CLEANUP
   ========================================================= */
/* ================= LOGOUT ================= */
function logout(){
  if(!userId) return;

  // 🔥 stop everything
  stopChatTimer();
  if(creditInterval){
    stopBilling();
  }

  // 🔥 mark offline safely
  db.ref("presence/" + userId).update({
    online: false,
    busy: false,
    lastSeen: Date.now()
  });

  // 🔥 cleanup db + local state
  db.ref("currentChat/" + userId).remove();

  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(ONLINE_KEY);
  if(queueRef) queueRef.off();
  if(chatRef) chatRef.off();
  if(typingRef) typingRef.off();
  auth.signOut().then(() => {
    window.location.href = "auth.html";
  });
}
/* =========================================================
   🎭 ROLE & ONLINE STATE
   ========================================================= */
/* ================= ROLE & ONLINE ================= */
/* ---------- Role Switching ---------- */
function switchRole(r){
  if(!userId) return;

  if(r === "client"){
    clearMyRequests();
  }

  role = r;
  localStorage.setItem(ROLE_KEY, r);

  clientView.classList.toggle("hidden", r !== "client");
  astrologerView.classList.toggle("hidden", r !== "astrologer");

 if(r === "astrologer"){

  if(!ASTROLOGERS.includes(userId)){
    alert("You are not authorized to be an astrologer.");
    return;
  }

  db.ref("presence/"+userId+"/role").set("astrologer");

  const wasOnline = localStorage.getItem(ONLINE_KEY) === "1";
  if(wasOnline){
    toggleOnline(true);
  }
}
}
function applyRole(r){
  role = r;
  localStorage.setItem(ROLE_KEY, r);

  clientView.classList.toggle("hidden", r !== "client");
  astrologerView.classList.toggle("hidden", r !== "astrologer");

  if(!chatId){
    chatView.classList.add("hidden");
  }

  // ⚠️ IMPORTANT:
  // Only update DB role if going ONLINE as astrologer
if(r === "astrologer" && ASTROLOGERS.includes(userId)){
  db.ref("presence/"+userId+"/role").set("astrologer");
}
}
/* ---------- Online Toggle ---------- */
function toggleOnline(isOnline){
  if (!userId) return;

  const ref = db.ref("presence/" + userId);
  localStorage.setItem(ONLINE_KEY, isOnline ? "1" : "0");

  if (isOnline) {
    ref.update({
      online: true,
      busy: false,
      lastSeen: Date.now()
    });

    ref.onDisconnect().update({
      online: false,
      busy: false,
      lastSeen: firebase.database.ServerValue.TIMESTAMP
    });

    startQueueListener();
    document.getElementById("onlineStatusText").textContent = "Online";

  } else {
    // ✅ SAFE to clear when going OFFLINE
    clearMyRequests();
    stopQueueListener();

    ref.onDisconnect().cancel();
    ref.update({
      online: false,
      busy: false,
      lastSeen: Date.now()
    });

    document.getElementById("onlineStatusText").textContent = "Offline";
  }
}
function toggleOnlineBtn(){
  const isOnline = localStorage.getItem(ONLINE_KEY) === "1";
  toggleOnline(!isOnline);
}
  function onOnlineToggleChange(el){
  const isOnline = el.checked;
  toggleOnline(isOnline);
}
/* =========================================================
   📥 CHAT QUEUE SYSTEM
   ========================================================= */
/* ================= QUEUE ================= */
function startQueueListener(){
  queueList.innerHTML = "";

  queueRef = db.ref("requests/" + userId);

  queueRef.off();

  // 🔥 INSTANT REALTIME
  queueRef.on("child_added", snap=>{
    const data = snap.val();
    if(!data) return;

    requestSound.currentTime = 0;
    requestSound.play().catch(()=>{});

    const div = document.createElement("div");
    div.className = "card";
    div.id = "req_" + snap.key;

    div.innerHTML = `
      Request from <strong class="clientName">Loading…</strong><br>
      <button type="button"
        onclick="acceptChat('${snap.key}','${data.client}')">
        Accept
      </button>
      <button type="button"
        style="background:#dc2626"
        onclick="denyChat('${snap.key}')">
        Deny
      </button>
    `;

    queueList.prepend(div); // 🔥 instant top insert

    db.ref("presence/" + data.client + "/username")
      .once("value")
      .then(s=>{
        div.querySelector(".clientName").textContent =
          s.val() || "Client";
      });
  });

  queueRef.on("child_removed", snap=>{
    const el = document.getElementById("req_" + snap.key);
    if(el) el.remove();
  });
}
function stopQueueListener(){ if(queueRef) queueRef.off(); queueList.innerHTML=""; }
/* ---------- Client → Astrologer Requests ---------- */
function requestChat(astrologerId, rate){
  if(!userId){
    alert("You are not logged in.");
    return;
  }

  db.ref("presence/" + userId + "/credits")
    .once("value")
    .then(snap => {
      const credits = snap.val() || 0;

      if(credits < rate){
        alert("Not enough credits for this astrologer");
        return;
      }

      return db.ref("presence/" + astrologerId).once("value");
    })
    .then(snap => {
      if(!snap) return;

      const astro = snap.val();
      if(!astro || astro.online !== true){
        alert("Astrologer is offline");
        return;
      }

      const reqRef = db.ref("requests/" + astrologerId + "/" + userId);

const statusRef = db.ref("requestStatus/" + userId + "/" + astrologerId);

return Promise.all([
  reqRef.once("value"),
  statusRef.once("value")
]).then(([reqSnap, statusSnap])=>{

  if(reqSnap.exists()){
    alert("Request already pending");
    return;
  }

  if(statusSnap.exists()){
    // 🔥 astrologer denied earlier → clear and allow retry
    statusRef.remove();
  }

  return reqRef.set({
    client: userId,
    time: Date.now()
  }).then(()=>{
    alert("Chat request sent");
  });
});
    })
    .catch(err => {
      console.error(err);
      alert("Failed to send chat request");
    });
}
/* ---------- Astrologer Accept / Deny ---------- */
async function acceptChat(queueKey, clientId){
  if(chatId) return;

  const astroRef = db.ref("presence/"+userId);

  const lockResult = await astroRef.child("busy").transaction(busy=>{
    if(busy === true) return;
    return true;
  });

  if(!lockResult.committed){
    alert("You are already in chat");
    return;
  }

  try{
    chatId = db.ref("chats").push().key;
    chatStartTime = Date.now(); // ✅ FIXED
    partnerId = clientId;

await db.ref("chats/"+chatId+"/meta").set({
  astrologer: userId,
  client: clientId,
  started: chatStartTime,
  active: true,
  earned: 0
});

await db.ref("presence/"+userId).update({ busy:true });
await db.ref("presence/"+clientId).update({ busy:true });
await db.ref("requests/"+userId+"/"+queueKey).remove();
await db.ref("requests").once("value").then(snap=>{
  snap.forEach(a=>{
    if(a.child(clientId).exists()){
      db.ref("requests/"+a.key+"/"+clientId).remove();
    }
  });
});
await db.ref("requestStatus/" + clientId + "/" + userId).remove();
     
openChat(chatId);



  } catch(err){
    console.error(err);

    await astroRef.update({ busy:false });

    chatId = null;
    partnerId = null;
    chatStartTime = null;
if(role === "astrologer" && userId){
  db.ref("presence/"+userId).update({ busy:false });
}

    alert("Failed to start chat. Try again.");
  }
}
function denyChat(queueKey){
  if(!userId) return;

  const clientId = queueKey;

  // notify client
  db.ref("requestStatus/" + clientId + "/" + userId).set({
    status: "denied",
    time: Date.now()
  });

  // remove queue
  db.ref("requests/" + userId + "/" + queueKey).remove();

  // auto-clean after 3 seconds
  setTimeout(()=>{
    db.ref("requestStatus/" + clientId + "/" + userId).remove();
  }, 3000);
}
/* ---------- Queue Cleanup ---------- */
function clearMyRequests(){
  if(!userId) return;

  // remove incoming requests (astrologer)
  db.ref("requests/" + userId).remove();

  // remove outgoing requests (client)
  db.ref("requests").once("value").then(snap=>{
    snap.forEach(astro=>{
      if(astro.child(userId).exists()){
        db.ref("requests/" + astro.key + "/" + userId).remove();
      }
    });
  });
}
/* =========================================================
   💬 CHAT CORE ENGINE
   ========================================================= */
/* ================= CHAT CORE ================= */
/* ---------- Open & Sync Chat ---------- */
function openChat(id){
  if(chatId && chatId !== id){
  return;
}
  if(chatId && chatId === id && chatView.classList.contains("hidden") === false){
  return;
}
  chatId = id;

  clientView.classList.add("hidden");
  astrologerView.classList.add("hidden");
  chatView.classList.remove("hidden");
  messagesDiv.innerHTML = "";

  const metaRef = db.ref("chats/"+id+"/meta");

metaRef.on("value", snap=>{
  const meta = snap.val();
  if(!meta) return;

  // 🔴 CHAT ENDED (ONLY PLACE THAT ENDS CHAT)
  if(meta.active === false){
    metaRef.off();

    if(role === "astrologer"){
      db.ref("presence/"+userId).update({ busy:false });
    }

    forceCloseChat(meta.endReason || "Chat ended");
    return;
  }

  // 🟢 CHAT ACTIVE
  partnerId =
    meta.client === userId ? meta.astrologer : meta.client;

  // ⏱ TIMER (SET ONCE)
  if(!chatStartTime && meta.started){
    chatStartTime = meta.started;
    startChatTimer();
  }

if(
  role === "astrologer" &&
  !billingActive &&
  meta.active === true &&
  chatStartTime
){
  if(meta.client && meta.astrologer){
    startCreditTimer(meta.client, meta.astrologer);
  } else {
    console.warn("Cannot start billing: invalid client or astrologer ID", meta);
  }
}
  // ⏱ ensure timer + billing start reliably
if(!chatStartTime && meta.started){
  chatStartTime = meta.started;
  startChatTimer();

  if(role === "astrologer" && !billingActive){
    startCreditTimer(meta.client, meta.astrologer);
  }
}
});

  if(chatRef) chatRef.off();
  chatRef = db.ref("chats/"+id+"/messages");

chatRef.on("child_added", snap=>{
  const msg = snap.val();
  const div = document.createElement("div");
div.className = "message " + (msg.from === userId ? "self" : "");
div.style.opacity = "0";
div.style.transform = "translateY(10px)";

  const name = document.createElement("div");
  name.style.fontSize = "12px";
  name.style.opacity = ".7";
  name.textContent = userCache[msg.from] || "User";
  div.appendChild(name);

  if(msg.text){
    const text = document.createElement("div");
    text.textContent = msg.text;
    div.appendChild(text);
  }

  messagesDiv.appendChild(div);
  setTimeout(()=>{
    div.style.transition = "all .3s ease";
    div.style.opacity = "1";
    div.style.transform = "translateY(0)";
},50);
  messagesDiv.scrollTo({
    top: messagesDiv.scrollHeight,
    behavior:"smooth"
  });
});

// 🔥 TYPING LISTENER
if(typingRef) typingRef.off();

typingRef = db.ref("chats/"+id+"/typing");

typingRef.on("value", snap=>{
  const data = snap.val();
  const box = document.getElementById("typingIndicator");

  if(!box) return;

  if(!data){
    box.textContent = "";
    return;
  }

  const othersTyping = Object.keys(data).filter(uid => uid !== userId);

  if(othersTyping.length > 0){
    box.textContent = "Typing...";
  } else {
    box.textContent = "";
  }
});
}
/* ---------- Messaging ---------- */
function sendMessage(){
  if(!chatId) return;

  const text = msgInput.value.trim();
  if(!text) return;

  db.ref("chats/"+chatId+"/messages").push({
    from:userId,
    text,
    time:Date.now()
  });

  db.ref(`chats/${chatId}/typing/${userId}`).remove();
  msgInput.value = "";
}
let recognition = null;

function startSpeech(){
  if(!('webkitSpeechRecognition' in window)){
    alert("Speech recognition not supported");
    return;
  }

  if(!recognition){
    recognition = new webkitSpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = function(event){
      const transcript = event.results[0][0].transcript;
      msgInput.value = transcript;
    };
  }

  recognition.start();
}
function endChat(){
  if(!chatId) return;

  const reason =
    role === "astrologer"
      ? "Chat ended by astrologer"
      : "Chat ended by client";

  db.ref("chats/"+chatId+"/meta").update({
    active: false,
    endReason: reason,
    endedAt: Date.now()
  });
}
function exitChat(){
  if(!chatId) return;

  const reason =
    role === "astrologer"
      ? "Chat ended by astrologer"
      : "Chat ended by client";

  db.ref("chats/"+chatId+"/meta").update({
    active: false,
    endReason: reason,
    endedAt: Date.now()
  });
}
/* ---------- FORCE CLOSE CHAT (CRITICAL) ---------- */
function forceCloseChat(message){
  stopBilling();
  if(chatClosing) return;
  if(!chatId) return;
  chatClosing = true;
  stopChatTimer();

  // ✅ SAVE CHAT ID ONCE
  const endedChatId = chatId;

  // ✅ minimum 1-minute earning for astrologer
  if(chatStartTime && role === "astrologer" && endedChatId){
    const elapsed = Date.now() - chatStartTime;
    if(elapsed < 60000){
      db.ref("chats/"+endedChatId+"/meta/earned")
        .transaction(e => (e || 0) + 1);
    }
  }

  // 🔥 cleanup listeners
  if(chatRef){
    chatRef.off();
    chatRef = null;
  }

  if(typingRef){
    typingRef.off();
    typingRef = null;
  }

  if(endedChatId){
    db.ref(`chats/${endedChatId}/typing/${userId}`).remove();
  }

  chatId = null;
  partnerId = null;
  // 🔥 DELETE ENTIRE CHAT NODE
if(endedChatId){
}

  const box = document.getElementById("typingIndicator");
  if(box) box.textContent = "";

  chatView.classList.add("hidden");
setTimeout(()=>{ chatClosing = false; }, 1000);
  // ✅ UI restore
  if(role === "astrologer"){
    astrologerView.classList.remove("hidden");
    clientView.classList.add("hidden");

    if(endedChatId){
      db.ref("chats/"+endedChatId+"/meta/earned")
        .once("value")
        .then(snap=>{
          const earned = snap.val() || 0;
          alert(`Chat ended.\nYou earned ${earned} credits.`);
        });
    }
  } else {
    clientView.classList.remove("hidden");
    astrologerView.classList.add("hidden");

    if(message && message !== "silent"){
      alert(message);
    }
  }
}
/* =========================================================
   💰 BILLING & TIMERS
   ========================================================= */
/* ================= BILLING & TIMERS ================= */
/* ---------- Credit Deduction Engine ---------- */
async function startCreditTimer(clientId, astrologerId){
  if(billingActive) return;
   
   if(!clientId || !astrologerId){
  console.warn("Invalid client or astrologer ID for billing");
  return;
}
  billingActive = true;

  creditInterval = setInterval(async ()=>{
    if(!chatId) return stopBilling();

    try {
      const rateSnap = await db.ref(`presence/${astrologerId}/ratePerMinute`).once("value");
      const rate = rateSnap.val() || 1;

      // Deduct client credits safely
      const clientCreditsRef = db.ref(`presence/${clientId}/credits`);
      const result = await clientCreditsRef.transaction(c => {
        if((c || 0) < rate) return; // abort transaction if insufficient
        return c - rate;
      });

      if(!result.committed){
        // Not enough credits → end chat
        await db.ref(`chats/${chatId}/meta`).update({
          active: false,
          endReason: "Credits exhausted"
        });
        stopBilling();
        return;
      }

await db.ref(`presence/${astrologerId}/credits`).transaction(a => (a || 0) + rate);
await db.ref(`chats/${chatId}/meta/earned`).transaction(e => (e || 0) + rate);
await db.ref(`presence/${astrologerId}/totalChatTime`).transaction(t => (t || 0) + 1);
await db.ref(`presence/${clientId}/totalChatTime`).transaction(t => (t || 0) + 1);

    } catch(err){
      console.error("Credit timer error:", err);
    }
  }, 60000); // every minute
}
function stopBilling(){
  billingActive = false;
  if(creditInterval){
    clearInterval(creditInterval);
    creditInterval = null;
  }
}
function updateRate(){
  if(!userId) return;

  const input = document.getElementById("rateInput");
  const value = parseInt(input.value);

  if(!value || value < 1){
    alert("Enter valid rate (minimum 1)");
    return;
  }

  db.ref("presence/"+userId+"/ratePerMinute")
    .set(value)
    .then(()=>{
      input.value = "";
      alert("Rate updated successfully");
    })
    .catch(()=>{
      alert("Failed to update rate");
    });
}
/* ---------- Chat Timer UI ---------- */
function startChatTimer(){
  stopChatTimer();

  chatTimerInterval = setInterval(()=>{
    if(!chatStartTime) return;

    const s = Math.floor((Date.now() - chatStartTime) / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;

    const el = document.getElementById("chatTimer");
    if(el){
      el.textContent = `${m}:${sec.toString().padStart(2,"0")}`;
    }
  }, 1000);
}

function stopChatTimer(){
  if(chatTimerInterval){
    clearInterval(chatTimerInterval);
    chatTimerInterval = null;
  }
}

function watchCredits(){
  if(!userId) return;

  db.ref("presence/"+userId+"/credits").on("value", snap=>{
    const c = snap.val() || 0;
    const el = document.getElementById("creditBalance");
    if(el) el.textContent = c;
  });
}
function watchAstroRate(){
  if(!userId) return;

  db.ref("presence/"+userId+"/ratePerMinute").on("value", snap=>{
    const r = snap.val() || 1;
    const el = document.getElementById("rateDisplay");
    if(el) el.textContent = r;
  });
}
let earningsRef = null;

function watchTodayEarnings(){
  if(!userId) return;

  if(earningsRef) earningsRef.off();

  const start = new Date();
  start.setHours(0,0,0,0);

  earningsRef = db.ref("chats");
  earningsRef.on("value", snap=>{
    let total = 0;

    snap.forEach(c=>{
      const m = c.child("meta").val();
      if(m && m.astrologer === userId && m.started >= start.getTime()){
        total += m.earned || 0;
      }
    });

    const el = document.getElementById("todayEarnings");
    if(el) el.textContent = total;
  });
}
/* =========================================================
   ⭐ REVIEWS & RATINGS
   ========================================================= */
/* ================= REVIEWS ================= */
let selectedRatings = {}; // store selected rating per astrologer
function renderStars(astrologerId){
  const el = document.getElementById("stars_" + astrologerId);
  if(!el) return;

  const ref = db.ref("reviews/" + astrologerId);
  ref.off();
  ref.on("value", snap=>{
    let total = 0, count = 0;
    snap.forEach(r=>{
      total += r.val().rating || 0;
      count++;
    });

    const avg = count ? Math.round(total / count) : 0;
    el.innerHTML = "★".repeat(avg) + "☆".repeat(5 - avg);
  });
}
function selectStar(astrologerId, rating){
  selectedRatings[astrologerId] = rating;

  for(let i=1;i<=5;i++){
    const el = document.getElementById(`selectStar_${astrologerId}_${i}`);
    if(el){
      el.textContent = i <= rating ? "★" : "☆";
    }
  }
}
function loadReviews(astrologerId){
  const box = document.getElementById("reviews_" + astrologerId);
  const stats = document.getElementById("reviewStats_" + astrologerId);
  if(!box || !stats) return;

  const ref = db.ref("reviews/" + astrologerId).limitToLast(10);

  // 🔥 DO NOT use ref.off() here
  ref.on("value", snap=>{
    box.innerHTML = "";
    let total = 0, count = 0;

    snap.forEach(r=>{
      const d = r.val();
      total += d.rating || 0;
      count++;

      const div = document.createElement("div");
      div.className = "review-card";

      const user = userCache[d.from] || "User";
      const avatar =
  userCache[d.from+'_avatar'] ||
  createInitialAvatar(
    userCache[d.from] || "User",
    userCache[d.from+'_color']
  );

      div.innerHTML = `
        <div class="review-header">
          <img src="${avatar}">
          <strong>${user}</strong>
          <span style="margin-left:auto;color:#f59e0b;">
            ${"★".repeat(d.rating || 0)}
          </span>
        </div>

        <div style="margin-top:6px;color:#475569;">
          ${d.text || ""}
        </div>
      `;

      // 🔥 CREATE DELETE BUTTON PROPERLY
      if(astrologerId === userId){
        const btn = document.createElement("button");
        btn.className = "review-delete-btn";
        btn.textContent = "Delete";
        btn.onclick = () => deleteReview(astrologerId, r.key);
        div.appendChild(btn);
      }

      box.appendChild(div);
    });

    stats.textContent = count
      ? `⭐ ${(total/count).toFixed(1)} (${count} reviews)`
      : "No reviews yet";
  });
}
function submitReview(astrologerId){
  if(!userId) return alert("Login required");

  const textEl = document.getElementById("reviewText_" + astrologerId);
  if(!textEl) return;

  const text = textEl.value.trim();
  if(!text) return alert("Write something");

const rating = selectedRatings[astrologerId] || 0;
if(rating === 0) return alert("Select rating");
   
  db.ref("reviews/" + astrologerId).push({
    from: userId,
    rating,
    text,
    time: Date.now()
  });

  textEl.value = "";
}
function deleteReview(astrologerId, reviewId){
  if(!confirm("Delete this review?")) return;

  db.ref("reviews/"+astrologerId+"/"+reviewId).remove();
}
/* =========================================================
   🧑 CLIENT VIEW RENDERING
   ========================================================= */
/* ================= CLIENT VIEW ================= */
const astroRef = db.ref("presence");

astroRef.on("value", snap => {
  astrologerList.innerHTML = "";

  snap.forEach(child => {
    const data = child.val();
    if(data.role === "astrologer"){
      renderAstrologerCard(child);
    }
  });
});
function renderAstrologerCard(child){
  const data = child.val();
  const uname = data.username || child.key;
  const div = document.createElement("div");
  div.className = "card";
  div.id = "astro_" + child.key;

  div.innerHTML = `
    <div class="avatar-wrapper">
  <img class="avatar"
    src="${data.avatar || createInitialAvatar(data.username || 'User', data.avatarColor)}"
  >
  <span class="status-dot ${data.online ? 'online' : ''}"></span>
</div>
    <strong>${uname}</strong>
    <div class="stars" id="stars_${child.key}"></div>
    <small>${data.speciality || "Astrology"}</small><br>
    <small><strong>${data.ratePerMinute}</strong> credits / min</small>
    <p>${data.experience || "No experience listed."}</p>
    <small>Total chat time: ${data.totalChatTime || 0} minutes</small>

    <div class="review-box">
      <div class="star-select" id="starSelect_${child.key}">
        ${[1,2,3,4,5].map(i=>`
          <span onclick="selectStar('${child.key}', ${i})"
            id="selectStar_${child.key}_${i}"
            class="select-star">☆</span>
        `).join("")}
      </div>
      <textarea id="reviewText_${child.key}" placeholder="Write a review"></textarea>
      <button type="button" onclick="submitReview('${child.key}')">
        Submit Review
      </button>
    </div>

    <div class="review-panel">
      <div class="review-stats" id="reviewStats_${child.key}"></div>
      <div class="review-scroll" id="reviews_${child.key}"></div>
    </div>
<button 
  type="button"
  id="reqBtn_${child.key}"
  onclick="requestChat('${child.key}', ${data.ratePerMinute || 0})">
  ${
    data.online !== true
      ? "Offline"
      : data.busy
      ? "Busy"
      : "Request Chat"
  }
</button>
`;
db.ref("presence/" + child.key).on("value", snap=>{
  const d = snap.val();
  const btn = document.getElementById("reqBtn_" + child.key);
  if(!btn || !d) return;

  if(d.online !== true){
    btn.textContent = "Offline";
    btn.disabled = true;
  }
  else if(d.busy){
    btn.textContent = "Busy";
    btn.disabled = true;
  }
  else{
    btn.textContent = "Request Chat";
    btn.disabled = false;
  }
});
  astrologerList.appendChild(div);

  renderStars(child.key);
  loadReviews(child.key);
}
