const firebaseConfig = {
  apiKey: "AIzaSyDZ-NvSzXJrH8YyvI5GWVWRtZnSNe0NAxU",
  authDomain: "tech-source-bill.firebaseapp.com",
  databaseURL: "https://tech-source-bill-default-rtdb.firebaseio.com",
  projectId: "tech-source-bill",
  storageBucket: "tech-source-bill.firebasestorage.app",
  messagingSenderId: "690209240188",
  appId: "1:690209240188:web:6e54de365e7f839634c5f9"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let formData = {};
let currentUser = null;
let currentProfile = {};
let authMode = "login";
let currentStepIndex = 0;
let isMinorApplicant = false;
let draftSaveTimer = null;

const draftFieldIds = [
  "lastName", "firstName", "middleName", "aadhar", "nameAadhar", "dob", "gender",
  "phone", "email", "fatherlastName", "fatherFirstName", "fatherMiddleName",
  "motherlastName", "motherfirstName", "motherMiddleName", "guardianlastName",
  "guardianfirstName", "guardianMiddleName", "pinCode", "flatNo", "villageCity",
  "postOffice", "manualPO", "subDivision", "district", "state", "proofOfIdentity",
  "proofOfAddress", "proof_dob"
];

const adultSteps = [
  { id: "basic", label: "Basic Detail" },
  { id: "contact", label: "Contact Detail" },
  { id: "parents", label: "Parents Detail" },
  { id: "address", label: "Address Detail" },
  { id: "documents", label: "Documents" }
];

const minorSteps = [
  { id: "basic", label: "Basic Detail" },
  { id: "contact", label: "Contact Detail" },
  { id: "parents", label: "Parents Detail" },
  { id: "guardian", label: "Guardian Detail" },
  { id: "address", label: "Address Detail" },
  { id: "documents", label: "Documents" }
];

function getSteps() {
  return isMinorApplicant ? minorSteps : adultSteps;
}

function redirectToLogin() {
  openAuthPopup("login");
}

function openForm() {
  if (!currentUser) {
    redirectToLogin();
    return;
  }

  const screen = document.getElementById("formScreen");
  const emailInput = document.getElementById("email");

  if (!emailInput.value) emailInput.value = currentUser.email || "";

  screen.style.display = "block";
  screen.classList.add("is-open");
  screen.setAttribute("aria-hidden", "false");
  loadDraft();
  renderSteps();
}

function closeForm() {
  saveDraft();
  const screen = document.getElementById("formScreen");
  screen.style.display = "none";
  screen.classList.remove("is-open");
  screen.setAttribute("aria-hidden", "true");
}

function renderSteps() {
  const steps = getSteps();
  const stepper = document.getElementById("formStepper");
  const progressText = document.getElementById("stepProgressText");
  const prevBtn = document.getElementById("prevStepBtn");
  const nextBtn = document.getElementById("nextStepBtn");
  const submitBtn = document.getElementById("submitStepBtn");
  const minorBadge = document.getElementById("minorBadge");

  if (currentStepIndex >= steps.length) currentStepIndex = steps.length - 1;
  if (currentStepIndex < 0) currentStepIndex = 0;

  stepper.classList.toggle("minor-mode", isMinorApplicant);
  stepper.innerHTML = steps.map((step, index) => {
    const state = index === currentStepIndex ? "is-active" : index < currentStepIndex ? "is-done" : "";
    return `<span class="step-pill ${state}" data-number="${index + 1}">${step.label}</span>`;
  }).join("");

  document.querySelectorAll(".form-section").forEach((section) => {
    const isActive = section.dataset.step === steps[currentStepIndex].id;
    section.classList.toggle("is-active", isActive);

    section.querySelectorAll("input, select, button, textarea").forEach((field) => {
      field.disabled = !isActive;
    });
  });

  if (isMinorApplicant) {
    document.getElementById("guardianSection").classList.remove("hidden-section");
    document.getElementById("guardianFields").classList.remove("hidden-section");
    document.getElementById("gFrontBox").classList.remove("hidden-section");
    document.getElementById("gBackBox").classList.remove("hidden-section");
  } else {
    document.getElementById("guardianSection").classList.add("hidden-section");
    document.getElementById("guardianFields").classList.add("hidden-section");
    document.getElementById("gFrontBox").classList.add("hidden-section");
    document.getElementById("gBackBox").classList.add("hidden-section");
  }

  minorBadge.classList.toggle("is-visible", isMinorApplicant);
  progressText.textContent = `Step ${currentStepIndex + 1} of ${steps.length}`;
  prevBtn.style.display = currentStepIndex === 0 ? "none" : "inline-flex";
  nextBtn.style.display = currentStepIndex === steps.length - 1 ? "none" : "inline-flex";
  submitBtn.style.display = currentStepIndex === steps.length - 1 ? "inline-flex" : "none";
}

function validateCurrentStep() {
  const currentStep = getSteps()[currentStepIndex].id;
  const sections = document.querySelectorAll(`.form-section[data-step="${currentStep}"]`);

  for (const section of sections) {
    const fields = section.querySelectorAll("input, select, textarea");
    for (const field of fields) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
  }

  return true;
}

function goNextStep() {
  if (!validateCurrentStep()) return;
  currentStepIndex++;
  renderSteps();
  saveDraft(true);
}

function goPrevStep() {
  currentStepIndex--;
  renderSteps();
  saveDraft(true);
}

function openAuthPopup(mode = "login") {
  authMode = mode;
  document.getElementById("authTitle").innerText = mode === "signup" ? "Create Account" : "Login";
  document.getElementById("authSubmitBtn").innerText = mode === "signup" ? "Create Account" : "Login";
  document.getElementById("authSwitchBtn").innerText = mode === "signup" ? "Already have an account? Login" : "Create new account";
  document.getElementById("authName").parentElement.style.display = mode === "signup" ? "flex" : "none";
  document.getElementById("authMsg").innerText = "";
  openPopup("authPopup");
}

function closeAuthPopup() {
  closePopup("authPopup");
  document.getElementById("authName").value = "";
  document.getElementById("authEmail").value = "";
  document.getElementById("authPassword").value = "";
  document.getElementById("authMsg").innerText = "";
}

async function handleAuthSubmit() {
  const name = document.getElementById("authName").value.trim();
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const msg = document.getElementById("authMsg");
  const btn = document.getElementById("authSubmitBtn");

  msg.innerText = "";

  if (!email || !password) {
    msg.innerText = "Email aur password required hai.";
    return;
  }

  if (authMode === "signup" && !name) {
    msg.innerText = "Full name required hai.";
    return;
  }

  try {
    btn.disabled = true;
    btn.innerText = "Please wait...";

    if (authMode === "signup") {
      const result = await auth.createUserWithEmailAndPassword(email, password);
      await result.user.updateProfile({ displayName: name });
      await db.collection("users").doc(result.user.uid).set({
        name,
        email,
        phone: "",
        mobile: "",
        city: "",
        address: "",
        photoUrl: "",
        createdAt: new Date(),
        updatedAt: new Date()
      }, { merge: true });
    } else {
      await auth.signInWithEmailAndPassword(email, password);
    }

    closeAuthPopup();
  } catch (err) {
    msg.innerText = err.message || err;
  } finally {
    btn.disabled = false;
    btn.innerText = authMode === "signup" ? "Create Account" : "Login";
  }
}

function logoutUser() {
  auth.signOut();
}

function getAvatarUrl(user, profile = {}) {
  if (profile.photoUrl) return profile.photoUrl;
  if (user?.photoURL) return user.photoURL;
  const name = encodeURIComponent(profile.name || user?.displayName || "TS");
  return `https://ui-avatars.com/api/?name=${name}&background=0f766e&color=fff`;
}

async function getUserProfile(user) {
  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get();

  if (snap.exists) return snap.data();

  const profile = {
    name: user.displayName || "",
    email: user.email || "",
    phone: "",
    mobile: "",
    city: "",
    address: "",
    photoUrl: user.photoURL || "",
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await ref.set(profile, { merge: true });
  return profile;
}

function updateAuthUI() {
  const loginBtn = document.getElementById("loginOpenBtn");
  const userChip = document.getElementById("userChip");
  const displayName = currentProfile.name || currentUser?.displayName || "User";
  const displayEmail = currentUser?.email || "";
  const avatar = getAvatarUrl(currentUser, currentProfile);

  if (!currentUser) {
    loginBtn.style.display = "inline-flex";
    userChip.classList.remove("is-visible");
    document.getElementById("profileSummaryName").innerText = "Login required";
    document.getElementById("profileSummaryEmail").innerText = "Login karke apni PAN application history dekhein.";
    document.getElementById("profileSummaryPhoto").src = getAvatarUrl(null, { name: "TS" });
    document.getElementById("historyGrid").innerHTML = '<div class="empty-history">Login karne ke baad history yahan show hogi.</div>';
    return;
  }

  loginBtn.style.display = "none";
  userChip.classList.add("is-visible");
  document.getElementById("userChipName").innerText = displayName;
  document.getElementById("userChipEmail").innerText = displayEmail;
  document.getElementById("userChipPhoto").src = avatar;
  document.getElementById("profileSummaryName").innerText = displayName;
  document.getElementById("profileSummaryEmail").innerText = displayEmail;
  document.getElementById("profileSummaryPhoto").src = avatar;
}

function openProfilePopup() {
  if (!currentUser) {
    redirectToLogin();
    return;
  }

  const avatar = getAvatarUrl(currentUser, currentProfile);
  document.getElementById("profilePreview").src = avatar;
  document.getElementById("profileName").value = currentProfile.name || currentUser.displayName || "";
  document.getElementById("profileEmail").value = currentUser.email || "";
  document.getElementById("profilePhone").value = currentProfile.phone || currentProfile.mobile || "";
  document.getElementById("profileCity").value = currentProfile.city || "";
  document.getElementById("profileAddress").value = currentProfile.address || "";
  document.getElementById("profilePhoto").value = "";
  document.getElementById("profileMsg").innerText = "";
  openPopup("profilePopup");
}

function closeProfilePopup() {
  closePopup("profilePopup");
}

function openAccountPopup() {
  if (!currentUser) {
    redirectToLogin();
    return;
  }

  updateAuthUI();
  loadApplicationHistory();
  openPopup("accountPopup");
}

function closeAccountPopup() {
  closePopup("accountPopup");
}

async function saveProfile() {
  if (!currentUser) return;

  const msg = document.getElementById("profileMsg");
  const file = document.getElementById("profilePhoto").files[0];
  const profile = {
    name: document.getElementById("profileName").value.trim(),
    email: currentUser.email,
    phone: document.getElementById("profilePhone").value.trim(),
    mobile: document.getElementById("profilePhone").value.trim(),
    city: document.getElementById("profileCity").value.trim(),
    address: document.getElementById("profileAddress").value.trim(),
    updatedAt: new Date()
  };

  try {
    msg.style.color = "";
    msg.innerText = "Saving...";

    if (file) {
      profile.photoUrl = await uploadToCloudinary(file);
    } else {
      profile.photoUrl = currentProfile.photoUrl || currentUser.photoURL || "";
    }

    await db.collection("users").doc(currentUser.uid).set(profile, { merge: true });
    await currentUser.updateProfile({
      displayName: profile.name,
      photoURL: profile.photoUrl
    });

    currentProfile = { ...currentProfile, ...profile };
    updateAuthUI();
    msg.style.color = "green";
    msg.innerText = "Profile updated.";

    setTimeout(closeProfilePopup, 800);
  } catch (err) {
    msg.style.color = "red";
    msg.innerText = "Error: " + (err.message || err);
  }
}

function formatDate(value) {
  if (!value) return "N/A";
  const date = value.toDate ? value.toDate() : new Date(value);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function jsArg(value) {
  return escapeHtml(JSON.stringify(String(value ?? "")));
}

function showToast(message, type = "success") {
  let stack = document.getElementById("toastStack");

  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toastStack";
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa ${type === "error" ? "fa-circle-exclamation" : "fa-circle-check"}"></i><span>${escapeHtml(message)}</span>`;
  stack.appendChild(toast);

  setTimeout(() => toast.classList.add("is-visible"), 20);
  setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => toast.remove(), 220);
  }, 2600);
}

