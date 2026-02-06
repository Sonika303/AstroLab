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
const storage = firebase.storage();
/* ================= STATE ================= */
let userId = null;
let role = "client";
let isConnected = false;
const ROLE_KEY = "astrolab_role";
const ONLINE_KEY = "astrolab_online";
const connectedRef = db.ref(".info/connected");

connectedRef.on("value", snap => {
  if (!userId) return;

  isConnected = snap.val() === true;

  // 🔥 When connection is restored
  if (isConnected) {
    const wasOnline = localStorage.getItem(ONLINE_KEY) === "1";
    const savedRole = localStorage.getItem(ROLE_KEY);

    if (savedRole === "astrologer" && wasOnline) {
      toggleOnline(true); // 🔥 RE-ANNOUNCE ONLINE
    }
  }
});
let chatId = null;
let partnerId = null;
let typingRef = null;
let typingTimeout = null;
let chatRef = null;
let queueRef = null;
let userCache = {}; // cache usernames
let creditInterval = null;
let chatStartTime = null;
let chatTimerInterval = null;
/* ================= ELEMENTS ================= */
const clientView = document.getElementById("clientView");
const astrologerView = document.getElementById("astrologerView");
const chatView = document.getElementById("chatView");
const astrologerList = document.getElementById("astrologerList");
const queueList = document.getElementById("queueList");
const messagesDiv = document.getElementById("messages");
const msgInput = document.getElementById("msgInput");
msgInput.addEventListener("input", () => {
  if(!chatId || !partnerId) return;

  const ref = db.ref(`chats/${chatId}/typing/${userId}`);
  ref.set(true);

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    ref.remove();
  }, 2000);
});
const avatarInput = document.getElementById("avatarInput");
const avatarPreview = document.getElementById("avatarPreview");
const s_name = document.getElementById("s_name");
const s_speciality = document.getElementById("s_speciality");
const s_desc = document.getElementById("s_desc");
/* ================= IF NOT SIGNED IN ================= */
function showNotSignedIn(){
  document.body.innerHTML = `
    <div style="
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      font-family:Inter,system-ui;
      background:#f8fafc;
    ">
      <div style="
        background:#fff;
        padding:32px;
        border-radius:18px;
        box-shadow:0 30px 60px rgba(0,0,0,.12);
        text-align:center;
        max-width:380px;
      ">
        <h2>Oops 😕</h2>
        <p style="color:#64748b;margin:12px 0 20px;">
          Looks like you are not signed in.<br>
          Please sign up or log in to continue.
        </p>
        <button onclick="location.href='auth.html'">
          Go to Sign In
        </button>
      </div>
    </div>
  `;
}
function ensurePresence(user){
  if(!user || !user.uid) return;

  const ref = db.ref("presence/" + user.uid);

  ref.once("value").then(snap=>{
    if(snap.exists()) return;

    ref.set({
      username: user.displayName || "user_" + user.uid.slice(0,6),
      avatar: user.photoURL || "",
      role: "client",
      credits: 20,
      ratePerMinute: 1,
      speciality: "",
      description: "",
      online: false,
      busy: false,
      firstChatUsed: false,
      lastSeen: Date.now()
    });
  });
}
function healPresence(uid){
  if(!uid) return;

  const ref = db.ref("presence/" + uid);

  ref.once("value").then(snap=>{
    if(!snap.exists()) return;

    const data = snap.val() || {};

    ref.update({
      username: data.username || "user_" + uid.slice(0,6),
      avatar: data.avatar || "",
      credits: data.credits ?? 20,
      ratePerMinute: data.ratePerMinute ?? 1,
      speciality: data.speciality || "",
      description: data.description || "",
      firstChatUsed: data.firstChatUsed ?? false,
      online: data.online ?? false,
      busy: data.busy ?? false,
      role: data.role || "client",
      lastSeen: Date.now()
    });
  });
}