function getDraftKey() {
  const owner = currentUser?.uid || currentUser?.email || "guest";
  return `panFormDraft:${owner}`;
}

function collectDraftData() {
  const data = {};

  draftFieldIds.forEach((id) => {
    const field = document.getElementById(id);
    if (!field) return;
    data[id] = field.value;
  });

  return {
    values: data,
    currentStepIndex,
    isMinorApplicant,
    savedAt: Date.now()
  };
}

function saveDraft(silent = true) {
  if (!currentUser) return;
  localStorage.setItem(getDraftKey(), JSON.stringify(collectDraftData()));
  if (!silent) showToast("Draft saved");
}

function clearDraft() {
  if (!currentUser) return;
  localStorage.removeItem(getDraftKey());
}

function scheduleDraftSave() {
  clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(() => saveDraft(true), 500);
}

function loadDraft() {
  if (!currentUser) return;

  const raw = localStorage.getItem(getDraftKey());
  if (!raw) return;

  try {
    const draft = JSON.parse(raw);
    Object.entries(draft.values || {}).forEach(([id, value]) => {
      const field = document.getElementById(id);
      if (field && field.type !== "file") field.value = value || "";
    });

    isMinorApplicant = Boolean(draft.isMinorApplicant);
    currentStepIndex = Number.isInteger(draft.currentStepIndex) ? draft.currentStepIndex : 0;
    updateAadhaarName();
    showToast("Saved draft restored");
  } catch (err) {
    localStorage.removeItem(getDraftKey());
  }
}

function getStatusClass(status) {
  const normalized = (status || "pending").toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "rejected") return "rejected";
  if (normalized === "under process") return "under-process";
  return "pending";
}

function getPaymentInfo(paymentStatus) {
  const paid = paymentStatus === "paid";
  return {
    text: paid ? "Paid" : "Pending",
    className: paid ? "paid" : "pending"
  };
}

function getTimelineSteps(data) {
  const paymentPaid = data.paymentStatus === "paid";
  const status = (data.status || "pending").toLowerCase();
  const approved = status === "approved";
  const rejected = status === "rejected";
  const underProcess = status === "under process" || approved || rejected;

  return [
    { label: "Submitted", state: "done" },
    { label: paymentPaid ? "Payment Paid" : "Payment Pending", state: paymentPaid ? "done" : "active" },
    { label: "Under Process", state: underProcess ? "done" : "pending" },
    {
      label: rejected ? "Rejected" : approved ? "Approved" : "Final Status",
      state: rejected ? "rejected" : approved ? "done" : "pending"
    }
  ];
}

function renderTimeline(data) {
  return `
    <div class="status-timeline">
      ${getTimelineSteps(data).map((step) => `
        <div class="timeline-step ${step.state}">
          <span></span>
          <strong>${escapeHtml(step.label)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderStatusDetails(data) {
  const status = data.status || "pending";
  const payment = getPaymentInfo(data.paymentStatus);
  const remark = data.remark && data.remark.trim() !== "" ? data.remark : "No remark";

  return `
    <div class="status-panel">
      <div class="status-panel-head">
        <div>
          <span class="history-label">Application Status</span>
          <h4>${escapeHtml(data.name || "PAN Application")}</h4>
          <p>${escapeHtml(data.ackNo || "N/A")}</p>
        </div>
        <span class="status-badge ${getStatusClass(status)}">${escapeHtml(status)}</span>
      </div>
      ${renderTimeline(data)}
      <div class="status-list">
        <div class="status-row">
          <small>Payment</small>
          <strong><span class="payment-badge ${payment.className === "paid" ? "paid" : ""}">${payment.text}</span></strong>
        </div>
        <div class="status-row">
          <small>Applied On</small>
          <strong>${escapeHtml(formatDate(data.createdAt))}</strong>
        </div>
        <div class="status-row">
          <small>Applicant Type</small>
          <strong>${data.isMinor ? "Minor PAN" : "PAN"}</strong>
        </div>
        <div class="status-row status-row-wide">
          <small>Remark</small>
          <strong>${escapeHtml(remark)}</strong>
        </div>
      </div>
    </div>
  `;
}

function copyAck(ackNo) {
  if (!ackNo) return;
  navigator.clipboard.writeText(ackNo)
    .then(() => showToast("ACK copied: " + ackNo))
    .catch(() => {
      prompt("Copy ACK No:", ackNo);
    });
}

function showHistoryStatus(ackNo) {
  closeAccountPopup();
  document.getElementById("trackDetails").innerHTML = '<div class="status-panel">Loading...</div>';
  openPopup("trackPopup");

  db.collection("applications")
    .where("ackNo", "==", ackNo)
    .get()
    .then((snapshot) => {
      if (snapshot.empty) {
        document.getElementById("trackDetails").innerHTML = "Record not found";
        return;
      }

      const data = snapshot.docs[0].data();
      const payBtn = document.getElementById("payBtn");
      document.getElementById("trackDetails").innerHTML = renderStatusDetails(data);

      payBtn.style.display = data.paymentStatus === "paid" ? "none" : "block";
      payBtn.onclick = function () {
        openCustomerPaymentByAck(data.ackNo);
      };
    })
    .catch((err) => {
      document.getElementById("trackDetails").innerHTML = "Error: " + err.message;
    });
}

function goHistoryPayment(ackNo, paymentStatus) {
  if (!ackNo) return;
  if (paymentStatus === "paid") {
    showHistoryStatus(ackNo);
    return;
  }
  openCustomerPaymentByAck(ackNo);
}

async function loadApplicationHistory() {
  const grid = document.getElementById("historyGrid");

  if (!currentUser) {
    grid.innerHTML = '<div class="empty-history">Login karne ke baad history yahan show hogi.</div>';
    redirectToLogin();
    return;
  }

  grid.innerHTML = '<div class="empty-history">Loading history...</div>';

  try {
    const userSnapshot = await db.collection("applications")
      .where("userId", "==", currentUser.uid)
      .get();
    const emailSnapshot = await db.collection("applications")
      .where("email", "==", currentUser.email)
      .get();

    const appMap = new Map();
    userSnapshot.forEach((doc) => appMap.set(doc.id, { id: doc.id, ...doc.data() }));
    emailSnapshot.forEach((doc) => appMap.set(doc.id, { id: doc.id, ...doc.data() }));

    if (appMap.size === 0) {
      grid.innerHTML = `
        <div class="empty-history">
          <div class="empty-history-content">
            <i class="fa fa-folder-open"></i>
            <h3>No PAN history yet</h3>
            <p>Abhi tak is account se koi PAN apply nahi hua.</p>
            <button class="btn" type="button" onclick="closeAccountPopup(); openForm();">Apply New PAN</button>
          </div>
        </div>
      `;
      return;
    }

    const apps = Array.from(appMap.values())
      .sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return bTime - aTime;
      });

    grid.innerHTML = apps.map((app) => {
      const status = app.status || "pending";
      const payment = getPaymentInfo(app.paymentStatus);
      const ackNo = app.ackNo || "";
      const applicantName = app.name || "PAN Application";
      const appliedDate = formatDate(app.createdAt);
      const pendingPayment = app.paymentStatus !== "paid";
      return `
        <article class="history-card ${pendingPayment ? "payment-pending-card" : ""}">
          <div class="history-card-head">
            <div>
              <span class="history-label">Applicant</span>
              <h3>${escapeHtml(applicantName)}</h3>
              <p class="ack-line">ACK: ${escapeHtml(ackNo || "N/A")}</p>
            </div>
            <span class="status-badge ${getStatusClass(status)}">${escapeHtml(status)}</span>
          </div>
          <div class="history-details">
            <div class="history-detail">
              <small>DOB</small>
              <strong>${escapeHtml(app.dob || "N/A")}</strong>
            </div>
            <div class="history-detail">
              <small>Applied</small>
              <strong>${escapeHtml(appliedDate)}</strong>
            </div>
            <div class="history-detail">
              <small>Payment</small>
              <strong><span class="payment-badge ${payment.className === "paid" ? "paid" : ""}">${payment.text}</span></strong>
            </div>
            <div class="history-detail">
              <small>Type</small>
              <strong>${app.isMinor ? "Minor PAN" : "PAN"}</strong>
            </div>
          </div>
          <div class="history-actions">
            <button class="mini-btn" type="button" onclick="copyAck(${jsArg(ackNo)})"><i class="fa fa-copy"></i> Copy ACK</button>
            <button class="mini-btn" type="button" onclick="downloadHistoryReceipt(${jsArg(ackNo)})"><i class="fa fa-file-pdf"></i> Receipt</button>
            <button class="mini-btn" type="button" onclick="showHistoryStatus(${jsArg(ackNo)})"><i class="fa fa-circle-info"></i> Status</button>
            <button class="mini-btn ${pendingPayment ? "warn" : "primary"}" type="button" onclick="goHistoryPayment(${jsArg(ackNo)}, ${jsArg(app.paymentStatus || "")})"><i class="fa ${app.paymentStatus === "paid" ? "fa-eye" : "fa-credit-card"}"></i> ${app.paymentStatus === "paid" ? "View" : "Pay Now"}</button>
          </div>
        </article>
      `;
    }).join("");
  } catch (err) {
    grid.innerHTML = `<div class="empty-history">History load nahi hui: ${err.message || err}</div>`;
  }
}

async function uploadToCloudinary(file) {
  if (!file) throw "File missing";

  const url = "https://api.cloudinary.com/v1_1/dsnuatuc8/image/upload";
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", "ml_default");
  fd.append("folder", "pan_applications");

  try {
    const res = await fetch(url, {
      method: "POST",
      body: fd
    });

    const data = await res.json();
    console.log("Cloudinary FULL:", data);

    if (!res.ok) throw data.error?.message || "Upload failed (Bad Request)";
    if (!data.secure_url) throw "Upload failed";

    return data.secure_url.replace("/upload/", "/upload/f_auto,q_auto/");
  } catch (err) {
    console.error("Upload Error:", err);
    throw err;
  }
}

document.getElementById("newpanForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  if (currentStepIndex !== getSteps().length - 1) {
    goNextStep();
    return;
  }

  if (!validateCurrentStep()) return;

  const loading = document.getElementById("loadingOverlay");
  const submitBtn = document.querySelector("#newpanForm button[type='submit']");

  try {
    loading.style.display = "flex";
    submitBtn.disabled = true;
    submitBtn.innerText = "Processing...";

    const firstName = document.getElementById("firstName").value.trim();
    const middleName = document.getElementById("middleName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();

    const fatherName =
      document.getElementById("fatherlastName").value.trim() + " " +
      (document.getElementById("fatherMiddleName").value.trim()
        ? document.getElementById("fatherMiddleName").value.trim() + " "
        : "") +
      document.getElementById("fatherFirstName").value.trim();

    const motherName =
      document.getElementById("motherlastName").value.trim() + " " +
      (document.getElementById("motherMiddleName").value.trim()
        ? document.getElementById("motherMiddleName").value.trim() + " "
        : "") +
      document.getElementById("motherfirstName").value.trim();

    const dobValue = document.getElementById("dob").value;
    const birthDate = new Date(dobValue);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;

    const files = [
      document.getElementById("photo").files[0],
      document.getElementById("signature").files[0],
      document.getElementById("aadhaarFront").files[0],
      document.getElementById("aadhaarBack").files[0],
      document.getElementById("dobProof").files[0]
    ];

    if (files.some((file) => !file)) throw "All files required";

    const [photo, signature, aadhaarFront, aadhaarBack, dobProof] =
      await Promise.all(files.map(uploadToCloudinary));

    let guardianName = "";
    let guardianFront = "";
    let guardianBack = "";

    if (age < 18) {
      const gFirst = document.getElementById("guardianfirstName").value.trim();
      const gMiddle = document.getElementById("guardianMiddleName").value.trim();
      const gLast = document.getElementById("guardianlastName").value.trim();

      const gName = gLast + " " + (gMiddle ? gMiddle + " " : "") + gFirst;
      const gFrontFile = document.getElementById("guardianAadhaarFront").files[0];
      const gBackFile = document.getElementById("guardianAadhaarBack").files[0];

      if (!gName.trim() || !gFrontFile || !gBackFile) {
        throw "Guardian details required for minor";
      }

      guardianName = gName;
      guardianFront = await uploadToCloudinary(gFrontFile);
      guardianBack = await uploadToCloudinary(gBackFile);
    }

    const ackNo = generateAck();
    const postOfficeEl = document.getElementById("postOffice");
    const manualEl = document.getElementById("manualPO");
    const postOfficeValue = postOfficeEl.value === "manual"
      ? manualEl.value.trim()
      : postOfficeEl.value.trim();

    if (!postOfficeValue) throw "Post Office required";

    formData = {
      ackNo,
      userId: currentUser.uid,
      userEmail: currentUser.email,
      firstName,
      middleName,
      lastName,
      name: [firstName, middleName, lastName].filter(Boolean).join(" "),
      father: fatherName,
      mother: motherName,
      aadhaar: document.getElementById("aadhar").value,
      nameAadhar: document.getElementById("nameAadhar").value,
      dob: dobValue,
      age,
      isMinor: age < 18,
      gender: document.getElementById("gender").value,
      phone: document.getElementById("phone").value,
      email: document.getElementById("email").value,
      flatNo: document.getElementById("flatNo").value,
      villageCity: document.getElementById("villageCity").value,
      postOffice: postOfficeValue,
      subDivision: document.getElementById("subDivision").value,
      district: document.getElementById("district").value,
      state: document.getElementById("state").value,
      pinCode: document.getElementById("pinCode").value,
      dobdocType: document.getElementById("proof_dob").value,
      photo,
      signature,
      aadhaarFront,
      aadhaarBack,
      dobProof,
      guardianName,
      guardianFront,
      guardianBack,
      status: "pending",
      createdAt: new Date()
    };

    await db.collection("applications").add(formData);
    generatePDF(formData);
    clearDraft();
    showToast("Application submitted");

    setTimeout(() => {
      localStorage.setItem("ackNo", ackNo);
      openCustomerPaymentByAck(ackNo);
    }, 1500);
  } catch (err) {
    showToast("Error: " + err, "error");
  } finally {
    loading.style.display = "none";
    submitBtn.disabled = false;
    submitBtn.innerText = "Submit";
  }
});

function generateAck() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const random = Math.floor(1000 + Math.random() * 9000);
  return "PAN" + y + m + d + random;
}

function trackstatus() {
  document.getElementById("trackAckInput").value = "";
  document.getElementById("trackDetails").innerHTML = "";
  document.getElementById("payBtn").style.display = "none";
  document.getElementById("trackSubmitBtn").disabled = false;
  document.getElementById("trackSubmitBtn").innerText = "Check Status";
  openPopup("trackPopup");
  setTimeout(() => document.getElementById("trackAckInput").focus(), 50);
}

function submitTrackStatus() {
  let ack = document.getElementById("trackAckInput").value.trim().toUpperCase();
  const details = document.getElementById("trackDetails");
  const submitBtn = document.getElementById("trackSubmitBtn");
  const payBtn = document.getElementById("payBtn");

  if (!ack) {
    details.innerHTML = '<div class="track-message error">Please enter ACK number.</div>';
    return;
  }

  details.innerHTML = '<div class="track-message">Checking status...</div>';
  payBtn.style.display = "none";
  submitBtn.disabled = true;
  submitBtn.innerText = "Checking...";

  db.collection("applications")
    .where("ackNo", "==", ack)
    .get()
    .then((snapshot) => {
      if (snapshot.empty) {
        details.innerHTML = '<div class="track-message error">Record not found. ACK number check karein.</div>';
        return;
      }

      const data = snapshot.docs[0].data();

      if (data.paymentStatus !== "paid") {
        payBtn.style.display = "block";
        payBtn.onclick = function () {
          openCustomerPaymentByAck(data.ackNo);
        };
      } else {
        payBtn.style.display = "none";
      }

      details.innerHTML = renderStatusDetails(data);
    })
    .catch((err) => {
      details.innerHTML = '<div class="track-message error">Error: ' + escapeHtml(err.message) + '</div>';
    })
    .finally(() => {
      submitBtn.disabled = false;
      submitBtn.innerText = "Check Status";
    });
}