/* ================= AUTH STATE ================= */
auth.onAuthStateChanged(user => {
  if (!user) {
    showNotSignedIn();
    return;
  }
  
userId = user.uid;
ensurePresence(user);
healPresence(user.uid);

setInterval(() => {
  healPresence(user.uid);
}, 60000);

  clientView.classList.remove("hidden");
  astrologerView.classList.add("hidden");
  chatView.classList.add("hidden");

  loadProfile();
  loadUserCache();
  watchCredits();
  watchAstroRate();

  // 🔥 RESTORE ONLINE STATE AFTER REFRESH
  const wasOnline = localStorage.getItem(ONLINE_KEY) === "1";
  const savedRole = localStorage.getItem(ROLE_KEY);

  const onlineToggle = document.getElementById("onlineToggle");
  if (onlineToggle) {
    onlineToggle.checked = wasOnline;
  }

  if (savedRole === "astrologer" && wasOnline) {
    toggleOnline(true);
  }

  const onlineText = document.getElementById("onlineStatusText");
  if (onlineText) {
    onlineText.textContent = wasOnline ? "Online" : "Offline";
  }

  if (savedRole) switchRole(savedRole);

  db.ref("currentChat/" + userId).on("value", snap => {
    if (!snap.exists()) {
      forceCloseChat("silent");
      return;
    }

    const cid = snap.val();
    db.ref("chats/" + cid + "/meta").once("value").then(mSnap => {
      if (mSnap.exists()) openChat(cid);
    });
  });
});
/* ================= LOAD PROFILE ================= */
function loadProfile(){
  if(!userId) return;

  db.ref("presence/"+userId).once("value").then(snap=>{
    const d = snap.val();
    if(!d) return;

    s_name.value = d.username || "";
    s_speciality.value = d.speciality || "";
    s_desc.value = d.description || "";

    // 🔥 force reload avatar
    avatarPreview.src = d.avatar 
      ? d.avatar + "&r=" + Date.now()
      : "https://via.placeholder.com/80";
  });
}

/* ================= LOGOUT ================= */
function logout(){
  if(!userId) return;

  // 🔥 stop everything
  stopChatTimer();
  if(creditInterval){
    clearInterval(creditInterval);
    creditInterval = null;
  }

  // 🔥 mark offline safely
  db.ref("presence/" + userId).update({
    online: false,
    busy: false,
    lastSeen: Date.now()
  });

  // 🔥 cleanup db + local state
  clearMyRequests();
  db.ref("currentChat/" + userId).remove();

  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(ONLINE_KEY);

  auth.signOut().then(() => {
    window.location.href = "auth.html";
  });
}

function saveSettings(){
  if(!userId){
    alert("You are not logged in.");
    return;
  }

  const file = avatarInput.files[0];
  const name = s_name.value.trim().toLowerCase();
  if(!name) return showError("Name required");

  // base profile data
  const baseData = {
    username: name,
    speciality: s_speciality.value,
    description: s_desc.value
  };

  // NO IMAGE → just save text
  if(!file){
    db.ref("presence/"+userId).update(baseData).then(()=>{
      alert("Settings saved");
    });
    return;
  }

  // IMAGE UPLOAD
  const ref = storage.ref(`avatars/${userId}.jpg`);
  ref.put(file)
    .then(()=>ref.getDownloadURL())
    .then(url=>{
      // 🔥 cache-busting
      const bustedUrl = url + "?v=" + Date.now();

      baseData.avatar = bustedUrl;

      return db.ref("presence/"+userId).update(baseData).then(()=>{
        avatarPreview.src = bustedUrl;
        avatarInput.value = "";
        alert("Settings saved");
      });
    })
    .catch(err=>{
      console.error(err);
      showError("Image upload failed");
    });
}

function updateProfile(name, avatar){
  const data = {
    username: name,
    speciality: s_speciality.value,
    description: s_desc.value
  };
  if(avatar) data.avatar = avatar;
  db.ref("presence/"+userId).update(data);
}


/* ================= ROLE SWITCH ================= */
function switchRole(r){
  if(!userId) return;

  // 🔥 If astrologer switches to client, keep online state but stop UI + queue
  if(role === "astrologer" && r === "client"){
    stopQueueListener();           // stop queue UI
    astrologerView.classList.add("hidden");
    clientView.classList.remove("hidden");
  }

  applyRole(r);
}