function closeTrackPopup() {
  closePopup("trackPopup");
  document.getElementById("trackAckInput").value = "";
  document.getElementById("trackDetails").innerHTML = "";
  document.getElementById("payBtn").style.display = "none";
}

function checkAge() {
  const dob = document.getElementById("dob").value;
  if (!dob) return;

  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;

  const isMinor = age < 18;
  isMinorApplicant = isMinor;

  if (!isMinor) {
    document.getElementById("guardianfirstName").value = "";
    document.getElementById("guardianMiddleName").value = "";
    document.getElementById("guardianlastName").value = "";
    document.getElementById("guardianAadhaarFront").value = "";
    document.getElementById("guardianAadhaarBack").value = "";
  }

  renderSteps();
}

function generatePDF(data) {
  downloadReceiptPdf({
    ...data,
    paymentStatus: data.paymentStatus || "pending",
    status: data.status || "pending"
  }, "PAN_ACK");
}

function downloadReceiptPdf(data, filePrefix = "PAN_RECEIPT") {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const payment = getPaymentInfo(data.paymentStatus);
  const status = data.status || "pending";
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const brand = [15, 118, 110];
  const dark = [18, 52, 59];
  const muted = [102, 112, 133];
  const line = [216, 224, 234];

  function money(value) {
    return "Rs. " + value;
  }

  function drawBadge(text, x, y, color) {
    const width = Math.max(28, doc.getTextWidth(text) + 12);
    doc.setFillColor(color[0], color[1], color[2]);
    doc.roundedRect(x, y - 5, width, 9, 4, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(text, x + 6, y + 1);
    return width;
  }

  function sectionTitle(title, y) {
    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, margin, y);
    doc.setDrawColor(line[0], line[1], line[2]);
    doc.line(margin, y + 4, pageWidth - margin, y + 4);
  }

  function infoRow(label, value, x, y, width) {
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), x, y);
    doc.setTextColor(23, 32, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(String(value || "N/A"), width);
    doc.text(lines, x, y + 6);
  }

  doc.setFillColor(238, 243, 248);
  doc.rect(0, 0, pageWidth, 297, "F");

  doc.setFillColor(dark[0], dark[1], dark[2]);
  doc.roundedRect(margin, 14, contentWidth, 38, 4, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("TECH SOURCE", margin + 12, 29);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("PAN Card Service Receipt", margin + 12, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("ACK RECEIPT", pageWidth - margin - 42, 29);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(formatDate(new Date()), pageWidth - margin - 42, 39);

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, 60, contentWidth, 35, 4, 4, "F");
  doc.setDrawColor(line[0], line[1], line[2]);
  doc.roundedRect(margin, 60, contentWidth, 35, 4, 4, "S");
  infoRow("Ack Number", data.ackNo || "N/A", margin + 10, 73, 64);
  infoRow("Applicant", data.name || "PAN Application", margin + 78, 73, 56);
  infoRow("Applied On", formatDate(data.createdAt), margin + 138, 73, 32);
  drawBadge(payment.text, pageWidth - margin - 42, 75, payment.className === "paid" ? [22, 101, 52] : [249, 115, 22]);

  sectionTitle("Applicant Details", 112);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, 122, contentWidth, 52, 4, 4, "F");
  doc.setDrawColor(line[0], line[1], line[2]);
  doc.roundedRect(margin, 122, contentWidth, 52, 4, 4, "S");
  infoRow("Name", data.name || "N/A", margin + 10, 136, 78);
  infoRow("DOB", data.dob || "N/A", margin + 102, 136, 34);
  infoRow("Type", data.isMinor ? "Minor PAN" : "PAN", margin + 150, 136, 34);
  infoRow("Phone", data.phone || "N/A", margin + 10, 158, 54);
  infoRow("Email", data.email || "N/A", margin + 78, 158, 96);

  sectionTitle("Application Summary", 190);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, 200, contentWidth, 45, 4, 4, "F");
  doc.setDrawColor(line[0], line[1], line[2]);
  doc.roundedRect(margin, 200, contentWidth, 45, 4, 4, "S");
  infoRow("Status", status, margin + 10, 214, 46);
  infoRow("Payment", payment.text, margin + 72, 214, 34);
  infoRow("Service Fee", money(190), margin + 120, 214, 34);
  infoRow("Remark", data.remark || "No remark", margin + 10, 234, 160);

  if (data.guardianName) {
    infoRow("Guardian", data.guardianName, margin + 120, 234, 54);
  }

  doc.setFillColor(231, 247, 244);
  doc.roundedRect(margin, 258, contentWidth, 16, 4, 4, "F");
  doc.setTextColor(11, 93, 86);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Keep this receipt for future status checks and payment reference.", margin + 10, 268);

  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Generated by TECH SOURCE PAN Card Service", margin, 286);
  doc.text("This is a system generated receipt.", pageWidth - margin - 52, 286);
  doc.save(`${filePrefix}_${data.ackNo || "APPLICATION"}.pdf`);
}

function downloadHistoryReceipt(ackNo) {
  if (!ackNo) return;

  db.collection("applications")
    .where("ackNo", "==", ackNo)
    .get()
    .then((snapshot) => {
      if (snapshot.empty) {
        showToast("Record not found", "error");
        return;
      }

      downloadReceiptPdf(snapshot.docs[0].data());
      showToast("Receipt downloaded");
    })
    .catch((err) => {
      showToast("Receipt download failed: " + err.message, "error");
    });
}