function applyRole(r){
  role = r;
  localStorage.setItem(ROLE_KEY, r);

  clientView.classList.toggle("hidden", r !== "client");
  astrologerView.classList.toggle("hidden", r !== "astrologer");
  if(!chatId){
    chatView.classList.add("hidden");
  }

  if(r === "astrologer"){
    watchTodayEarnings();
  } else {
    if(earningsRef){
      earningsRef.off();
      earningsRef = null;
    }
  }
}

/* ================= ASTROLOGER ONLINE ================= */
function toggleOnline(isOnline){
  if (!userId) return;

  const ref = db.ref("presence/" + userId);
  localStorage.setItem(ONLINE_KEY, isOnline ? "1" : "0");

  if (isOnline) {
    ref.update({
      role: "astrologer",
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
/* ================= QUEUE LISTENER ================= */
function startQueueListener(){
  queueList.innerHTML="";
  queueRef = db.ref("requests/"+userId);
  queueRef.off();
 queueRef.on("child_added", snap=>{
  const data = snap.val();
  const clientName = userCache[data.client] || data.client;

  const div = document.createElement("div");
  div.className = "card";
  div.id = "req_" + snap.key;
   
div.innerHTML = `
  Request from <strong>${clientName}</strong><br>
<button type="button" onclick="acceptChat('${snap.key}','${data.client}')">Accept</button>
  <button type="button" style="background:#dc2626"
    onclick="denyChat('${snap.key}')">Deny</button>
`;

  queueList.appendChild(div);
});

queueRef.on("child_removed", snap=>{
  const el = document.getElementById("req_" + snap.key);
  if(el) el.remove();
});

}
function stopQueueListener(){ if(queueRef) queueRef.off(); queueList.innerHTML=""; }
function toggleOnlineBtn(){
  const isOnline = localStorage.getItem(ONLINE_KEY) === "1";
  toggleOnline(!isOnline);
}
  function onOnlineToggleChange(el){
  const isOnline = el.checked;
  toggleOnline(isOnline);
}
/* ================= CLIENT VIEW ================= */
db.ref("presence").on("value", snap=>{
  astrologerList.innerHTML = "";
  snap.forEach(child=>{
    const data = child.val();
    if(data.role === "astrologer" && data.online === true){
      const uname = data.username || child.key;
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <img src="${data.avatar || 'https://via.placeholder.com/80'}" class="avatar">
        <strong>${uname}</strong>
        <div class="stars" id="stars_${child.key}"></div>
        <small>${data.speciality || "Astrology"}</small><br>
        <small><strong>${data.ratePerMinute}</strong> credits / min</small>
        <p>${data.description || ""}</p>
        <div class="review-box">
          <textarea id="reviewText_${child.key}" placeholder="Write a review (optional)"></textarea>
          <button type="button" onclick="submitReview('${child.key}')">Submit Review</button>
        </div>
        <div class="review-panel">
          <div class="review-stats" id="reviewStats_${child.key}"></div>
          <div class="review-scroll" id="reviews_${child.key}"></div>
        </div>
        <button type="button" onclick="requestChat('${child.key}', ${data.ratePerMinute || 0})"
          ${(!data.online || data.busy) ? "disabled" : ""}>
          ${data.busy ? "Busy" : "Request Chat"}
        </button>
      `;
      astrologerList.appendChild(div);
      renderStars(child.key);
      loadReviews(child.key);
      userCache[child.key] = data.username;
    }
  });
});

/* ================= SEND REQUEST ================= */
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

      return reqRef.once("value").then(snap=>{
        if(snap.exists()){
          alert("You already requested this astrologer");
          return;
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
/* ================= ACCEPT CHAT ================= */
async function acceptChat(queueKey, clientId){
  if(chatId) return; // local guard

  const astroRef = db.ref("presence/"+userId);

  // 🔒 HARD LOCK using TRANSACTION
  const lockResult = await astroRef.child("busy").transaction(busy=>{
    if(busy === true) return; // abort
    return true; // lock
  });

  if(!lockResult.committed){
    alert("You are already in a chat");
    return;
  }

  // 🔥 create chat id AFTER lock
  chatId = db.ref("chats").push().key;
  partnerId = clientId;

  // 🔥 create meta
  await db.ref("chats/"+chatId+"/meta").set({
    astrologer: userId,
    client: clientId,
    started: firebase.database.ServerValue.TIMESTAMP,
    active: true
  });

  // 🔥 link BOTH users (authoritative)
  await db.ref("currentChat").update({
    [userId]: chatId,
    [clientId]: chatId
  });

  // 🔥 remove ONLY this request
  await db.ref("requests/"+userId+"/"+queueKey).remove();

  // 🔥 open chat AFTER linking
  openChat(chatId);

  // 🔥 start billing ONLY ONCE
  startCreditTimer(clientId, userId);
}
function buyCredits(amount){
  if(!userId){
    alert("You are not logged in.");
    return;
  }

  let link = "";

  if(amount === 49){
    link = "";
  } 
  else if(amount === 99){
    link = "";
  } 
  else if(amount === 249){
    link = "";
  }

  if(!link){
    alert("Invalid package");
    return;
  }

  const email = auth.currentUser?.email || "unknown";

  // 🔥 IMPORTANT: PASS UID + EMAIL TO RAZORPAY
  const params =
    "?uid=" + encodeURIComponent(userId) +
    "&email=" + encodeURIComponent(email) +
    "&amount=" + amount +
    "&time=" + Date.now();

  alert(
    "Payment page will open.\n\n" +
    "Credits will be added within 24 hours.\n\n" +
    "Your User ID is saved automatically."
  );

  window.open(link + params, "_blank");
}
/* ================= OPEN CHAT ================= */
function openChat(id){
  // 🔥 HARD RESET CHAT STATE
if(!chatStartTime){
  chatStartTime = null;
  stopChatTimer();
}

  chatId = id;

  clientView.classList.add("hidden");
  astrologerView.classList.add("hidden");
  chatView.classList.remove("hidden");
  messagesDiv.innerHTML = "";

  const metaRef = db.ref("chats/"+id+"/meta");

  // 🔥 REAL-TIME END DETECTION
metaRef.on("value", snap=>{
  const meta = snap.val();
if(!meta) return; // 🔥 ignore transient nulls

if(meta.active === false){
  metaRef.off();
  forceCloseChat(meta.endReason || "Chat ended");
  return;
}

  partnerId = meta.client === userId ? meta.astrologer : meta.client;

  // 🔥 FIX TIMER RESET (USE ORIGINAL START TIME)
if(meta.started){
  chatStartTime = meta.started;
  startChatTimer();
}
});

  if(chatRef) chatRef.off();
  chatRef = db.ref("chats/"+id+"/messages");

  chatRef.on("child_added", snap=>{
    const msg = snap.val();
    const div = document.createElement("div");
    div.className = "message " + (msg.from === userId ? "self" : "");
    div.textContent = (userCache[msg.from] || "User") + ": " + msg.text;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTo({ top: messagesDiv.scrollHeight, behavior:"smooth" });
  });
  typingRef = db.ref(`chats/${id}/typing`);
typingRef.on("value", snap => {
  const box = document.getElementById("typingIndicator");
  if(!box) return;

  const data = snap.val() || {};
  const usersTyping = Object.keys(data);

  const otherTyping = usersTyping.includes(partnerId);
  const selfTyping = usersTyping.includes(userId);

  box.textContent =
    otherTyping ? "User is typing…" :
    selfTyping ? "You are typing…" :
    "";
});
}
function forceCloseChat(message){
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
  chatStartTime = null;

  const box = document.getElementById("typingIndicator");
  if(box) box.textContent = "";

  chatView.classList.add("hidden");

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
/* ================= SEND MESSAGE ================= */
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
  msgInput.value="";
}
/* ================= EXIT CHAT ================= */
function exitChat(){
  if(creditInterval){
  clearInterval(creditInterval);
  creditInterval = null;
}
  if(!chatId) return;

  if(!confirm("End chat for both users?")) return;

  const endedChatId = chatId;

  // 🔥 AUTHORITATIVE END
  db.ref("chats/"+endedChatId+"/meta/active").set(false);
  db.ref("chats/"+endedChatId+"/meta").update({
  archived: true
});

  // remove assignments
  db.ref("currentChat/"+userId).remove();
  if(partnerId) db.ref("currentChat/"+partnerId).remove();
  // 🔥 CLEAN ANY PENDING REQUESTS
db.ref("requests/"+userId).remove();
if(partnerId) db.ref("requests/"+partnerId).remove();

  // free astrologer
  if(role === "astrologer"){
    db.ref("presence/"+userId).update({ busy:false });
  } else if(partnerId){
    db.ref("presence/"+partnerId).update({ busy:false });
  }
db.ref(`chats/${chatId}/typing`).remove();
}
async function startCreditTimer(clientId, astrologerId){
  const clientRef = db.ref("presence/"+clientId);
  const astroRef = db.ref("presence/"+astrologerId);

  creditInterval = setInterval(async () => {
const clientSnap = await clientRef.once("value");
const astroSnap = await astroRef.once("value");
await db.ref("chats/"+chatId+"/meta/earned")
  .transaction(e => e === null ? 0 : e);
    const credits = clientSnap.val().credits || 0;
    const rate = astroSnap.val().ratePerMinute || 1;
    const firstChatUsed = clientSnap.val().firstChatUsed;

let finalRate = rate;

// 🔥 APPLY DISCOUNT ONLY IF FIRST CHAT
if(firstChatUsed === false){
  finalRate = Math.ceil(rate * 0.90); // 10% OFF

  // 🔥 MARK USED ONLY ONCE (FIRST MINUTE)
  await clientRef.update({ firstChatUsed: true });
}
    if(credits < finalRate){
      endChat("Client ran out of credits");
      return;
    }

    await clientRef.update({
  credits: credits - finalRate
});

    await astroRef.child("credits")
      .transaction(c => (c || 0) + finalRate);

    db.ref("chats/"+chatId+"/meta/earned")
      .transaction(e => (e || 0) + finalRate);

    const todayKey = new Date().toLocaleDateString("en-CA");
    db.ref(`earnings/${astrologerId}/${todayKey}`)
      .transaction(e => (e || 0) + finalRate);

  }, 60000);
}

/* ================= Reset ================= */
  function resetEveryone(){
  if(!confirm("RESET ALL ONLINE USERS?")) return;

  db.ref("presence").once("value").then(snap=>{
    snap.forEach(child=>{
      db.ref("presence/"+child.key).update({
        online: false,
        role: "client",
        busy: false,
        lastSeen: Date.now()
      });
      db.ref("requests/"+child.key).remove();
      db.ref("currentChat/"+child.key).remove();
    });
  });

  alert("All users reset");
}

/* ================= LOAD USERNAMES CACHE ================= */
function loadUserCache(){
  db.ref("presence").once("value").then(snap=>{
    snap.forEach(child=>{
      userCache[child.key] = child.val().username;
      userCache[child.key+"_avatar"] = child.val().avatar;
    });
  });
}
  function watchCredits(){
  db.ref("presence/"+userId+"/credits").on("value", snap=>{
    const el = document.getElementById("creditBalance");
    if(el) el.textContent = snap.val() || 0;
  });
}
  function watchAstroRate(){
  db.ref("presence/"+userId+"/ratePerMinute").on("value", snap=>{
    const el = document.getElementById("astroRate");
    if(el){
      el.textContent = snap.val() || 0;
    }
  });
}
  
function updateRate(){
  if(chatId){
    alert("You cannot change rate during live chat");
    return;
  }

  const input = document.getElementById("rateInput");
  const rate = parseInt(input.value);

  if(!rate || rate < 1){
    alert("Rate must be 1 or more");
    return;
  }

  db.ref("presence/"+userId).update({
    ratePerMinute: rate
  });

  input.value = "";
}
let earningsRef = null;

function watchTodayEarnings(){
  if(!userId || role !== "astrologer") return;

  const todayKey = new Date().toLocaleDateString("en-CA");

  if(earningsRef){
    earningsRef.off();
  }

  earningsRef = db.ref(`earnings/${userId}/${todayKey}`);
  earningsRef.on("value", snap=>{
    const el = document.getElementById("todayEarnings");
    if(el) el.textContent = snap.val() || 0;
  });
}

function startChatTimer(){
  stopChatTimer();
  chatTimerInterval = setInterval(()=>{
    const diff = Date.now() - chatStartTime;
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    document.getElementById("chatTimer").textContent =
      `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
  }, 1000);
}

function stopChatTimer(){
  if(chatTimerInterval){
    clearInterval(chatTimerInterval);
    chatTimerInterval = null;
  }
}
function endChat(reason){
  if(!chatId) return;

  const endedChatId = chatId;

  db.ref("chats/" + endedChatId + "/meta").update({
    active: false,
    endReason: reason || "Chat ended"
  });

  db.ref("currentChat/" + userId).remove();
  if(partnerId) db.ref("currentChat/" + partnerId).remove();

  if(role === "astrologer"){
    db.ref("presence/" + userId).update({ busy:false });
  } else if(partnerId){
    db.ref("presence/" + partnerId).update({ busy:false });
  }

  db.ref(`chats/${endedChatId}/typing`).remove();

  forceCloseChat(reason || "Chat ended");
}
function clearMyRequests(){
  if(!userId) return;
  db.ref("requests/" + userId).remove();
}
let selectedStars = {};
function renderStars(astroId){
  const box = document.getElementById("stars_" + astroId);
  if(!box) return;

  box.innerHTML = "";

  for(let i = 1; i <= 5; i++){
    const star = document.createElement("i");
    star.className = "fa-solid fa-star";

    star.onclick = () => {
      selectedStars[astroId] = i;
      updateStarsUI(astroId, i);
    };

    box.appendChild(star);
  }
}

function updateStarsUI(astroId, count){
  const box = document.getElementById("stars_" + astroId);
  if(!box) return;

  [...box.children].forEach((star, idx)=>{
    star.classList.toggle("active", idx < count);
  });
}
function submitReview(astroId){
  if(!userId) return alert("Login first");
if(userId === astroId){
  alert("You cannot review yourself");
  return;
}
  const stars = selectedStars[astroId];
  if(!stars) return alert("Select stars");

  const text =
    document.getElementById("reviewText_"+astroId).value.trim();

const reviewRef = db.ref(`reviews/${astroId}/${userId}`);

reviewRef.once("value").then(snap=>{
  if(snap.exists()){
    alert("You already reviewed this astrologer");
    return;
  }

  reviewRef.set({
  stars,
  text,
  time: Date.now(),
  userId: userId
});
});

  document.getElementById("reviewText_"+astroId).value = "";
}
function loadReviews(astroId){
  const listBox = document.getElementById("reviews_"+astroId);
  const statsBox = document.getElementById("reviewStats_"+astroId);

  db.ref("reviews/"+astroId).on("value", snap=>{
    listBox.innerHTML = "";
    let total = 0, count = 0;

    snap.forEach(child=>{
      const r = child.val();
      total += r.stars;
      count++;

      const user = userCache[r.userId] || "User";
      const avatar = userCache[r.userId+"_avatar"] || "https://via.placeholder.com/32";

const div = document.createElement("div");
div.className = "review-item";

div.innerHTML = `
  <div class="review-user">${user}</div>
  <div class="review-stars">${"★".repeat(r.stars)}</div>
  <div>${r.text || ""}</div>
  ${
    r.userId === userId
      ? `<button class="review-delete"
           onclick="deleteReview('${astroId}')">Delete</button>`
      : ""
  }
`;
      listBox.appendChild(div);
    });

    statsBox.innerHTML = count
      ? `⭐ ${(total/count).toFixed(1)} (${count} reviews)`
      : "No reviews yet";
  });
}
  function denyChat(queueKey){
  db.ref("requests/"+userId+"/"+queueKey).remove();
}
function deleteReview(astroId){
  if(!confirm("Delete your review?")) return;
  db.ref(`reviews/${astroId}/${userId}`).remove();
}
/* ================= SETTINGS PANEL TOGGLE ================= */
function toggleSettings(){
  const panel = document.getElementById("settingsPanel");
  if(!panel) return;

  panel.classList.toggle("open");
} 