async function getPan() {
  const loading = document.getElementById("loadingOverlay");
  const submitBtn = document.getElementById("submitBtn");
  const ackInput = document.getElementById("ackNo");
  const msg = document.getElementById("downloadMsg");
  const ack = ackInput.value.trim();

  loading.style.display = "flex";
  submitBtn.disabled = true;
  submitBtn.innerText = "Processing...";
  msg.style.color = "red";
  msg.innerText = "";

  try {
    if (!ack) {
      msg.innerText = "Enter Ack No";
      return;
    }

    msg.innerText = "Checking...";
    const snapshot = await db.collection("applications")
      .where("ackNo", "==", ack)
      .get();

    if (snapshot.empty) {
      msg.innerText = "No Record Found";
      return;
    }

    const data = snapshot.docs[0].data();

    if (!data.documentUrl) {
      msg.innerText = "PAN not ready yet";
      return;
    }

    msg.innerText = "Downloading...";

    const response = await fetch(data.documentUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `PAN_${data.ackNo}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    msg.style.color = "green";
    msg.innerText = "Download Started";

    setTimeout(() => {
      closeDownloadPopup();
    }, 1500);
  } catch (err) {
    msg.innerText = "Download failed: " + (err.message || err);
  } finally {
    loading.style.display = "none";
    submitBtn.disabled = false;
    submitBtn.innerText = "Submit";
  }
}

function openPopup(id) {
  const popup = document.getElementById(id);
  popup.style.display = "flex";
  popup.classList.add("is-open");
  popup.setAttribute("aria-hidden", "false");
}

function closePopup(id) {
  const popup = document.getElementById(id);
  popup.style.display = "none";
  popup.classList.remove("is-open");
  popup.setAttribute("aria-hidden", "true");
}

function openDownloadPopup() {
  openPopup("downloadPopup");
}

function closeDownloadPopup() {
  closePopup("downloadPopup");
  document.getElementById("ackNo").value = "";
  document.getElementById("downloadMsg").innerText = "";
}

async function payNow() {
  const res = await fetch("http://localhost:5000/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: 100 })
  });

  const data = await res.json();
  const cashfree = Cashfree({ mode: "sandbox" });

  cashfree.checkout({
    paymentSessionId: data.payment_session_id,
    redirectTarget: "_self"
  });
}

function openPaymentCheck() {
  document.getElementById('paymentCheckView').hidden=false;
  document.getElementById('directPaymentView').hidden=true;
  document.getElementById('paymentAck').value='';
  document.getElementById('paymentResult').textContent='';
  document.getElementById('payNowBtn').style.display='none';
  openPopup('paymentPopup');
}

function closePaymentPopup() {
  closePopup('paymentPopup');
  document.getElementById('paymentAck').value='';
  document.getElementById('paymentResult').textContent='';
  document.getElementById('payNowBtn').style.display='none';
  document.getElementById('directPayMsg').textContent='';
  document.getElementById('directPayScreenshot').value='';
  document.getElementById('directPayUtr').value='';
}

async function findApplicationByAck(ack){
  const snap=await db.collection('applications').where('ackNo','==',String(ack||'').trim().toUpperCase()).limit(1).get();
  if(snap.empty) return null;
  return {id:snap.docs[0].id,ref:snap.docs[0].ref,...snap.docs[0].data()};
}

async function checkPaymentStatus() {
  const ack=document.getElementById('paymentAck').value.trim().toUpperCase();
  const result=document.getElementById('paymentResult'); const payBtn=document.getElementById('payNowBtn');
  if(!ack){result.textContent='Enter Ack No';result.style.color='#dc2626';return;}
  result.textContent='Checking…'; payBtn.style.display='none';
  try{
    const data=await findApplicationByAck(ack);
    if(!data){result.textContent='Record not found';result.style.color='#dc2626';return;}
    if(data.paymentStatus==='paid'){result.textContent='Payment Completed ✓';result.style.color='#15803d';}
    else {result.textContent='Payment Pending';result.style.color='#d97706';payBtn.style.display='block';payBtn.dataset.ack=ack;}
  }catch(e){result.textContent='Error: '+(e.message||e);result.style.color='#dc2626';}
}

async function goToPayment(){
  const ack=document.getElementById('payNowBtn').dataset.ack;
  if(!ack) return;
  try{ await openDirectPayment(ack); }catch(e){ document.getElementById('paymentResult').textContent='Error: '+(e.message||e); }
}

async function openDirectPayment(ack){
  const app=await findApplicationByAck(ack);
  if(!app) throw new Error('Application not found.');
  if(app.paymentStatus==='paid') throw new Error('Payment already verified.');
  document.getElementById('paymentCheckView').hidden=true;
  document.getElementById('directPaymentView').hidden=false;
  document.getElementById('directPayCustomer').textContent=`${getCustomerName(app)} • ACK ${app.ackNo}`;
  const amount=Number(app.paymentAmount||app.customerPaymentAmount||190);
  document.getElementById('directPayAmount').textContent=amount.toLocaleString('en-IN');
  const qr=document.getElementById('directPayQr'); qr.innerHTML='';
  if(window.QRCode){
    const upi=`upi://pay?pa=${encodeURIComponent(CUSTOMER_UPI_ID)}&pn=${encodeURIComponent('TECH SOURCE')}&am=${encodeURIComponent(amount.toFixed(2))}&cu=INR&tn=${encodeURIComponent('PAN Payment '+app.ackNo)}`;
    new QRCode(qr,{text:upi,width:164,height:164,colorDark:'#111827',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
  }
  document.getElementById('directPaySubmit').dataset.appId=app.id;
  document.getElementById('directPaySubmit').dataset.ack=app.ackNo;
  openPopup('paymentPopup');
}

async function submitDirectPaymentProof(){
  const btn=document.getElementById('directPaySubmit'); const appId=btn.dataset.appId; const ack=btn.dataset.ack;
  const file=document.getElementById('directPayScreenshot').files[0]; const utr=document.getElementById('directPayUtr').value.trim(); const msg=document.getElementById('directPayMsg');
  if(!appId||!ack)return;
  if(!file){msg.textContent='Payment screenshot required.';msg.style.color='#dc2626';return;}
  if(!file.type.startsWith('image/')){msg.textContent='Only image screenshot allowed.';msg.style.color='#dc2626';return;}
  if(file.size>5*1024*1024){msg.textContent='Screenshot maximum 5 MB.';msg.style.color='#dc2626';return;}
  if(!/^\d{8,25}$/.test(utr)){msg.textContent='Valid UTR / Transaction ID required (8–25 digits).';msg.style.color='#dc2626';return;}
  btn.disabled=true; msg.textContent='Uploading payment proof…';msg.style.color='#2563eb';
  try{
    const screenshot=await uploadPaymentProofToCloudinary(file,ack);
    const now=firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('applications').doc(appId).update({paymentStatus:'verification_pending',paymentUtr:utr,paymentScreenshot:screenshot,paymentSubmittedAt:now});
    msg.textContent='Payment request sent to admin for verification ✓';msg.style.color='#15803d';
    setTimeout(closePaymentPopup,1200);
  }catch(e){msg.textContent='Error: '+(e.message||e);msg.style.color='#dc2626';btn.disabled=false;}
}

async function uploadPaymentProofToCloudinary(file,ack){
  const url='https://api.cloudinary.com/v1_1/dsnuatuc8/image/upload';
  const fd=new FormData(); fd.append('file',file); fd.append('upload_preset','ml_default'); fd.append('folder','pan_payment_proofs/'+ack);
  const res=await fetch(url,{method:'POST',body:fd});
  const data=await res.json(); if(!res.ok) throw new Error(data?.error?.message||'Payment screenshot upload failed');
  return data.secure_url||data.url;
}

/* ================= CUSTOMER PAYMENT FLOW ================= */
const CUSTOMER_UPI_ID = "9661905351-3@axl";
let customerPaymentContext = null;
let customerPaymentLoaded = false;

async function openCustomerPaymentByAck(ack){
  const clean=String(ack||'').trim().toUpperCase(); if(!clean)return;
  try{
    const app=await findApplicationByAck(clean); if(!app) throw new Error('Application not found.');
    if(app.paymentStatus==='paid'){showToast('Payment already completed');return;}
    let requestId=app.customerPaymentRequestId;
    if(!requestId){
      const ref=db.collection('customerPaymentRequests').doc();
      await ref.set({applicationId:app.id,ackNo:app.ackNo,name:getCustomerName(app),phone:app.phone||'',email:app.email||'',amount:Number(app.paymentAmount||190),utrMode:'required',utrRequired:true,showUtrAfterDone:true,status:'pending',paymentStatus:'pending',createdAt:firebase.firestore.FieldValue.serverTimestamp()});
      requestId=ref.id;
      await app.ref.update({customerPaymentRequestId:requestId,customerPaymentAmount:Number(app.paymentAmount||190),customerPaymentStatus:'pending'});
    }
    window.location.href=getCustomerPaymentUrl(requestId);
  }catch(e){showToast('Payment link error: '+(e.message||e),'error');}
}

function getCustomerPaymentUrl(requestId){
  return `${window.location.origin}${window.location.pathname}?customerPayId=${encodeURIComponent(requestId)}`;
}

function getCustomerName(data){
  return String(data?.name || [data?.firstName,data?.middleName,data?.lastName].filter(Boolean).join(' ') || 'Customer').trim();
}

async function loadCustomerPaymentPage(){
  const qs=new URLSearchParams(window.location.search);
  const requestId=qs.get('customerPayId');
  const ack=qs.get('customerPay');
  if(!requestId && !ack) return false;

  document.body.classList.add('customer-payment-mode');
  const page=document.getElementById('customerPaymentPage');
  page.classList.add('is-active');
  customerPaymentLoaded=true;

  try{
    let requestData=null, requestRef=null;
    if(requestId){
      requestRef=db.collection('customerPaymentRequests').doc(requestId);
      const snap=await requestRef.get();
      if(!snap.exists) throw new Error('Payment link expired or not found.');
      requestData={id:snap.id,...snap.data()};
    }else{
      const snap=await db.collection('applications').where('ackNo','==',String(ack).toUpperCase()).limit(1).get();
      if(snap.empty) throw new Error('Payment request not found.');
      const app={id:snap.docs[0].id,...snap.docs[0].data()};
      if(app.paymentStatus==='paid') throw new Error('This PAN payment is already completed.');
      requestData={id:'',ackNo:app.ackNo,name:getCustomerName(app),phone:app.phone||'',email:app.email||'',amount:Number(app.paymentAmount||190),utrRequired:true,status:'pending',applicationId:app.id};
    }

    customerPaymentContext={...requestData,ref:requestRef};
    document.getElementById('cpName').textContent=getCustomerName(requestData);
    document.getElementById('cpPhone').textContent=requestData.phone || '—';
    document.getElementById('cpEmail').textContent=requestData.email || '—';
    document.getElementById('cpAck').textContent=requestData.ackNo || '—';
    document.getElementById('cpAmount').textContent=Number(requestData.amount||0).toLocaleString('en-IN');
    document.getElementById('cpUpi').textContent=CUSTOMER_UPI_ID;

    const title=document.getElementById('cpTitle');
    const message=document.getElementById('cpMessage');
    const done=document.getElementById('cpDoneBtn');
    const status=document.getElementById('cpStatus');
    const utrWrap=document.getElementById('cpUtrWrap');
    const submit=document.getElementById('cpSubmitProofBtn');
    const utrInput=document.getElementById('cpUtr');
    const required=String(requestData.utrMode|| (requestData.utrRequired?'required':'optional'))==='required';
    utrWrap.hidden=!requestData.showUtrAfterDone;
    document.getElementById('cpUtrRequiredMark').style.display=required?'inline':'none';
    if(required) utrInput.setAttribute('required','required'); else utrInput.removeAttribute('required');

    if(requestData.status==='customer_marked_paid' || requestData.status==='verification_pending'){
      title.textContent='Payment Request Sent';
      message.textContent='Your payment has been marked as done. TECH SOURCE will verify it and continue your PAN card process.';
      done.hidden=true;
      utrWrap.hidden=!requestData.showUtrAfterDone;
      submit.hidden=!requestData.showUtrAfterDone;
      status.textContent=requestData.utrRequired?'Please submit your UTR / Transaction ID below.':'Your payment request is now pending admin verification.';
      status.style.color='#2563eb';
    }else if(requestData.status==='paid' || requestData.paymentStatus==='paid'){
      title.textContent='Payment Completed';
      message.textContent='Your payment has already been verified. PAN card process can continue.';
      done.hidden=true; utrWrap.hidden=true; submit.hidden=true;
      status.textContent='Payment verified ✓'; status.style.color='#15803d';
    }else{
      done.hidden=false; utrWrap.hidden=true; submit.hidden=true;
    }

    const qr=document.getElementById('cpQr'); qr.innerHTML='';
    if(window.QRCode){
      const upi=`upi://pay?pa=${encodeURIComponent(CUSTOMER_UPI_ID)}&pn=${encodeURIComponent('TECH SOURCE')}&am=${encodeURIComponent(Number(requestData.amount||0).toFixed(2))}&cu=INR&tn=${encodeURIComponent('PAN Payment '+(requestData.ackNo||''))}`;
      new QRCode(qr,{text:upi,width:164,height:164,colorDark:'#111827',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
    }
    return true;
  }catch(err){
    document.getElementById('cpTitle').textContent='Payment Link Unavailable';
    document.getElementById('cpMessage').textContent=err.message||'Payment request could not be loaded.';
    document.getElementById('cpDoneBtn').hidden=true;
    document.getElementById('cpStatus').textContent='Please contact TECH SOURCE support.';
    document.getElementById('cpStatus').style.color='#dc2626';
    return true;
  }
}

async function customerPaymentDone(){
  if(!customerPaymentContext || !customerPaymentContext.id) return;
  const btn=document.getElementById('cpDoneBtn');
  const status=document.getElementById('cpStatus');
  btn.disabled=true; status.textContent='Sending payment request…'; status.style.color='#2563eb';
  try{
    const now=firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('customerPaymentRequests').doc(customerPaymentContext.id).update({
      status:'customer_marked_paid', customerMarkedPaid:true, customerMarkedPaidAt:now
    });
    if(customerPaymentContext.applicationId){
      await db.collection('applications').doc(customerPaymentContext.applicationId).update({
        paymentStatus:'verification_pending', customerPaymentRequestId:customerPaymentContext.id, paymentRequestSubmittedAt:now
      });
    }
    customerPaymentContext.status='customer_marked_paid';
    btn.hidden=true;
    const required=String(customerPaymentContext.utrMode||'optional')==='required';
    const utrWrap=document.getElementById('cpUtrWrap'); const submit=document.getElementById('cpSubmitProofBtn');
    utrWrap.hidden=false; submit.hidden=false;
    document.getElementById('cpUtrRequiredMark').style.display=required?'inline':'none';
    document.getElementById('cpUtr').toggleAttribute('required',required);
    status.textContent=required?'Payment request sent. Please enter your UTR to finish.':'Payment request sent to admin for verification. UTR is optional.';
    status.style.color='#2563eb';
  }catch(err){
    status.textContent='Could not send request: '+(err.message||err); status.style.color='#dc2626'; btn.disabled=false;
  }
}

async function submitCustomerPaymentRequest(){
  if(!customerPaymentContext?.id) return;
  const input=document.getElementById('cpUtr');
  const utr=input.value.trim();
  const required=String(customerPaymentContext.utrMode||'optional')==='required';
  if(required && !utr){ input.focus(); document.getElementById('cpStatus').textContent='UTR / Transaction ID required.'; document.getElementById('cpStatus').style.color='#dc2626'; return; }
  if(utr && !/^\d{8,25}$/.test(utr)){ input.focus(); document.getElementById('cpStatus').textContent='UTR should contain 8–25 digits.'; document.getElementById('cpStatus').style.color='#dc2626'; return; }
  const btn=document.getElementById('cpSubmitProofBtn'); const status=document.getElementById('cpStatus');
  btn.disabled=true; status.textContent='Submitting to admin…'; status.style.color='#2563eb';
  try{
    const now=firebase.firestore.FieldValue.serverTimestamp();
    const update={status:'verification_pending',paymentStatus:'verification_pending',utr:utr||'',utrSubmitted:!!utr,utrSubmittedAt:now,customerSubmittedAt:now};
    await db.collection('customerPaymentRequests').doc(customerPaymentContext.id).update(update);
    if(customerPaymentContext.applicationId){
      await db.collection('applications').doc(customerPaymentContext.applicationId).update({paymentStatus:'verification_pending',paymentUtr:utr||'',paymentRequestId:customerPaymentContext.id,paymentSubmittedAt:now});
    }
    customerPaymentContext.status='verification_pending';
    document.getElementById('cpTitle').textContent='Payment Submitted';
    document.getElementById('cpMessage').textContent='Thank you. Your payment request has been sent to TECH SOURCE for verification.';
    status.textContent='Admin verification pending ✓'; status.style.color='#15803d';
    btn.hidden=true; input.disabled=true;
  }catch(err){ btn.disabled=false; status.textContent='Submission failed: '+(err.message||err); status.style.color='#dc2626'; }
}

function openCustomerPaymentCreator(){
  openPopup('customerPaymentCreator');
  document.getElementById('customerPayCreateMsg').textContent='';
  document.getElementById('customerPayLinkBox').hidden=true;
  setTimeout(()=>document.getElementById('customerPayAck')?.focus(),80);
}
function closeCustomerPaymentCreator(){closePopup('customerPaymentCreator');}

async function previewCustomerPaymentApplication(){
  const ack=document.getElementById('customerPayAck')?.value.trim().toUpperCase();
  const box=document.getElementById('customerPayPreview'); if(!box) return;
  if(!ack){box.textContent='ACK enter karke details load karein.';return;}
  box.textContent='Loading customer details…';
  try{
    const snap=await db.collection('applications').where('ackNo','==',ack).limit(1).get();
    if(snap.empty){box.textContent='ACK not found.';return;}
    const d=snap.docs[0].data();
    box.innerHTML=`<strong>${escapeHtml(getCustomerName(d))}</strong><br>Mobile: ${escapeHtml(d.phone||'—')} &nbsp;•&nbsp; Email: ${escapeHtml(d.email||'—')}<br>Payment status: ${escapeHtml(d.paymentStatus||'pending')}`;
  }catch(e){box.textContent='Could not load: '+(e.message||e);}
}

async function createCustomerPaymentLink(){
  const ack=document.getElementById('customerPayAck').value.trim().toUpperCase();
  const amount=Number(document.getElementById('customerPayAmount').value);
  const utrMode=document.querySelector('input[name="customerUtrMode"]:checked')?.value||'required';
  const msg=document.getElementById('customerPayCreateMsg'); const btn=document.getElementById('createCustomerPayBtn');
  if(!ack){msg.textContent='ACK required.';msg.style.color='#dc2626';return;}
  if(!Number.isFinite(amount)||amount<=0){msg.textContent='Valid price enter karein.';msg.style.color='#dc2626';return;}
  btn.disabled=true; msg.textContent='Creating payment request…'; msg.style.color='#2563eb';
  try{
    const snap=await db.collection('applications').where('ackNo','==',ack).limit(1).get();
    if(snap.empty) throw new Error('ACK not found.');
    const appDoc=snap.docs[0]; const app=appDoc.data();
    const ref=db.collection('customerPaymentRequests').doc();
    await ref.set({
      applicationId:appDoc.id, ackNo:app.ackNo, name:getCustomerName(app), phone:app.phone||'', email:app.email||'',
      amount:Math.round(amount), utrMode, utrRequired:utrMode==='required', showUtrAfterDone:true,
      status:'pending', paymentStatus:'pending', createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });
    const link=getCustomerPaymentUrl(ref.id);
    await appDoc.ref.update({customerPaymentRequestId:ref.id, customerPaymentAmount:Math.round(amount), customerPaymentStatus:'pending'});
    document.getElementById('customerPayLink').value=link;
    document.getElementById('customerPayLinkBox').hidden=false;
    msg.textContent='Payment link ready. Customer details and price are locked to this request.'; msg.style.color='#15803d';
  }catch(e){msg.textContent='Error: '+(e.message||e);msg.style.color='#dc2626';}
  finally{btn.disabled=false;}
}

async function copyCustomerPaymentLink(){
  const input=document.getElementById('customerPayLink'); const text=input.value; if(!text)return;
  try{await navigator.clipboard.writeText(text);}catch{input.select();document.execCommand('copy');}
  showToast('Customer payment link copied');
}
function shareCustomerPaymentLink(){
  const link=document.getElementById('customerPayLink').value; if(!link)return;
  const text='Dear Customer, your PAN card payment is pending. Please complete your payment to continue the PAN card process.\n\nPayment Link: '+link;
  if(navigator.share) navigator.share({title:'TECH SOURCE PAN Payment',text}).catch(()=>{});
  else window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank');
}

function updateAadhaarName() {
  const first = document.getElementById("firstName").value.trim();
  const middle = document.getElementById("middleName").value.trim();
  const last = document.getElementById("lastName").value.trim();
  const fullName = [first, middle, last].filter(Boolean).join(" ").toUpperCase();
  document.getElementById("nameAadhar").value = fullName;
}

document.getElementById("firstName").addEventListener("input", updateAadhaarName);
document.getElementById("middleName").addEventListener("input", updateAadhaarName);
document.getElementById("lastName").addEventListener("input", updateAadhaarName);

async function fetchAddress() {
  const pin = document.getElementById("pinCode").value;
  const select = document.getElementById("postOffice");

  if (pin.length !== 6) return;

  try {
    select.innerHTML = "<option>Loading...</option>";

    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const data = await res.json();

    if (data[0].Status === "Success") {
      const offices = data[0].PostOffice;
      select.innerHTML = '<option value="">Select Post Office</option>';

      offices.forEach((po, index) => {
        const option = document.createElement("option");
        option.value = po.Name;
        option.text = `${po.Name} (${po.BranchType})`;
        select.appendChild(option);

        if (index === 0) {
          document.getElementById("district").value = po.District;
          document.getElementById("state").value = po.State;
        }
      });

      const manualOption = document.createElement("option");
      manualOption.value = "manual";
      manualOption.text = "Not in list? Enter manually";
      select.appendChild(manualOption);
    } else {
      select.innerHTML = "<option>No Post Office Found</option>";
      showToast("Invalid PIN Code", "error");
    }
  } catch (err) {
    console.error(err);
    select.innerHTML = "<option>Error loading</option>";
    showToast("Error fetching address", "error");
  }
}

document.getElementById("postOffice").addEventListener("change", function () {
  const manualInput = document.getElementById("manualPO");

  if (this.value === "manual") {
    manualInput.style.display = "block";
  } else {
    manualInput.style.display = "none";
    manualInput.value = "";
  }
});

document.querySelectorAll("#newpanForm input, #newpanForm select").forEach((field) => {
  if (field.type === "file") {
    field.addEventListener("change", () => {
      showToast("Documents selected. Files are not saved in draft.");
    });
    return;
  }

  field.addEventListener("input", scheduleDraftSave);
  field.addEventListener("change", scheduleDraftSave);
});

document.getElementById("customerPayAck")?.addEventListener("input", previewCustomerPaymentApplication);
document.getElementById("customerPayAck")?.addEventListener("change", previewCustomerPaymentApplication);

document.getElementById("loginOpenBtn").addEventListener("click", redirectToLogin);
document.getElementById("authSubmitBtn")?.addEventListener("click", handleAuthSubmit);
document.getElementById("authSwitchBtn")?.addEventListener("click", () => {
  redirectToLogin();
});

document.getElementById("trackAckInput")?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    submitTrackStatus();
  }
});

document.getElementById("profilePhoto").addEventListener("change", function () {
  const file = this.files[0];
  if (!file) return;
  document.getElementById("profilePreview").src = URL.createObjectURL(file);
});

auth.onAuthStateChanged(async (user) => {
  currentUser = user;

  if (!user) {
    currentProfile = {};
    updateAuthUI();
    return;
  }

  currentProfile = await getUserProfile(user);
  updateAuthUI();
  loadApplicationHistory();
});

loadCustomerPaymentPage();

document.getElementById("nextStepBtn").addEventListener("click", goNextStep);
document.getElementById("prevStepBtn").addEventListener("click", goPrevStep);
renderSteps();

/* ================= GEMINI AI COPILOT =================
   Gemini 3.6 Flash + Interactions API
   Replace only the placeholder below with your Gemini API key.
   Do NOT paste your key into chat.
*/
const GEMINI_API_KEY = "PASTE_YOUR_GEMINI_API_KEY_HERE";
const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
let geminiBusy = false;
let geminiInteractionId = null;
let geminiLastUserText = '';
let geminiConfirmedSensitive = false;

function toggleGeminiPanel(){
  const p=document.getElementById('geminiPanel');
  p.classList.toggle('open');
  if(p.classList.contains('open')) setTimeout(()=>document.getElementById('geminiInput')?.focus(),80);
}
function isVisibleElement(el){
  if(!el) return false;
  const r=el.getBoundingClientRect();
  const st=getComputedStyle(el);
  return st.display!=='none' && st.visibility!=='hidden' && r.width>0 && r.height>0;
}
function labelForElement(el){
  if(!el) return '';
  const lab=el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
  return (lab?.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || el.id || el.tagName).replace(/[*:]/g,'').trim();
}
function geminiState(){
  const active=document.querySelector('.form-section.is-active');
  const elements=[...document.querySelectorAll('input,select,textarea,button,a,[role="button"]')].filter(isVisibleElement);
  const fields=elements.filter(x=>x.id && ['INPUT','SELECT','TEXTAREA'].includes(x.tagName) && x.type!=='password' && x.type!=='file').slice(0,120);
  const controls=elements.filter(x=>x.id || x.tagName==='BUTTON').slice(0,180);
  return {
    loggedIn:!!currentUser,
    userEmail:currentUser?.email||'',
    formOpen:document.getElementById('formScreen')?.classList.contains('is-open')||false,
    activeStep:active?.dataset.step||'',
    activeStepText:active?.querySelector('h3')?.innerText||'',
    paymentPopupOpen:document.getElementById('paymentPopup')?.classList.contains('is-open')||false,
    trackPopupOpen:document.getElementById('trackPopup')?.classList.contains('is-open')||false,
    fields:fields.map(x=>({id:x.id,label:labelForElement(x),type:x.type||x.tagName.toLowerCase(),value:x.type==='checkbox'||x.type==='radio'?x.checked:x.value,disabled:!!x.disabled})),
    controls:controls.map(x=>({id:x.id||'',tag:x.tagName.toLowerCase(),text:(x.innerText||x.value||'').trim().replace(/\\s+/g,' ').slice(0,100),disabled:!!x.disabled,checked:x.checked===true})),
    title:document.title
  };
}
function geminiVisibleText(){
  return [...document.querySelectorAll('body *')]
    .filter(e=>e.children.length===0 && e.innerText && isVisibleElement(e))
    .slice(0,350)
    .map(e=>e.innerText.trim())
    .filter(Boolean).join(' ').slice(0,10000);
}
function addGeminiMessage(text,who='ai',suggestions=[]){
  const box=document.getElementById('geminiMessages');
  const el=document.createElement('div'); el.className='gmsg '+who;
  const content=document.createElement('div'); content.textContent=text; el.appendChild(content);
  if(who==='ai'){
    const tools=document.createElement('div'); tools.className='gtools';
    tools.innerHTML='<button class="gtool" type="button">Copy</button><button class="gtool" type="button">👍</button><button class="gtool" type="button">👎</button><button class="gtool" type="button">🔊</button>';
    tools.children[0].onclick=async()=>{
      const btn=tools.children[0];
      try{
        if(navigator.clipboard && window.isSecureContext){ await navigator.clipboard.writeText(text); }
        else{
          const ta=document.createElement('textarea'); ta.value=text; ta.setAttribute('readonly',''); ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0,ta.value.length);
          const ok=document.execCommand('copy'); ta.remove(); if(!ok) throw new Error('copy failed');
        }
        btn.textContent='Copied ✓'; setTimeout(()=>btn.textContent='Copy',1400);
      }catch(err){ try{window.prompt('Copy this text:',text);}catch{} }
    };
    tools.children[1].onclick=()=>tools.children[1].textContent='👍 ✓';
    tools.children[2].onclick=()=>tools.children[2].textContent='👎 ✓';
    tools.children[3].onclick=()=>{try{speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(text));}catch{}};
    el.appendChild(tools);
  }
  box.appendChild(el);
  box.scrollTop=box.scrollHeight;
  if(who==='ai') renderGeminiSuggestions(suggestions);
  return el;
}
function setGeminiStatus(t,err=false){const s=document.getElementById('geminiStatus');s.textContent=t;s.classList.toggle('err',err)}
function renderGeminiSuggestions(items=[]){
  const box=document.getElementById('geminiSuggestions'); if(!box)return;
  box.innerHTML='';
  const clean=[...new Set((Array.isArray(items)?items:[]).map(x=>String(x||'').trim()).filter(Boolean))].slice(0,5);
  clean.forEach(text=>{
    const b=document.createElement('button'); b.type='button'; b.className='gsuggestion'; b.textContent=text;
    b.onclick=()=>{const input=document.getElementById('geminiInput'); input.value=text; sendGeminiMessage();};
    box.appendChild(b);
  });
}

const GEMINI_TOOL_DEFS=[
  {type:'function',name:'execute_page_actions',description:'Execute multiple safe website UI actions in one turn. Use this whenever the user asks to fill several fields, click several buttons, select options, open/close sections, scroll, focus, or otherwise operate the page. Prefer one call containing ALL required actions instead of one action per field. Never use this to bypass browser file-selection security.',parameters:{type:'object',properties:{actions:{type:'array',items:{type:'object',properties:{type:{type:'string',enum:['click','fill','select','check','uncheck','focus','scroll','back','open_form','open_login','open_payment','track_status']},id:{type:'string'},value:{type:'string'},y:{type:'number'}},required:['type']}}},required:['actions']}},
  {type:'function',name:'get_page_state',description:'Read the current visible page controls and form values. Use this when you need to locate a field/button or verify what happened.',parameters:{type:'object',properties:{},additionalProperties:false}},
  {type:'function',name:'request_sensitive_confirmation',description:'Ask the user for confirmation before a sensitive final action such as submitting a PAN application or submitting payment proof.',parameters:{type:'object',properties:{action:{type:'string'},details:{type:'string'}},required:['action','details']}},
];

function findControl(id){
  if(!id)return null;
  return document.getElementById(id) || document.querySelector(`[name="${CSS.escape(id)}"]`);
}
function setElementValue(el,value){
  if(!el)return 'element not found';
  if(el.disabled)return 'disabled';
  if(el.type==='file')return 'file-input';
  if(el.tagName==='SELECT'){
    const target=String(value??'');
    const opt=[...el.options].find(o=>o.value===target || o.text.trim().toLowerCase()===target.trim().toLowerCase());
    if(!opt)return 'option not found';
    el.value=opt.value;
  }else{
    const proto=Object.getPrototypeOf(el); const desc=Object.getOwnPropertyDescriptor(proto,'value');
    if(desc?.set) desc.set.call(el,String(value??'')); else el.value=String(value??'');
  }
  el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); el.dispatchEvent(new Event('blur',{bubbles:true}));
  return 'ok';
}
function clickElement(el){ if(!el)return 'element not found'; if(el.disabled)return 'disabled'; el.click(); return 'ok'; }
function isSensitiveControl(el){
  if(!el)return false;
  const text=((el.innerText||el.value||el.id||'')+' '+labelForElement(el)).toLowerCase();
  return el.type==='submit' || /submit|apply|confirm payment|payment proof|pay now|final|proceed|send payment/.test(text);
}
function executePageActions(actions,confirmed=false){
  const results=[];
  for(const a of (Array.isArray(actions)?actions:[])){
    const type=String(a?.type||'').toLowerCase();
    if(['open_form','open_login','open_payment','track_status','back','scroll'].includes(type)){
      if(type==='open_form'){openForm();results.push('open_form: ok');}
      else if(type==='open_login'){openAuthPopup('login');results.push('open_login: ok');}
      else if(type==='open_payment'){openPaymentCheck();results.push('open_payment: ok');}
      else if(type==='track_status'){trackstatus();results.push('track_status: ok');}
      else if(type==='back'){if(document.getElementById('formScreen')?.classList.contains('is-open'))closeForm();else history.back();results.push('back: ok');}
      else {window.scrollTo({top:Math.max(0,Number(a.y)||0),behavior:'smooth'});results.push('scroll: ok');}
      continue;
    }
    const el=findControl(a.id);
    if(!el){results.push(`${type}:${a.id||''}: not found`);continue;}
    if((type==='click'||type==='check'||type==='uncheck') && isSensitiveControl(el) && !confirmed){results.push(`${type}:${a.id}: CONFIRMATION_REQUIRED`);continue;}
    try{
      if(type==='click')results.push(`click:${a.id}:${clickElement(el)}`);
      else if(type==='fill')results.push(`fill:${a.id}:${setElementValue(el,a.value)}`);
      else if(type==='select')results.push(`select:${a.id}:${setElementValue(el,a.value)}`);
      else if(type==='check'){if(el.type==='checkbox' || el.type==='radio'){if(!el.checked)el.click();results.push(`check:${a.id}:ok`);}else results.push(`check:${a.id}:not-checkable`);}
      else if(type==='uncheck'){if(el.type==='checkbox'){if(el.checked)el.click();results.push(`uncheck:${a.id}:ok`);}else results.push(`uncheck:${a.id}:not-checkable`);}
      else if(type==='focus'){el.focus();el.scrollIntoView({behavior:'smooth',block:'center'});results.push(`focus:${a.id}:ok`);}
      else results.push(`${type}:${a.id}:unsupported`);
    }catch(e){results.push(`${type}:${a.id}:error ${e.message}`)}
  }
  return results;
}
function requestSensitiveConfirmation(action,details){
  const ok=window.confirm(`Gemini AI sensitive action:\n\n${action}\n${details}\n\nKya aap continue karna chahte hain?`);
  return ok?'confirmed':'cancelled';
}
function extractSteps(data){return Array.isArray(data?.steps)?data.steps:[];}
function extractFunctionCalls(data){
  return extractSteps(data).filter(s=>s?.type==='function_call' || s?.step?.type==='function_call').map(s=>{
    const x=s.step||s;
    let args=x.arguments||{}; if(typeof args==='string'){try{args=JSON.parse(args)}catch{args={}}}
    return {id:x.id,name:x.name,arguments:args};
  });
}
function extractOutputText(data){
  if(typeof data?.output_text==='string')return data.output_text;
  const steps=extractSteps(data);
  const parts=[];
  for(const s of steps){const x=s.step||s;if(x?.type==='model_output'){for(const c of (x.content||[])){if(c?.type==='text' && typeof c.text==='string')parts.push(c.text);}}}
  return parts.join('');
}
function parseFinal(text){
  try{return JSON.parse(text)}catch{}
  return {message:text||'Done.',suggestions:[]};
}
const GEMINI_RESPONSE_SCHEMA={type:'object',properties:{message:{type:'string'},suggestions:{type:'array',items:{type:'string'},maxItems:5}},required:['message','suggestions'],additionalProperties:false};
const GEMINI_SYSTEM=`You are the TECH SOURCE PAN Service website copilot. Speak concise Hinglish. You have real control over the current webpage through tools.
RULES:
1) When the user gives multiple values in one message, perform ALL applicable field fills/selects/checks in ONE execute_page_actions call. Do not stop after the first field.
2) You may operate buttons, links, tabs, checkboxes, selects, navigation, scrolling and visible form controls. Use the page state to identify exact IDs.
3) For file inputs: you cannot choose a local file because browser security blocks programmatic file selection. You may click the file input to open the user's file picker, then tell the user to choose the file.
4) Never fill password fields. Never invent values.
5) Before a final application submission or payment-proof submission, use request_sensitive_confirmation. Do not bypass confirmation.
6) After actions, verify important results with get_page_state when useful.
7) Do not ask the user to repeat information already supplied. If they give name, DOB, Aadhaar, address, mobile etc., fill every matching visible field in the same turn.
8) Every final response MUST include 2-5 short context-relevant suggestions for the next likely action/question. Suggestions must be directly related to the current conversation and current page state, not generic.
9) If the user is only asking a question, answer it and provide relevant one-tap suggestions.
Current page state will be supplied with each request.`;

async function geminiRequest(body){
  const res=await fetch(GEMINI_INTERACTIONS_URL,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':GEMINI_API_KEY},body:JSON.stringify(body)});
  const raw=await res.text(); if(!res.ok)throw new Error(`HTTP ${res.status}: ${raw.slice(0,700)}`); return JSON.parse(raw);
}
async function callGemini(inputText){
  const page=`\nCURRENT PAGE STATE:\n${JSON.stringify(geminiState())}\nVISIBLE PAGE TEXT:\n${geminiVisibleText()}`;
  let first=await geminiRequest({model:GEMINI_MODEL,input:inputText+page,previous_interaction_id:geminiInteractionId||undefined,system_instruction:GEMINI_SYSTEM,tools:GEMINI_TOOL_DEFS,response_format:{type:'text',mime_type:'application/json',schema:GEMINI_RESPONSE_SCHEMA}});
  geminiInteractionId=first?.id||geminiInteractionId;
  let calls=extractFunctionCalls(first);
  let loops=0;
  while(calls.length && loops<3){
    loops++;
    const results=[];
    for(const c of calls){
      let result;
      if(c.name==='execute_page_actions') { result={results:executePageActions(c.arguments?.actions||[],geminiConfirmedSensitive)}; geminiConfirmedSensitive=false; }
      else if(c.name==='get_page_state') result=geminiState();
      else if(c.name==='request_sensitive_confirmation') { const confirmation=requestSensitiveConfirmation(c.arguments?.action||'Sensitive action',c.arguments?.details||''); geminiConfirmedSensitive=confirmation==='confirmed'; result={confirmation}; }
      else result={error:'Unknown tool'};
      results.push({type:'function_result',name:c.name,call_id:c.id,result:{content:[{type:'text',text:JSON.stringify(result)}]}});
    }
    first=await geminiRequest({model:GEMINI_MODEL,previous_interaction_id:geminiInteractionId,input:results,tools:GEMINI_TOOL_DEFS,response_format:{type:'text',mime_type:'application/json',schema:GEMINI_RESPONSE_SCHEMA}});
    geminiInteractionId=first?.id||geminiInteractionId;
    calls=extractFunctionCalls(first);
  }
  const parsed=parseFinal(extractOutputText(first));
  return {message:parsed.message||'Done.',suggestions:Array.isArray(parsed.suggestions)?parsed.suggestions:[],state:geminiState()};
}
async function sendGeminiMessage(){
  if(geminiBusy)return;
  const input=document.getElementById('geminiInput'); const text=input.value.trim(); if(!text)return;
  if(!GEMINI_API_KEY || GEMINI_API_KEY.includes('PASTE_YOUR')){addGeminiMessage('Gemini API key set nahi hai. pan-service.js me GEMINI_API_KEY me apni key paste karein.','ai',['PAN form kholo','Login kholo','Payment status kholo']);return;}
  input.value=''; geminiLastUserText=text; addGeminiMessage(text,'user'); geminiBusy=true; document.getElementById('geminiSend').disabled=true; setGeminiStatus('Gemini page control kar raha hai…');
  try{const reply=await callGemini(text); addGeminiMessage(reply.message||'Done.', 'ai', reply.suggestions); setGeminiStatus('Ready');}
  catch(e){console.error(e);addGeminiMessage('❌ Gemini error: '+(e.message||e),'ai',['PAN form kholo','Current page batao','Login kholo']);setGeminiStatus('Error',true);}
  finally{geminiBusy=false;document.getElementById('geminiSend').disabled=false;}
}
document.addEventListener('keydown',e=>{if(e.target?.id==='geminiInput' && e.key==='Enter' && !e.shiftKey){e.preventDefault();sendGeminiMessage();}});
