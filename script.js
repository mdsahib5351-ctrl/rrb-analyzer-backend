const firebaseConfig = {
  apiKey: "AIzaSyDm3NcIjnLestNntscRXbeChvEwwqxkg8E",
  authDomain: "zoprint-c4891.firebaseapp.com",
  databaseURL: "https://zoprint-c4891-default-rtdb.firebaseio.com",
  projectId: "zoprint-c4891",
  storageBucket: "zoprint-c4891.firebasestorage.app",
  messagingSenderId: "944996490044",
  appId: "1:944996490044:web:ccfc3cfacc4acd04d45c39",
  measurementId: "G-CVWYCKMN01"
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

function resetFormFieldsBySelector(selector) {
  document.querySelectorAll(selector).forEach((el) => {
    if (el.type === "file") {
      el.value = "";
    } else if (el.type === "checkbox" || el.type === "radio") {
      el.checked = false;
    } else {
      el.value = "";
    }
  });
}

function resetNewPanFormAfterSubmit() {
  clearTimeout(draftSaveTimer);
  const form = document.getElementById("newpanForm");
  if (!form) return;
  form.reset();
  form.querySelectorAll("input[type=file]").forEach((el) => { el.value = ""; });
  const po = document.getElementById("postOffice");
  if (po) po.innerHTML = '<option value="">Select Post Office</option>';
  const manual = document.getElementById("manualPO");
  if (manual) manual.value = "";
  isMinorApplicant = false;
  currentStepIndex = 0;
  formData = {};
  const preview = document.getElementById("newPanPreviewPhoto");
  if (preview) preview.removeAttribute("src");
  updateNewPanPreview();
  renderSteps();
  clearDraft();
}

function updateNewPanPreview() {
  const name = [document.getElementById("firstName")?.value, document.getElementById("middleName")?.value, document.getElementById("lastName")?.value].filter(Boolean).join(" ").trim();
  const father = [document.getElementById("fatherFirstName")?.value, document.getElementById("fatherMiddleName")?.value, document.getElementById("fatherlastName")?.value].filter(Boolean).join(" ").trim();
  const dob = document.getElementById("dob")?.value || "";
  const photo = document.getElementById("photo")?.files?.[0];
  const nameEl = document.getElementById("newPanPreviewName");
  const fatherEl = document.getElementById("newPanPreviewFather");
  const dobEl = document.getElementById("newPanPreviewDob");
  const img = document.getElementById("newPanPreviewPhoto");
  if (nameEl) nameEl.textContent = name || "YOUR NAME";
  if (fatherEl) fatherEl.textContent = father || "FATHER NAME";
  if (dobEl) dobEl.textContent = dob ? new Date(dob + "T00:00:00").toLocaleDateString("en-IN") : "DD/MM/YYYY";
  if (img && photo) {
    if (img.dataset.objectUrl) URL.revokeObjectURL(img.dataset.objectUrl);
    const url = URL.createObjectURL(photo); img.src = url; img.dataset.objectUrl = url;
  }
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


/* ================= UNIVERSAL DOCUMENT CROPPER ================= */
const croppedFiles = Object.create(null);
let cropState = {id:null,file:null,img:null,scale:1,rot:0,ox:0,oy:0,box:{x:0,y:0,w:0,h:0},drag:null,last:null,pinch:null};
const cropIds=['photo','signature','aadhaarFront','aadhaarBack','dobProof','guardianAadhaarFront','guardianAadhaarBack','corPhoto','corSignature','corAadhaarFront','corAadhaarBack','corDobProof'];
function cropEl(id){return document.getElementById(id)}
function openCropForFile(id,file){ if(!file||!String(file.type||'').startsWith('image/'))return; cropState={id,file,img:null,scale:1,rot:0,ox:0,oy:0,box:{x:0,y:0,w:0,h:0},drag:null,last:null,pinch:null}; const modal=cropEl('documentCropModal'); cropEl('cropDocTitle').textContent=(cropEl(id)?.closest('.form-group')?.querySelector('label')?.textContent||'Document')+' — Crop'; cropEl('cropFileName').textContent=file.name; modal.classList.add('show'); modal.setAttribute('aria-hidden','false'); const r=new FileReader();r.onload=()=>loadCropImage(r.result);r.readAsDataURL(file) }
function closeCrop(){const m=cropEl('documentCropModal');m.classList.remove('show');m.setAttribute('aria-hidden','true');cropState.drag=null;cropState.pinch=null}
function loadCropImage(src){const img=new Image();img.onload=()=>{cropState.img=img;cropState.rot=0;fitCrop();};img.onerror=()=>{alert('Image open nahi hui.');closeCrop()};img.src=src}
function fitCrop(){const st=cropEl('cropStage'),c=cropEl('cropCanvas');if(!cropState.img)return;const w=st.clientWidth,h=st.clientHeight;c.width=w*devicePixelRatio;c.height=h*devicePixelRatio;c.style.width=w+'px';c.style.height=h+'px';const iw=cropState.img.width,ih=cropState.img.height;cropState.scale=Math.min(w/iw,h/ih)*.98;cropState.ox=(w-iw*cropState.scale)/2;cropState.oy=(h-ih*cropState.scale)/2;cropState.box={x:w*.1,y:h*.12,w:w*.8,h:h*.76};drawCrop()}
function drawCrop(){const st=cropEl('cropStage'),c=cropEl('cropCanvas'),ctx=c.getContext('2d');if(!cropState.img)return;const w=st.clientWidth,h=st.clientHeight,d=devicePixelRatio;c.width=w*d;c.height=h*d;ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);ctx.save();ctx.translate(cropState.ox+cropState.img.width*cropState.scale/2,cropState.oy+cropState.img.height*cropState.scale/2);ctx.rotate(cropState.rot*Math.PI/180);ctx.drawImage(cropState.img,-cropState.img.width*cropState.scale/2,-cropState.img.height*cropState.scale/2,cropState.img.width*cropState.scale,cropState.img.height*cropState.scale);ctx.restore();const b=cropState.box,box=cropEl('cropBox');box.style.left=b.x+'px';box.style.top=b.y+'px';box.style.width=b.w+'px';box.style.height=b.h+'px';cropEl('cropShade').style.clipPath=`polygon(0 0,100% 0,100% 100%,0 100%,0 0,${b.x}px ${b.y}px,${b.x}px ${b.y+b.h}px,${b.x+b.w}px ${b.y+b.h}px,${b.x+b.w}px ${b.y}px,${b.x}px ${b.y}px)`}
function point(e){const r=cropEl('cropStage').getBoundingClientRect();const t=e.touches?e.touches[0]:e;return{x:t.clientX-r.left,y:t.clientY-r.top}}
function inside(p){const b=cropState.box;return p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h}
function handleAt(p){const b=cropState.box,hs=18;const pts={nw:[b.x,b.y],n:[b.x+b.w/2,b.y],ne:[b.x+b.w,b.y],e:[b.x+b.w,b.y+b.h/2],se:[b.x+b.w,b.y+b.h],s:[b.x+b.w/2,b.y+b.h],sw:[b.x,b.y+b.h],w:[b.x,b.y+b.h/2]};for(const [k,[x,y]] of Object.entries(pts))if(Math.hypot(p.x-x,p.y-y)<hs)return k;return null}
function cropStart(e){if(e.touches&&e.touches.length===2){cropState.pinch={d:Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY),scale:cropState.scale};return}const p=point(e),h=handleAt(p);cropState.last=p;cropState.drag=h?{type:'resize',h}:inside(p)?{type:'box'}:{type:'image'};e.preventDefault()}
function cropMove(e){if(e.touches&&e.touches.length===2&&cropState.pinch){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);cropState.scale=Math.max(.1,Math.min(8,cropState.pinch.scale*d/cropState.pinch.d));drawCrop();e.preventDefault();return}if(!cropState.last)return;const p=point(e),dx=p.x-cropState.last.x,dy=p.y-cropState.last.y;const b=cropState.box;if(cropState.drag?.type==='image'){cropState.ox+=dx;cropState.oy+=dy}else if(cropState.drag?.type==='box'){b.x+=dx;b.y+=dy;b.x=Math.max(0,Math.min(cropEl('cropStage').clientWidth-b.w,b.x));b.y=Math.max(0,Math.min(cropEl('cropStage').clientHeight-b.h,b.y))}else if(cropState.drag?.type==='resize'){resizeBox(cropState.drag.h,dx,dy)}cropState.last=p;drawCrop();e.preventDefault()}
function cropEnd(){cropState.last=null;cropState.drag=null;cropState.pinch=null}
function resizeBox(h,dx,dy){const b=cropState.box,min=60;let x=b.x,y=b.y,w=b.w,hg=b.h;if(h.includes('w')){x+=dx;w-=dx}if(h.includes('e'))w+=dx;if(h.includes('n')){y+=dy;hg-=dy}if(h.includes('s'))hg+=dy;if(w<min){w=min;x=b.x}if(hg<min){hg=min;y=b.y}const W=cropEl('cropStage').clientWidth,H=cropEl('cropStage').clientHeight;b.x=Math.max(0,Math.min(W-w,x));b.y=Math.max(0,Math.min(H-hg,y));b.w=Math.min(W-b.x,w);b.h=Math.min(H-b.y,hg)}
function rotateCrop(){cropState.rot=(cropState.rot+90)%360;drawCrop()}
async function confirmCrop(skip=false){const id=cropState.id,file=cropState.file;if(skip){croppedFiles[id]=file;updateDocCard(id,file,false);closeCrop();return}const st=cropEl('cropStage'),b=cropState.box;const out=document.createElement('canvas');const sx=(b.x-cropState.ox)/cropState.scale,sy=(b.y-cropState.oy)/cropState.scale,sw=b.w/cropState.scale,sh=b.h/cropState.scale;const src=cropState.img;out.width=Math.max(1,Math.round(sw));out.height=Math.max(1,Math.round(sh));const ctx=out.getContext('2d');ctx.save();if(cropState.rot){ctx.translate(out.width/2,out.height/2);ctx.rotate(-cropState.rot*Math.PI/180);ctx.drawImage(src,-sw/2,-sh/2,sw,sh)}else ctx.drawImage(src,sx,sy,sw,sh,0,0,out.width,out.height);ctx.restore();const blob=await new Promise(r=>out.toBlob(r,'image/jpeg',.92));const cf=new File([blob],(file.name.replace(/\.[^.]+$/,'')||id)+'.jpg',{type:'image/jpeg'});croppedFiles[id]=cf;updateDocCard(id,cf,true);closeCrop()}
function updateDocCard(id,file,cropped){const input=cropEl(id);if(!input)return;let card=input.parentElement.querySelector('.doc-upload-state');if(!card){card=document.createElement('div');card.className='doc-upload-state';input.parentElement.appendChild(card)}card.innerHTML=`<span>${cropped?'✓ Cropped':'✓ Ready'}</span><button type="button" data-recrop="${id}">Re-crop</button><button type="button" data-replace="${id}">Replace</button>`;card.querySelector('[data-recrop]')?.addEventListener('click',()=>openCropForFile(id,croppedFiles[id]||input.files[0]));card.querySelector('[data-replace]')?.addEventListener('click',()=>{input.value='';input.click()})}
function initUniversalCropper(){cropIds.forEach(id=>{const input=cropEl(id);if(!input)return;input.addEventListener('change',()=>{const f=input.files?.[0];if(f)openCropForFile(id,f)})});const st=cropEl('cropStage');st.addEventListener('pointerdown',cropStart);st.addEventListener('pointermove',cropMove);st.addEventListener('pointerup',cropEnd);st.addEventListener('pointercancel',cropEnd);st.addEventListener('touchstart',cropStart,{passive:false});st.addEventListener('touchmove',cropMove,{passive:false});st.addEventListener('touchend',cropEnd);cropEl('cropCloseBtn').onclick=closeCrop;cropEl('cropFitBtn').onclick=fitCrop;cropEl('cropRotateBtn').onclick=rotateCrop;cropEl('cropResetBtn').onclick=fitCrop;cropEl('cropSkipBtn').onclick=()=>confirmCrop(true);cropEl('cropConfirmBtn').onclick=()=>confirmCrop(false)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initUniversalCropper);else initUniversalCropper();

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
    submitBtn.innerHTML = '<span class="upload-spinner"></span> Upload Documents';

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

    const files = ["photo","signature","aadhaarFront","aadhaarBack","dobProof"].map(id=>croppedFiles[id] || document.getElementById(id).files[0]);

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
      const gFrontFile = croppedFiles.guardianAadhaarFront || document.getElementById("guardianAadhaarFront").files[0];
      const gBackFile = croppedFiles.guardianAadhaarBack || document.getElementById("guardianAadhaarBack").files[0];

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
      applicationType: "New PAN",
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
    resetNewPanFormAfterSubmit();
    showToast("Application submitted — form reset ho gaya");

    setTimeout(() => {
      localStorage.setItem("ackNo", ackNo);
      openCustomerPaymentByAck(ackNo);
    }, 1500);
  } catch (err) {
    showToast("Error: " + err, "error");
  } finally {
    loading.style.display = "none";
    submitBtn.disabled = false;
    submitBtn.innerHTML = "Submit";
  }
});

/* ================= PAN CORRECTION ================= */
const correctionSteps = [
  { id: "basic", label: "Basic Details" },
  { id: "select", label: "Select Correction" },
  { id: "details", label: "Correction Details" },
  { id: "contactaddress", label: "Contact & Address" },
  { id: "documents", label: "Documents" },
  { id: "review", label: "Review" }
];
let correctionStepIndex = 0;
let correctionDraftTimer = null;

function correctionDraftKey() {
  const owner = currentUser?.uid || currentUser?.email || "guest";
  return `panCorrectionDraft:${owner}`;
}
function correctionInputIds() {
  return ["corPAN","corLastName","corFirstName","corMiddleName","corAadhaar","corDob","corGender","corFatherName","corMotherName","corPhone","corEmail","corPin","corFlat","corVillage","corPost","corSubDivision","corDistrict","corState","corOtherValue"];
}
function selectedCorrections() {
  return [...document.querySelectorAll('#correctionScreen input[type="checkbox"]:checked')].map(x => x.value);
}
function saveCorrectionDraft() {
  if (!currentUser) return;
  const values = {};
  correctionInputIds().forEach(id => { const el=document.getElementById(id); if(el) values[id]=el.value; });
  localStorage.setItem(correctionDraftKey(), JSON.stringify({values, selected:selectedCorrections(), step:correctionStepIndex, savedAt:Date.now()}));
}
function scheduleCorrectionDraft() { clearTimeout(correctionDraftTimer); correctionDraftTimer=setTimeout(saveCorrectionDraft,400); }
function clearCorrectionDraft() { if(currentUser) localStorage.removeItem(correctionDraftKey()); }
function renderCorrectionSteps() {
  const stepper=document.getElementById("correctionStepper");
  if(!stepper)return;
  correctionStepIndex=Math.max(0,Math.min(correctionSteps.length-1,correctionStepIndex));
  stepper.innerHTML=correctionSteps.map((x,i)=>`<span class="step-pill ${i===correctionStepIndex?'is-active':i<correctionStepIndex?'is-done':''}" data-number="${i+1}">${x.label}</span>`).join("");
  document.querySelectorAll("#correctionScreen .correction-section").forEach(sec=>{
    const active=sec.dataset.cstep===correctionSteps[correctionStepIndex].id; sec.classList.toggle("is-active",active);
    sec.querySelectorAll("input,select,textarea,button").forEach(el=>el.disabled=!active);
  });
  document.getElementById("corPrevBtn").style.display=correctionStepIndex===0?"none":"inline-flex";
  document.getElementById("corNextBtn").style.display=correctionStepIndex===correctionSteps.length-1?"none":"inline-flex";
  document.getElementById("corSubmitBtn").style.display=correctionStepIndex===correctionSteps.length-1?"inline-flex":"none";
  document.getElementById("corStepProgress").textContent=`Step ${correctionStepIndex+1} of ${correctionSteps.length}`;
  updateCorrectionSummary();
  updateCorrectionPreview();
}
function validateCorrectionStep(){
  const id=correctionSteps[correctionStepIndex].id;
  if(id==='select' && selectedCorrections().length===0){showToast('Kam se kam ek correction select karein','error');return false;}
  const sec=document.querySelector(`#correctionScreen .correction-section[data-cstep="${id}"]`);
  if(!sec)return true;
  for(const el of sec.querySelectorAll('input,select,textarea')){ if(el.disabled)continue; if(!el.checkValidity()){el.reportValidity();return false;} }
  if(id==='basic' && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(document.getElementById('corPAN').value.trim().toUpperCase())){document.getElementById('corPAN').setCustomValidity('PAN must be 5 letters + 4 digits + 1 letter');document.getElementById('corPAN').reportValidity();document.getElementById('corPAN').setCustomValidity('');return false;}
  return true;
}
function goCorrectionNext(){if(!validateCorrectionStep())return;correctionStepIndex++;renderCorrectionSteps();saveCorrectionDraft();}
function goCorrectionPrev(){correctionStepIndex--;renderCorrectionSteps();saveCorrectionDraft();}
function openCorrectionForm(){
  if(!currentUser){openAuthPopup('login');return;}
  document.getElementById('correctionScreen').style.display='block'; document.getElementById('correctionScreen').classList.add('is-open'); document.getElementById('correctionScreen').setAttribute('aria-hidden','false');
  loadCorrectionDraft(); renderCorrectionSteps();
}
function closeCorrectionForm(){saveCorrectionDraft();const s=document.getElementById('correctionScreen');s.style.display='none';s.classList.remove('is-open');s.setAttribute('aria-hidden','true');}
function loadCorrectionDraft(){
  if(!currentUser)return; const raw=localStorage.getItem(correctionDraftKey()); if(!raw)return;
  try{const d=JSON.parse(raw); correctionStepIndex=Number.isInteger(d.step)?d.step:0; Object.entries(d.values||{}).forEach(([id,v])=>{const el=document.getElementById(id);if(el&&el.type!=='file')el.value=v||'';}); (d.selected||[]).forEach(v=>{const el=document.querySelector(`#correctionScreen input[type="checkbox"][value="${CSS.escape(v)}"]`);if(el)el.checked=true;}); renderCorrectionDynamicFields(); syncCorrectionToBase();}catch{localStorage.removeItem(correctionDraftKey());}
}
function correctionField(label,id,type='text',placeholder=''){return `<div class="form-group"><label for="${id}">${label}</label><input id="${id}" type="${type}" placeholder="${placeholder}"></div>`;}
function renderCorrectionDynamicFields(){
  const box=document.getElementById('correctionDynamicFields'); if(!box)return; const selected=selectedCorrections(); let html='';
  if(selected.includes('name')) html += `<div class="correction-subcard"><h4>Corrected Name</h4><div class="form-grid">${correctionField('Correct First Name','corNewFirstName')}${correctionField('Correct Middle Name','corNewMiddleName')}${correctionField('Correct Last Name*','corNewLastName')}</div></div>`;
  if(selected.includes('father')) html += `<div class="correction-subcard"><h4>Corrected Father's Name</h4>${correctionField("New Father's Name",'corNewFatherName')}</div>`;
  if(selected.includes('mother')) html += `<div class="correction-subcard"><h4>Corrected Mother's Name</h4>${correctionField("New Mother's Name",'corNewMotherName')}</div>`;
  if(selected.includes('dob')) html += `<div class="correction-subcard"><h4>Corrected DOB</h4>${correctionField('New Date of Birth','corNewDob','date')}</div>`;
  if(selected.includes('gender')) html += `<div class="correction-subcard"><h4>Corrected Gender</h4><div class="form-group"><label for="corNewGender">New Gender</label><select id="corNewGender"><option value="">Select</option><option>Male</option><option>Female</option></select></div></div>`;
  if(selected.includes('contact')) html += `<div class="correction-subcard"><h4>Corrected Contact</h4><div class="form-grid">${correctionField('New Mobile','corNewPhone','tel')}${correctionField('New Email','corNewEmail','email')}</div></div>`;
  if(selected.includes('address')) html += `<div class="correction-subcard"><h4>Corrected Address</h4><div class="form-grid">${correctionField('New Pin Code','corNewPin')}${correctionField('New Flat No/C/O','corNewFlat')}${correctionField('New Village/City','corNewVillage')}${correctionField('New Post Office','corNewPost')}${correctionField('New Sub Division','corNewSubDivision')}${correctionField('New District','corNewDistrict')}${correctionField('New State','corNewState')}</div></div>`;
  if(selected.includes('other')) html += `<div class="correction-subcard"><h4>Other Correction</h4><div class="form-group"><label for="corOtherValue">Describe Other Correction</label><textarea id="corOtherValue" rows="4" placeholder="What else needs correction?"></textarea></div></div>`;
  box.innerHTML=html||'<div class="empty-correction">No correction selected yet.</div>';
  const dynamicIds=['corNewFirstName','corNewMiddleName','corNewLastName','corNewFatherName','corNewMotherName','corNewDob','corNewGender','corNewPhone','corNewEmail','corNewPin','corNewFlat','corNewVillage','corNewPost','corNewSubDivision','corNewDistrict','corNewState','corOtherValue'];
  dynamicIds.forEach(id=>{const el=document.getElementById(id);if(el){el.addEventListener('input',()=>{syncCorrectionToBase();updateCorrectionPreview();updateCorrectionSummary();scheduleCorrectionDraft();});el.addEventListener('change',()=>{syncCorrectionToBase();updateCorrectionPreview();updateCorrectionSummary();scheduleCorrectionDraft();});}});
}
function syncCorrectionToBase(){
  const selected=selectedCorrections();
  const set=(id,val)=>{const el=document.getElementById(id);if(el&&val!==undefined)el.value=val||'';};
  if(selected.includes('name')){set('corFirstName',document.getElementById('corNewFirstName')?.value);set('corMiddleName',document.getElementById('corNewMiddleName')?.value);set('corLastName',document.getElementById('corNewLastName')?.value);}
  if(selected.includes('father'))set('corFatherName',document.getElementById('corNewFatherName')?.value);
  if(selected.includes('mother'))set('corMotherName',document.getElementById('corNewMotherName')?.value);
  if(selected.includes('dob'))set('corDob',document.getElementById('corNewDob')?.value);
  if(selected.includes('gender'))set('corGender',document.getElementById('corNewGender')?.value);
  if(selected.includes('contact')){set('corPhone',document.getElementById('corNewPhone')?.value);set('corEmail',document.getElementById('corNewEmail')?.value);}
  if(selected.includes('address')){['Pin','Flat','Village','Post','SubDivision','District','State'].forEach(k=>set('cor'+k,document.getElementById('corNew'+k)?.value));}
}
function updateCorrectionSummary(){
  const box=document.getElementById('correctionNormalSummary'); if(!box)return;
  const vals=[['Name',[document.getElementById('corFirstName')?.value,document.getElementById('corMiddleName')?.value,document.getElementById('corLastName')?.value].filter(Boolean).join(' ')],['PAN',document.getElementById('corPAN')?.value],['DOB',document.getElementById('corDob')?.value],['Gender',document.getElementById('corGender')?.value],['Father',document.getElementById('corFatherName')?.value],['Mother',document.getElementById('corMotherName')?.value],['Mobile',document.getElementById('corPhone')?.value],['Email',document.getElementById('corEmail')?.value],['Address',[document.getElementById('corFlat')?.value,document.getElementById('corVillage')?.value,document.getElementById('corPost')?.value,document.getElementById('corDistrict')?.value,document.getElementById('corState')?.value,document.getElementById('corPin')?.value].filter(Boolean).join(', ')]];
  box.innerHTML=vals.map(([k,v])=>`<div><span>${k}</span><strong>${escapeHtml(v||'—')}</strong></div>`).join('');
}
function updateCorrectionPreview(){
  const name=[document.getElementById('corFirstName')?.value,document.getElementById('corMiddleName')?.value,document.getElementById('corLastName')?.value].filter(Boolean).join(' ').trim();
  const father=document.getElementById('corFatherName')?.value.trim(); const dob=document.getElementById('corDob')?.value; const pan=document.getElementById('corPAN')?.value.trim().toUpperCase();
  document.getElementById('corPreviewName').textContent=name||'YOUR NAME'; document.getElementById('corPreviewFather').textContent=father||'FATHER NAME'; document.getElementById('corPreviewDob').textContent=dob?new Date(dob+'T00:00:00').toLocaleDateString('en-IN'):'DD/MM/YYYY'; document.getElementById('corPreviewPan').textContent=pan||'ABCDE1234F';
  const file=croppedFiles.corPhoto||document.getElementById('corPhoto')?.files?.[0],img=document.getElementById('corPreviewPhoto'); if(file&&img){if(img.dataset.objectUrl)URL.revokeObjectURL(img.dataset.objectUrl);const url=URL.createObjectURL(file);img.src=url;img.dataset.objectUrl=url;}
}
function buildCorrectionData(){
  const name=[document.getElementById('corFirstName').value,document.getElementById('corMiddleName').value,document.getElementById('corLastName').value].filter(Boolean).join(' ');
  return {
    ackNo:generateAck(), applicationType:'PAN Correction', userId:currentUser.uid,userEmail:currentUser.email, panNumber:document.getElementById('corPAN').value.trim().toUpperCase(),
    firstName:document.getElementById('corFirstName').value.trim(),middleName:document.getElementById('corMiddleName').value.trim(),lastName:document.getElementById('corLastName').value.trim(),name,
    father:document.getElementById('corFatherName').value.trim(),mother:document.getElementById('corMotherName').value.trim(),aadhaar:document.getElementById('corAadhaar').value.trim(),dob:document.getElementById('corDob').value,gender:document.getElementById('corGender').value,phone:document.getElementById('corPhone').value.trim(),email:document.getElementById('corEmail').value.trim(),
    flatNo:document.getElementById('corFlat').value.trim(),villageCity:document.getElementById('corVillage').value.trim(),postOffice:document.getElementById('corPost').value.trim(),subDivision:document.getElementById('corSubDivision').value.trim(),district:document.getElementById('corDistrict').value.trim(),state:document.getElementById('corState').value.trim(),pinCode:document.getElementById('corPin').value.trim(),
    correctionFields:selectedCorrections(),otherCorrection:document.getElementById('corOtherValue')?.value.trim()||'',status:'pending',paymentStatus:'pending',paymentAmount:190,createdAt:new Date()
  };
}
async function submitCorrectionApplication(){
  const correctionSubmit=document.getElementById('corSubmitBtn');
  if(correctionSubmit){correctionSubmit.disabled=true;correctionSubmit.innerHTML='<span class="upload-spinner"></span> Upload Documents';}
  if(!validateCorrectionStep())return;
  if(!currentUser)return;
  const files=['corPhoto','corSignature','corAadhaarFront','corAadhaarBack','corDobProof'].map(id=>croppedFiles[id]||document.getElementById(id)?.files?.[0]);
  if(files.some(f=>!f)){showToast('Correction ke liye New PAN jaise same 5 documents required hain','error');correctionStepIndex=4;renderCorrectionSteps();return;}
  const loading=document.getElementById('loadingOverlay'); const btn=document.getElementById('corSubmitBtn');
  try{
    loading.style.display='flex';btn.disabled=true;btn.innerHTML='<span class="upload-spinner"></span> Upload Documents';
    const [photo,signature,aadhaarFront,aadhaarBack,dobProof]=await Promise.all(files.map(uploadToCloudinary));
    const data=buildCorrectionData(); Object.assign(data,{photo,signature,aadhaarFront,aadhaarBack,dobProof,documentsSameAsNewPAN:true});
    const ref=await db.collection('applications').add(data);
    data.id=ref.id; generatePDF(data);
    clearCorrectionDraft(); resetCorrectionFormAfterSubmit();
    showToast('PAN Correction submitted — form reset ho gaya');
    setTimeout(()=>openCustomerPaymentByAck(data.ackNo),1000);
  }catch(err){showToast('Correction error: '+(err.message||err),'error');}
  finally{loading.style.display='none';btn.disabled=false;btn.textContent='Submit Correction';}
}
function resetCorrectionFormAfterSubmit(){
  clearTimeout(correctionDraftTimer); const form=document.getElementById('correctionForm'); if(!form)return; form.reset(); form.querySelectorAll('input[type=file]').forEach(el=>el.value=''); document.getElementById('correctionDynamicFields').innerHTML='<div class="empty-correction">No correction selected yet.</div>'; document.getElementById('correctionNormalSummary').textContent='Basic details yahan show honge.'; correctionStepIndex=0; renderCorrectionSteps(); clearCorrectionDraft();
}

document.getElementById('correctionForm')?.addEventListener('submit',e=>{e.preventDefault();submitCorrectionApplication();});
document.getElementById('corNextBtn')?.addEventListener('click',goCorrectionNext);
document.getElementById('corPrevBtn')?.addEventListener('click',goCorrectionPrev);
document.querySelectorAll('#correctionScreen input[type="checkbox"]').forEach(cb=>cb.addEventListener('change',()=>{renderCorrectionDynamicFields();scheduleCorrectionDraft();}));
document.getElementById('corPAN')?.addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10); if(!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(e.target.value))e.target.setCustomValidity('PAN must be 5 letters + 4 digits + 1 letter');else e.target.setCustomValidity('');updateCorrectionPreview();scheduleCorrectionDraft();});
document.querySelectorAll('#correctionScreen input,#correctionScreen select,#correctionScreen textarea').forEach(el=>{el.addEventListener('input',()=>{updateCorrectionPreview();updateCorrectionSummary();scheduleCorrectionDraft();});el.addEventListener('change',()=>{updateCorrectionPreview();updateCorrectionSummary();scheduleCorrectionDraft();});});

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
  infoRow("Service Fee", money(Number(data.paymentAmount || data.customerPaymentAmount || 0)), margin + 120, 214, 34);
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
  try{const settings=await db.collection('serviceSettings').doc('pan').get();if(settings.exists)CUSTOMER_UPI_ID=String(settings.data().upiId||CUSTOMER_UPI_ID);}catch(e){}
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
    const upi=`upi://pay?pa=${encodeURIComponent(CUSTOMER_UPI_ID)}&pn=${encodeURIComponent('TECH SOURCE')}&am=${encodeURIComponent(amount.toFixed(2))}&cu=INR&tn=${encodeURIComponent(`PAN Payment | ACK: ${app.ackNo} | NAME: ${getCustomerName(app)}`)}`;
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
  if(!/^[A-Za-z0-9]{6,40}$/.test(utr)){msg.textContent='Valid UTR / Transaction ID required (6–40 letters or digits).';msg.style.color='#dc2626';return;}
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
let CUSTOMER_UPI_ID = "9661905351-3@axl";
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
      await ref.set({applicationId:app.id,ackNo:app.ackNo,name:getCustomerName(app),phone:app.phone||'',email:app.email||'',photo:getCustomerPhoto(app),applicationType:getApplicationType(app),amount:Number(app.paymentAmount||190),utrMode:'required',utrRequired:true,showUtrAfterDone:true,status:'pending',paymentStatus:'pending',createdAt:firebase.firestore.FieldValue.serverTimestamp()});
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

function getApplicationType(data){
  return String(data?.applicationType || data?.serviceType || 'New PAN').trim() || 'New PAN';
}
function getCustomerPhoto(data){
  return String(data?.photo || data?.photoUrl || data?.photoURL || '').trim();
}
function normalizeWhatsAppNumber(phone){
  let n=String(phone||'').replace(/\D/g,'');
  if(n.length===10) n='91'+n;
  if(n.startsWith('0') && n.length===11) n='91'+n.slice(1);
  return n;
}
function buildCustomerPaymentWhatsAppText(data, link){
  const name=getCustomerName(data);
  const ack=String(data?.ackNo||'—');
  const type=getApplicationType(data);
  const amount=Number(data?.amount||0).toLocaleString('en-IN');
  return `Dear ${name},\n\nYour ${type} payment is pending. Please complete your payment to continue the PAN card process.\n\nCustomer: ${name}\nApplication: ${type}\nPAN ACK: ${ack}\nAmount: ₹${amount}\n\nClick here to complete your payment:\n${link}\n\nThank you,\nTECH SOURCE`;
}

async function loadCustomerPaymentPage(){
  try{const settings=await db.collection('serviceSettings').doc('pan').get();if(settings.exists)CUSTOMER_UPI_ID=String(settings.data().upiId||CUSTOMER_UPI_ID);}catch(e){}
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
      requestData={id:'',ackNo:app.ackNo,name:getCustomerName(app),phone:app.phone||'',email:app.email||'',photo:getCustomerPhoto(app),applicationType:getApplicationType(app),amount:Number(app.paymentAmount||190),utrRequired:true,status:'pending',applicationId:app.id};
    }

    customerPaymentContext={...requestData,ref:requestRef};
    document.getElementById('cpName').textContent=getCustomerName(requestData);
    document.getElementById('cpPhone').textContent=requestData.phone || '—';
    document.getElementById('cpEmail').textContent=requestData.email || '—';
    document.getElementById('cpAck').textContent=requestData.ackNo || '—';
    document.getElementById('cpApplicationType').textContent=getApplicationType(requestData);
    document.getElementById('cpAmount').textContent=Number(requestData.amount||0).toLocaleString('en-IN');
    const cpPhoto=document.getElementById('cpPhoto');
    const photoUrl=getCustomerPhoto(requestData);
    cpPhoto.src=photoUrl || '';
    cpPhoto.parentElement.hidden=!photoUrl;
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
      const upi=`upi://pay?pa=${encodeURIComponent(CUSTOMER_UPI_ID)}&pn=${encodeURIComponent('TECH SOURCE')}&am=${encodeURIComponent(Number(requestData.amount||0).toFixed(2))}&cu=INR&tn=${encodeURIComponent(`PAN Payment | ACK: ${requestData.ackNo||''} | NAME: ${requestData.name||''}`)}`;
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

function showPaymentReceivedAnimation(){
  const overlay=document.getElementById('paymentAnimationOverlay'); if(!overlay)return;
  overlay.hidden=false; overlay.classList.add('show');
  const title=document.getElementById('paymentAnimationTitle'); const text=document.getElementById('paymentAnimationText');
  if(title)title.textContent='Payment Received ✓'; if(text)text.textContent='Payment request successfully sent. Verification is pending with TECH SOURCE.';
  setTimeout(()=>{overlay.classList.remove('show');setTimeout(()=>overlay.hidden=true,300);},2600);
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
    if(!currentUser){box.textContent='Login required.';return;}
    const snap=await db.collection('applications').where('ackNo','==',ack).where('userId','==',currentUser.uid).limit(1).get();
    if(snap.empty){box.textContent='This ACK is not your PAN application.';return;}
    const d=snap.docs[0].data();
    const photo=getCustomerPhoto(d);
    box.innerHTML=`${photo?`<img class=\"customer-preview-photo\" src=\"${escapeHtml(photo)}\" alt=\"Customer Photo\">`:''}<strong>${escapeHtml(getCustomerName(d))}</strong><br>Mobile: ${escapeHtml(d.phone||'—')} &nbsp;•&nbsp; Email: ${escapeHtml(d.email||'—')}<br>Application: ${escapeHtml(getApplicationType(d))}<br>Payment status: ${escapeHtml(d.paymentStatus||'pending')}`;
  }catch(e){box.textContent='Could not load: '+(e.message||e);}
}

async function createCustomerPaymentLink(){
  const ack=document.getElementById('customerPayAck').value.trim().toUpperCase();
  const amount=Number(document.getElementById('customerPayAmount').value);
  const utrMode=document.querySelector('input[name="customerUtrMode"]:checked')?.value||'required';
  const msg=document.getElementById('customerPayCreateMsg'); const btn=document.getElementById('createCustomerPayBtn');
  if(!ack){msg.textContent='ACK required.';msg.style.color='#dc2626';return;}
  if(!Number.isFinite(amount)||amount<190){msg.textContent='Minimum payment amount ₹190 hai.';msg.style.color='#dc2626';return;}
  btn.disabled=true; msg.textContent='Creating payment request…'; msg.style.color='#2563eb';
  try{
    if(!currentUser) throw new Error('Login required.');
    const snap=await db.collection('applications').where('ackNo','==',ack).where('userId','==',currentUser.uid).limit(1).get();
    if(snap.empty) throw new Error('This ACK is not your PAN application.');
    const appDoc=snap.docs[0]; const app=appDoc.data();
    if(String(app.paymentStatus||'').toLowerCase()==='paid') throw new Error('Payment already paid. Payment link cannot be created.');
    const existing=await db.collection('customerPaymentRequests').where('applicationId','==',appDoc.id).limit(10).get();
    const active=existing.docs.map(d=>({id:d.id,...d.data()})).find(r=>!['paid','rejected','cancelled'].includes(String(r.status||'').toLowerCase()));
    if(active){
      const link=getCustomerPaymentUrl(active.id); document.getElementById('customerPayLink').value=link; document.getElementById('customerPayLinkBox').hidden=false; msg.textContent='Existing payment link found — same link returned.'; msg.style.color='#15803d'; return;
    }
    const ref=db.collection('customerPaymentRequests').doc();
    await ref.set({
      applicationId:appDoc.id, ackNo:app.ackNo, name:getCustomerName(app), phone:app.phone||'', email:app.email||'', photo:getCustomerPhoto(app), applicationType:getApplicationType(app),
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

async function sendCustomerPaymentWhatsApp(){
  const link=document.getElementById('customerPayLink').value; if(!link)return;
  const ack=document.getElementById('customerPayAck').value.trim().toUpperCase();
  try{
    const app=await findApplicationByAck(ack);
    if(!app){showToast('Customer not found','error');return;}
    const number=normalizeWhatsAppNumber(app.phone);
    if(!number || number.length<12){showToast('Customer WhatsApp number not available','error');return;}
    const text=buildCustomerPaymentWhatsAppText({...app,amount:Number(document.getElementById('customerPayAmount').value||190)},link);
    window.open('https://wa.me/'+number+'?text='+encodeURIComponent(text),'_blank','noopener');
  }catch(e){showToast('WhatsApp error: '+(e.message||e),'error');}
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
document.querySelectorAll('#newpanForm input,#newpanForm select,#newpanForm textarea').forEach(el=>{el.addEventListener('input',updateNewPanPreview);el.addEventListener('change',updateNewPanPreview);});
renderSteps();
updateNewPanPreview();

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

function relocateFinalPreviews(){
 const n=document.querySelector('#newPanFinalPreview'); const c=document.querySelector('.correction-final-preview-wrap');
 if(n){const box=n.querySelector('.pan-preview-box'); if(box&&box.parentElement!==n) n.appendChild(box)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',relocateFinalPreviews);else relocateFinalPreviews();
/* ================= V3 WORKFLOW OVERRIDES ================= */
const V3_IMAGE_TYPES=['image/jpeg','image/png','image/webp'];
const V3_DOC_IDS=['photo','signature','aadhaarFront','aadhaarBack','dobProof','guardianAadhaarFront','guardianAadhaarBack'];
const v3UploadedUrls=Object.create(null);
const v3Uploading=Object.create(null);
function v3IsImage(file){return !!file && (V3_IMAGE_TYPES.includes(file.type)||/\.(jpe?g|png|webp)$/i.test(file.name));}
function v3State(id,msg,kind=''){const el=document.getElementById('uploadState_'+id);if(!el)return;el.innerHTML=kind==='loading'?'<span class="doc-loader"></span><span>'+escapeHtml(msg)+'</span>':`<span class="${kind==='ok'?'upload-ok':'upload-error'}">${kind==='ok'?'✓ ':'! '}${escapeHtml(msg)}</span>`;}
async function v3UploadDocument(id,file){
  if(!v3IsImage(file)){v3State(id,'Only JPG, JPEG, PNG or WEBP allowed','error');return false;}
  if(v3Uploading[id])return false;
  v3Uploading[id]=true;v3State(id,'Uploading…','loading');
  try{v3UploadedUrls[id]=await uploadToCloudinary(file);v3State(id,'Uploaded successfully','ok');return true}
  catch(e){delete v3UploadedUrls[id];v3State(id,'Upload failed — select/replace to retry','error');showToast('Upload failed: '+(e.message||e),'error');return false}
  finally{delete v3Uploading[id];v3UpdateSubmitState();}
}
function v3UpdateSubmitState(){
  const btn=document.querySelector('#newpanForm button[type="submit"]');if(!btn)return;
  const required=V3_DOC_IDS.filter(id=>{const el=document.getElementById(id);return el&&!el.closest('.hidden-section')});
  const docsReady=required.every(id=>!!v3UploadedUrls[id]);
  btn.disabled=!docsReady;
  btn.title=docsReady?'Ready to review':'Upload all visible required documents first';
}
function v3ValidateNewPan(){
  const requiredIds=['lastName','aadhar','dob','gender','phone','fatherlastName','pinCode','villageCity','subDivision','district','state','proofOfIdentity','proofOfAddress','proof_dob'];
  for(const id of requiredIds){const e=document.getElementById(id);if(e&&!String(e.value||'').trim()){e.focus();showToast('Please fill required field: '+(e.previousElementSibling?.textContent||id),'error');return false}}
  const aad=document.getElementById('aadhar').value.replace(/\D/g,'');if(aad.length!==12){showToast('Aadhaar number must be 12 digits','error');document.getElementById('aadhar').focus();return false}
  const phone=document.getElementById('phone').value.replace(/\D/g,'');if(phone.length!==10){showToast('Valid 10 digit mobile number required','error');document.getElementById('phone').focus();return false}
  const visible=V3_DOC_IDS.filter(id=>{const e=document.getElementById(id);return e&&!e.closest('.hidden-section')});if(visible.some(id=>!v3UploadedUrls[id])){showToast('Please upload all required documents first','error');return false}
  if(isMinorApplicant){for(const id of ['guardianlastName','guardianfirstName']){const e=document.getElementById(id);if(!String(e?.value||'').trim()){e?.focus();showToast('Guardian details are required for minor','error');return false}}for(const id of ['guardianAadhaarFront','guardianAadhaarBack'])if(!v3UploadedUrls[id]){showToast('Guardian Aadhaar documents are required for minor','error');return false}}
  return true;
}
function v3BuildFormData(){
 const val=id=>document.getElementById(id)?.value?.trim()||''; const dob=val('dob'); const birth=new Date(dob+'T00:00:00');const now=new Date();let age=now.getFullYear()-birth.getFullYear();if(now.getMonth()<birth.getMonth()||(now.getMonth()===birth.getMonth()&&now.getDate()<birth.getDate()))age--;
 const father=[val('fatherFirstName'),val('fatherMiddleName'),val('fatherlastName')].filter(Boolean).join(' ');const mother=[val('motherfirstName'),val('motherMiddleName'),val('motherlastName')].filter(Boolean).join(' ');const guardian=[val('guardianfirstName'),val('guardianMiddleName'),val('guardianlastName')].filter(Boolean).join(' ');
 return {ackNo:generateAck(),applicationType:'New PAN',userId:currentUser.uid,userEmail:currentUser.email,firstName:val('firstName'),middleName:val('middleName'),lastName:val('lastName'),name:[val('firstName'),val('middleName'),val('lastName')].filter(Boolean).join(' '),father,mother,guardianName:guardian,aadhaar:val('aadhar'),nameAadhar:val('nameAadhar'),dob,age,isMinor:age<18,gender:val('gender'),phone:val('phone'),email:val('email'),flatNo:val('flatNo'),villageCity:val('villageCity'),postOffice:val('postOffice')==='manual'?val('manualPO'):val('postOffice'),subDivision:val('subDivision'),district:val('district'),state:val('state'),pinCode:val('pinCode'),dobdocType:val('proof_dob'),photo:v3UploadedUrls.photo,signature:v3UploadedUrls.signature,aadhaarFront:v3UploadedUrls.aadhaarFront,aadhaarBack:v3UploadedUrls.aadhaarBack,dobProof:v3UploadedUrls.dobProof,guardianFront:v3UploadedUrls.guardianAadhaarFront||'',guardianBack:v3UploadedUrls.guardianAadhaarBack||'',status:'pending',paymentStatus:'pending',createdAt:new Date()};
}
function v3OpenPreview(data){
 let ov=document.getElementById('v3PanPreview');if(!ov){ov=document.createElement('div');ov.id='v3PanPreview';ov.className='v3-pan-preview-overlay';ov.innerHTML='<div class="v3-preview-modal"><span class="eyebrow">FINAL REVIEW</span><h2>Demo PAN Preview</h2><div class="v3-demo-note"><b>Demo Preview Only</b><br>This is a demo preview. This is not an original PAN card.</div><div class="v3-pan-card"><div class="v3-pan-head"><span>INCOME TAX DEPARTMENT</span><span>GOVT. OF INDIA</span></div><div class="v3-pan-body"><div class="v3-pan-photo"><img id="v3pvPhoto"></div><div class="v3-pan-info"><div><span>Name</span><b id="v3pvName"></b></div><div><span>Father\'s Name</span><b id="v3pvFather"></b></div><div><span>Date of Birth</span><b id="v3pvDob"></b></div><div><span>PAN</span><b>XXXPX0000X</b></div></div></div></div><div class="v3-preview-actions"><button class="btn ghost" type="button" id="v3EditBtn">Edit</button><button class="btn" type="button" id="v3FinalSubmitBtn">Submit Application</button></div></div>';document.body.appendChild(ov)}
 document.getElementById('v3pvPhoto').src=data.photo||'';document.getElementById('v3pvName').textContent=data.name||'—';document.getElementById('v3pvFather').textContent=data.father||'—';document.getElementById('v3pvDob').textContent=data.dob?new Date(data.dob+'T00:00:00').toLocaleDateString('en-IN'):'—';ov.classList.add('show');
 document.getElementById('v3EditBtn').onclick=()=>ov.classList.remove('show');
 document.getElementById('v3FinalSubmitBtn').onclick=async()=>{const btn=document.getElementById('v3FinalSubmitBtn');btn.disabled=true;btn.textContent='Submitting…';try{await db.collection('applications').add(data);generatePDF(data);clearDraft();ov.classList.remove('show');resetNewPanFormAfterSubmit();showToast('Application submitted successfully ✓');v3ShowPaymentChoices(data.ackNo)}catch(e){showToast('Submission failed: '+(e.message||e),'error');btn.disabled=false;btn.textContent='Submit Application'}};
}
function v3InterceptNewSubmit(e){e.preventDefault();e.stopImmediatePropagation();if(!v3ValidateNewPan())return;v3OpenPreview(v3BuildFormData());}
document.addEventListener('submit',e=>{if(e.target?.id==='newpanForm')v3InterceptNewSubmit(e)},true);
function v3BindDocs(){
 V3_DOC_IDS.forEach(id=>{const input=document.getElementById(id);if(!input)return;input.accept='image/jpeg,image/png,image/webp';input.required=false;input.addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;if(!v3IsImage(f)){e.target.value='';v3State(id,'Only image files allowed','error');return}v3UploadedUrls[id]=null;v3UpdateSubmitState();});});
 // crop controls: intercept the existing crop modal buttons
 const skip=document.getElementById('cropSkipBtn'),confirm=document.getElementById('cropConfirmBtn');
 const finish=async(skipCrop)=>{const id=cropState.id,file=cropState.file;if(!file)return;if(!skipCrop){try{const b=cropState.box,src=cropState.img;const out=document.createElement('canvas');const sx=(b.x-cropState.ox)/cropState.scale,sy=(b.y-cropState.oy)/cropState.scale,sw=b.w/cropState.scale,sh=b.h/cropState.scale;out.width=Math.max(1,Math.round(sw));out.height=Math.max(1,Math.round(sh));out.getContext('2d').drawImage(src,sx,sy,sw,sh,0,0,out.width,out.height);const blob=await new Promise(r=>out.toBlob(r,'image/jpeg',.92));cropState.file=new File([blob],id+'.jpg',{type:'image/jpeg'});}catch(err){showToast('Crop failed','error');return}}croppedFiles[id]=skipCrop?file:cropState.file;updateDocCard(id,croppedFiles[id],!skipCrop);closeCrop();await v3UploadDocument(id,croppedFiles[id]);v3UpdateSubmitState()};
 if(skip)skip.onclick=()=>finish(true);if(confirm)confirm.onclick=()=>finish(false);v3UpdateSubmitState();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(v3BindDocs,50));else setTimeout(v3BindDocs,50);

// ACK copy fallback
window.v3CopyText=async function(text){try{await navigator.clipboard.writeText(text);return true}catch{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();return ok}};

// Customer payment success UX: hide payment controls after final request and show a payment-app-like confirmation.
const _v3CustomerSubmit=submitCustomerPaymentRequest;
submitCustomerPaymentRequest=async function(){await _v3CustomerSubmit();if(customerPaymentContext?.status==='verification_pending'){document.querySelector('.cp-qr-wrap')?.classList.add('v3-paid-hide');document.querySelector('.cp-upi')?.classList.add('v3-paid-hide');document.getElementById('cpUtrWrap')?.classList.add('v3-paid-hide');document.getElementById('cpTitle').textContent='Payment Request Sent Successfully';document.getElementById('cpMessage').textContent='Your payment request has been sent to admin. Please wait some time for verification.';}};

function v3ShowPaymentChoices(ack){let o=document.getElementById('v3PaymentChoices');if(!o){o=document.createElement('div');o.id='v3PaymentChoices';o.className='v3-pan-preview-overlay';o.innerHTML='<div class="v3-preview-modal"><span class="eyebrow">PAYMENT OPTIONS</span><h2>Application Submitted</h2><p>Your ACK has been generated and the receipt PDF has been downloaded.</p><div class="v3-preview-actions"><button class="btn" id="v3PayNowChoice">Pay Now</button><button class="btn ghost" id="v3CustomerPayChoice">Payment via Customer</button></div><button class="btn ghost" style="width:100%;margin-top:10px" id="v3LaterChoice">Pay Later</button></div>';document.body.appendChild(o)}o.classList.add('show');o.querySelector('#v3PayNowChoice').onclick=()=>{o.classList.remove('show');openDirectPayment(ack)};o.querySelector('#v3CustomerPayChoice').onclick=()=>{o.classList.remove('show');openCustomerPaymentCreator();const a=document.getElementById('customerPayAck');if(a){a.value=ack;a.dispatchEvent(new Event('input'));}};o.querySelector('#v3LaterChoice').onclick=()=>o.classList.remove('show')}
// Direct Pay Now: screenshot is optional/removed; UTR is the only proof required.
const _v3DirectSubmit=submitDirectPaymentProof;
submitDirectPaymentProof=async function(){const btn=document.getElementById('directPaySubmit'),appId=btn?.dataset.appId,ack=btn?.dataset.ack,utr=document.getElementById('directPayUtr')?.value.trim(),msg=document.getElementById('directPayMsg');if(!appId||!ack)return;if(!/^\d{8,25}$/.test(utr||'')){msg.textContent='Valid UTR / Transaction ID required (8–25 digits).';msg.style.color='#dc2626';return}btn.disabled=true;msg.textContent='Submitting payment request…';msg.style.color='#2563eb';try{const now=firebase.firestore.FieldValue.serverTimestamp();await db.collection('applications').doc(appId).update({paymentStatus:'verification_pending',paymentUtr:utr,paymentSubmittedAt:now});msg.textContent='Your payment request has been sent successfully. Payment pending admin verification.';msg.style.color='#15803d';setTimeout(closePaymentPopup,1800)}catch(e){btn.disabled=false;msg.textContent='Submission failed: '+(e.message||e);msg.style.color='#dc2626'}};


/* ================= TECH SOURCE V4 PRODUCTION UX / WORKFLOW PATCH ================= */
(function(){
  const V4_SETTINGS_DOC='pan';
  const V4_REMARKS='remarkPresets';
  const V4_DOC_KEYS=['photo','signature','aadhaarFront','aadhaarBack','dobProof','guardianFront','guardianBack','oldPanCopy'];
  const V4_DOC_LABELS={photo:'Photo',signature:'Signature',aadhaarFront:'Aadhaar Front',aadhaarBack:'Aadhaar Back',dobProof:'DOB Proof',guardianFront:'Guardian Aadhaar Front',guardianBack:'Guardian Aadhaar Back',oldPanCopy:'Old PAN Card Copy'};
  const v4$=id=>document.getElementById(id);
  const v4esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  let v4Settings={businessName:'TECH SOURCE',upiId:'9661905351-3@axl',panFee:190,whatsapp:'9661905351'};
  let v4RejectedContext=null;
  let v4UserUnsub=null;

  async function v4GetSettings(){
    try{
      const s=await db.collection('serviceSettings').doc(V4_SETTINGS_DOC).get();
      if(s.exists) v4Settings={...v4Settings,...s.data()};
    }catch(e){}
    return v4Settings;
  }
  window.v4GetSettings=v4GetSettings;

  async function v4ApplySettingsToUI(){
    const s=await v4GetSettings();
    const price=document.querySelector('.pan-price-panel strong'); if(price) price.textContent='₹ '+Number(s.panFee||190).toLocaleString('en-IN');
    const directUpi=document.querySelector('#directPaymentView .cp-upi strong'); if(directUpi) directUpi.textContent=s.upiId||'';
  }

  // One local draft only; restore the exact last location.
  const _v4OpenForm=window.openForm;
  window.openForm=function(){
    if(!currentUser){redirectToLogin();return;}
    _v4OpenForm();
    setTimeout(()=>{loadDraft();renderSteps();v4ApplySettingsToUI();},0);
  };

  // Remove PDF logic from the cropper: image files only.
  window.openCropForFile=function(id,file){
    if(!file)return;
    if(!String(file.type||'').startsWith('image/')){showToast('Only JPG, JPEG, PNG or WEBP images are supported.','error');return;}
    cropState={id,file,img:null,scale:1,rot:0,ox:0,oy:0,box:{x:0,y:0,w:0,h:0},drag:null,last:null,pinch:null};
    const modal=cropEl('documentCropModal'); if(!modal)return;
    cropEl('cropDocTitle').textContent=(cropEl(id)?.closest('.form-group')?.querySelector('label')?.textContent||V4_DOC_LABELS[id]||'Document')+' — Crop';
    cropEl('cropFileName').textContent=file.name;
    modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
    const r=new FileReader();r.onload=()=>loadCropImage(r.result);r.readAsDataURL(file);
  };

  // New PAN preview: richer PAN-card layout with gender and demo number.
  function v4DemoPreviewCard(data,photo,rootId){
    let root=v4$(rootId);
    if(!root)return;
    root.innerHTML=`<div class="v4-pan-card"><div class="v4-pan-watermark">DEMO • NOT OFFICIAL</div><div class="v4-pan-head"><div><b>आयकर विभाग</b><span>INCOME TAX DEPARTMENT</span></div><div class="v4-emblem">✦</div><div><b>भारत सरकार</b><span>GOVT. OF INDIA</span></div></div><div class="v4-pan-sub">स्थायी लेखा संख्या कार्ड <span>Permanent Account Number Card</span></div><div class="v4-pan-main"><div class="v4-pan-photo"><img src="${v4esc(photo||'')}" alt="Photo"></div><div class="v4-pan-center"><div class="v4-pan-number">${v4esc(data.demoPan||'XXXP0000X')}</div><div class="v4-pan-field"><small>नाम / Name</small><strong>${v4esc(data.name||'YOUR NAME')}</strong></div><div class="v4-pan-field"><small>पिता का नाम / Father's Name</small><strong>${v4esc(data.father||'FATHER NAME')}</strong></div><div class="v4-pan-row"><div><small>लिंग / Gender</small><strong>${v4esc(data.gender||'—')}</strong></div><div><small>जन्म की तारीख / DOB</small><strong>${v4esc(data.dob||'DD/MM/YYYY')}</strong></div></div></div><div class="v4-pan-qr"><span>DEMO</span><div class="fake-qr"></div></div></div><div class="v4-pan-sign"><span>हस्ताक्षर / Signature</span><div>${photo?'':'Signature'}</div></div></div>`;
  }
  function v4PreviewData(prefix){
    const val=id=>v4$(id)?.value?.trim()||'';
    const dob=val(prefix+'Dob')||'';
    return {name:[val(prefix+'FirstName'),val(prefix+'MiddleName'),val(prefix+'LastName')].filter(Boolean).join(' '),father:val(prefix+'FatherName'),gender:val(prefix+'Gender'),dob:dob?new Date(dob+'T00:00:00').toLocaleDateString('en-IN'):'DD/MM/YYYY',demoPan:'XXXP0000X'};
  }

  // Add gender to current preview without changing existing form logic.
  function v4UpdateNewPreview(){
    const data={name:[v4$('firstName')?.value,v4$('middleName')?.value,v4$('lastName')?.value].filter(Boolean).join(' '),father:[v4$('fatherFirstName')?.value,v4$('fatherMiddleName')?.value,v4$('fatherlastName')?.value].filter(Boolean).join(' '),gender:v4$('gender')?.value,dob:v4$('dob')?.value?new Date(v4$('dob').value+'T00:00:00').toLocaleDateString('en-IN'):'DD/MM/YYYY',demoPan:'XXXP0000X'};
    const photo=(croppedFiles.photo||v4$('photo')?.files?.[0]);
    if(photo){const u=URL.createObjectURL(photo);const target=v4$('newPanFinalPreview');if(target){let card=target.querySelector('.v4-pan-card');if(!card){target.insertAdjacentHTML('afterbegin','<div id="v4NewPanCard"></div>');card=v4$('v4NewPanCard')}v4DemoPreviewCard(data,u,'v4NewPanCard');setTimeout(()=>URL.revokeObjectURL(u),1000);}}
  }
  document.addEventListener('input',e=>{if(e.target?.closest('#newpanForm'))v4UpdateNewPreview();});
  document.addEventListener('change',e=>{if(e.target?.closest('#newpanForm'))v4UpdateNewPreview();});

  // User action center: only actionable/rejected items are shown on home.
  function v4RenderUserActionCenter(list){
    const box=v4$('userActionCenter');if(!box)return;
    const actions=[];
    list.forEach(a=>{
      const rejected=Array.isArray(a.rejectedDocuments)?a.rejectedDocuments:[];
      rejected.forEach(d=>actions.push({type:'doc',app:a,doc:d}));
      if(String(a.paymentStatus||'').toLowerCase()==='rejected')actions.push({type:'payment',app:a});
    });
    if(!actions.length){box.hidden=true;box.innerHTML='';return;}
    box.hidden=false;
    box.innerHTML=`<div class="uac-head"><div><span class="eyebrow">ACTION CENTER</span><h2>Action Required</h2><p>Review these items before your application can continue.</p></div><span class="uac-count">${actions.length}</span></div><div class="uac-list">${actions.map(x=>x.type==='doc'?`<article class="uac-item danger"><div class="uac-icon"><i class="fa fa-file-circle-exclamation"></i></div><div class="uac-main"><strong>${v4esc(x.doc.label||V4_DOC_LABELS[x.doc.key]||x.doc.key)}</strong><span>${v4esc(x.app.name||'PAN Application')} • ${v4esc(x.app.ackNo)}</span><p>${v4esc(x.doc.remark||'Document rejected. Please upload again.')}</p></div><button class="uac-btn" type="button" onclick="v4OpenRejectedUpload('${x.app.id}','${v4esc(x.doc.key)}')">Upload Again</button></article>`:`<article class="uac-item danger"><div class="uac-icon"><i class="fa fa-credit-card"></i></div><div class="uac-main"><strong>Payment request rejected</strong><span>${v4esc(x.app.name||'PAN Application')} • ${v4esc(x.app.ackNo)}</span><p>${v4esc(x.app.paymentRemark||x.app.remark||'Please retry the payment.')}</p></div><button class="uac-btn" type="button" onclick="v4RetryRejectedPayment('${x.app.ackNo}')">Retry Payment</button></article>`).join('')}</div>`;
  }
  async function v4LoadUserActions(){
    if(v4UserUnsub){v4UserUnsub();v4UserUnsub=null;}
    if(!currentUser){const b=v4$('userActionCenter');if(b)b.hidden=true;return;}
    v4UserUnsub=db.collection('applications').where('userId','==',currentUser.uid).onSnapshot(s=>v4RenderUserActionCenter(s.docs.map(d=>({id:d.id,...d.data()}))),()=>{});
  }
  window.v4LoadUserActions=v4LoadUserActions;
  const _v4LoadHistory=window.loadApplicationHistory;
  window.loadApplicationHistory=async function(){await _v4LoadHistory();v4LoadUserActions();};

  // Rejected document upload: only that document is replaceable.
  function v4OpenRejectedUpload(appId,key){
    const a=(window.__v4UserApps||[]).find(x=>x.id===appId);
    v4RejectedContext={appId,key};
    let modal=v4$('v4RejectedUploadModal');
    if(!modal){modal=document.createElement('div');modal.id='v4RejectedUploadModal';modal.className='popup v4-reject-upload-modal';modal.innerHTML='<div class="popup-box"><div class="v4-upload-head"><div><span class="eyebrow">DOCUMENT REPLACEMENT</span><h3 id="v4RejectTitle">Upload document</h3><p id="v4RejectMeta"></p></div><button class="icon-button" type="button" onclick="closePopup(\'v4RejectedUploadModal\')"><i class="fa fa-times"></i></button></div><div class="v4-upload-note"><i class="fa fa-circle-info"></i> Sirf rejected document replace hoga. Baaki documents safe rahenge.</div><input id="v4RejectedFile" type="file" accept="image/jpeg,image/png,image/webp"><p id="v4RejectedMsg" class="message"></p><div class="popup-actions"><button class="btn ghost" type="button" onclick="closePopup(\'v4RejectedUploadModal\')">Cancel</button><button class="btn" type="button" id="v4RejectedUploadBtn">Crop & Upload</button></div></div>';document.body.appendChild(modal)}
    const app=window.__v4UserApps?.find(x=>x.id===appId);v4$('v4RejectTitle').textContent=(V4_DOC_LABELS[key]||key)+' — Upload Again';v4$('v4RejectMeta').textContent=`ACK: ${app?.ackNo||''}`;v4$('v4RejectedFile').value='';v4$('v4RejectedMsg').textContent='';
    openPopup('v4RejectedUploadModal');
    v4$('v4RejectedUploadBtn').onclick=async()=>{
      const f=v4$('v4RejectedFile').files?.[0];if(!f){v4$('v4RejectedMsg').textContent='Please select an image.';return;}if(!f.type.startsWith('image/')){v4$('v4RejectedMsg').textContent='Only image files are allowed.';return;}
      try{v4$('v4RejectedUploadBtn').disabled=true;v4$('v4RejectedMsg').textContent='Uploading…';const url=await uploadToCloudinary(f);const a=window.__v4UserApps?.find(x=>x.id===appId);const rejected=(a?.rejectedDocuments||[]).filter(x=>x.key!==key);const field=key==='oldPanCopy'?'oldPanCopy':key;await db.collection('applications').doc(appId).update({[field]:url,rejectedDocuments:rejected,documentStatuses:{...(a?.documentStatuses||{}),[key]:'pending'},status:'document_verification',lastDocumentResubmitted:key,lastDocumentResubmittedAt:firebase.firestore.FieldValue.serverTimestamp()});showToast('Document uploaded for re-verification ✓');closePopup('v4RejectedUploadModal');}catch(e){v4$('v4RejectedMsg').textContent=e.message||String(e);}finally{v4$('v4RejectedUploadBtn').disabled=false;}
    };
  }
  window.v4OpenRejectedUpload=v4OpenRejectedUpload;
  window.v4RetryRejectedPayment=async function(ack){try{await openCustomerPaymentByAck(ack);}catch(e){showToast(e.message||String(e),'error')}};

  // Capture user app data for action-center lookup.
  document.addEventListener('click',()=>{if(currentUser)db.collection('applications').where('userId','==',currentUser.uid).get().then(s=>window.__v4UserApps=s.docs.map(d=>({id:d.id,...d.data()}))).catch(()=>{});},{passive:true});

  // Correction: always show all New PAN details; selected fields are editable, non-selected remain current/read-only.
  function v4CorrectionField(label,id,opts={}){return `<div class="form-group"><label for="${id}">${label}${opts.required?'*':''}</label><input id="${id}" type="${opts.type||'text'}" ${opts.required?'required':''} ${opts.readonly?'readonly':''}></div>`;}
  function v4RenderCorrectionAllFields(){
    const box=v4$('correctionDynamicFields');if(!box)return;const sel=selectedCorrections();
    const row=(label,id)=>v4CorrectionField(label,id,{required:true,readonly:!sel.includes(id.replace(/^corNew/,'').toLowerCase())});
    const editable=k=>sel.includes(k);
    const ro=k=>editable(k)?'':'readonly';
    box.innerHTML=`<div class="correction-subcard full-details"><h4>Complete PAN Details</h4><p class="section-help">Sabhi New PAN details yahan hain. Jo correction select kiya hai wahi field editable rahega; baaki current details ko same rakhein.</p><div class="form-grid">${v4CorrectionField('Last Name','corNewLastName',{required:true,readonly:!editable('name')})}${v4CorrectionField('First Name','corNewFirstName',{readonly:!editable('name')})}${v4CorrectionField('Middle Name','corNewMiddleName',{readonly:!editable('name')})}${v4CorrectionField('Name as per Aadhaar','corNewNameAadhar',{readonly:!editable('name')})}${v4CorrectionField('Aadhaar Number','corNewAadhaar',{required:true,readonly:true})}${v4CorrectionField('Date of Birth','corNewDob',{type:'date',required:true,readonly:!editable('dob')})}<div class="form-group"><label for="corNewGender">Gender*</label><select id="corNewGender" required ${!editable('gender')?'disabled':''}><option value="">Select</option><option>Male</option><option>Female</option></select></div>${v4CorrectionField("Father's Last Name",'corNewFatherLast',{required:true,readonly:!editable('father')})}${v4CorrectionField("Father's First Name",'corNewFatherFirst',{readonly:!editable('father')})}${v4CorrectionField("Father's Middle Name",'corNewFatherMiddle',{readonly:!editable('father')})}${v4CorrectionField("Mother's Last Name",'corNewMotherLast',{readonly:!editable('mother')})}${v4CorrectionField("Mother's First Name",'corNewMotherFirst',{readonly:!editable('mother')})}${v4CorrectionField("Mother's Middle Name",'corNewMotherMiddle',{readonly:!editable('mother')})}${v4CorrectionField('Phone','corNewPhone',{type:'tel',required:true,readonly:!editable('contact')})}${v4CorrectionField('Email','corNewEmail',{type:'email',required:true,readonly:!editable('contact')})}${v4CorrectionField('PIN Code','corNewPin',{required:true,readonly:!editable('address')})}${v4CorrectionField('Flat No/C/O','corNewFlat',{required:true,readonly:!editable('address')})}${v4CorrectionField('Village/City','corNewVillage',{required:true,readonly:!editable('address')})}${v4CorrectionField('Post Office','corNewPost',{required:true,readonly:!editable('address')})}${v4CorrectionField('Sub Division','corNewSubDivision',{required:true,readonly:!editable('address')})}${v4CorrectionField('District','corNewDistrict',{required:true,readonly:!editable('address')})}${v4CorrectionField('State','corNewState',{required:true,readonly:!editable('address')})}</div></div><div class="correction-subcard"><h4>Guardian Details (Minor)</h4><div class="form-grid">${v4CorrectionField('Guardian Last Name','corNewGuardianLast',{readonly:true})}${v4CorrectionField('Guardian First Name','corNewGuardianFirst',{readonly:true})}${v4CorrectionField('Guardian Middle Name','corNewGuardianMiddle',{readonly:true})}</div></div><div class="correction-subcard"><h4>Other Correction</h4><div class="form-group"><label for="corOtherValue">Other details</label><textarea id="corOtherValue" rows="3"></textarea></div></div>`;
    const base={corNewLastName:v4$('corLastName')?.value||'',corNewFirstName:v4$('corFirstName')?.value||'',corNewMiddleName:v4$('corMiddleName')?.value||'',corNewNameAadhar:v4$('corNameAadhar')?.value||'',corNewAadhaar:v4$('corAadhaar')?.value||'',corNewDob:v4$('corDob')?.value||'',corNewGender:v4$('corGender')?.value||'',corNewFatherLast:'',corNewFatherFirst:v4$('corFatherName')?.value||'',corNewFatherMiddle:'',corNewMotherLast:'',corNewMotherFirst:v4$('corMotherName')?.value||'',corNewMotherMiddle:'',corNewPhone:v4$('corPhone')?.value||'',corNewEmail:v4$('corEmail')?.value||'',corNewPin:v4$('corPin')?.value||'',corNewFlat:v4$('corFlat')?.value||'',corNewVillage:v4$('corVillage')?.value||'',corNewPost:v4$('corPost')?.value||'',corNewSubDivision:v4$('corSubDivision')?.value||'',corNewDistrict:v4$('corDistrict')?.value||'',corNewState:v4$('corState')?.value||''};
    Object.entries(base).forEach(([id,val])=>{const e=v4$(id);if(e&&!e.value)e.value=val});
    const bindIds=Object.keys(base).concat(['corOtherValue']);bindIds.forEach(id=>{const e=v4$(id);if(e)e.oninput=()=>{syncCorrectionToBase();updateCorrectionPreview();updateCorrectionSummary();saveCorrectionDraft();}});
  }
  const _v4RenderCorrectionDynamicFields=window.renderCorrectionDynamicFields;
  window.renderCorrectionDynamicFields=function(){v4RenderCorrectionAllFields();};
  const _v4LoadCorrectionDraft=window.loadCorrectionDraft;
  window.loadCorrectionDraft=function(){try{_v4LoadCorrectionDraft();}catch(e){}v4RenderCorrectionAllFields();};

  // Include old PAN copy in correction crop/upload validation.
  const _v4BuildCorrectionData=window.buildCorrectionData;
  window.buildCorrectionData=function(){const d=_v4BuildCorrectionData();d.oldPanCopy=v4$('corOldPanCopy')?.files?.[0]?'':(window.croppedFiles?.corOldPanCopy||'');return d;};
  // Capture correction submit and perform image-only upload with old PAN copy.
  document.addEventListener('submit',e=>{
    if(e.target?.id!=='correctionForm')return;
    e.preventDefault();e.stopImmediatePropagation();
    v4SubmitCorrection();
  },true);
  async function v4SubmitCorrection(){
    if(!currentUser)return redirectToLogin();
    if(!validateCorrectionStep())return;
    const ids=['corPhoto','corSignature','corAadhaarFront','corAadhaarBack','corDobProof','corOldPanCopy'];
    const files=ids.map(id=>window.croppedFiles?.[id]||v4$(id)?.files?.[0]);
    if(files.some(f=>!f)){showToast('Correction ke liye sabhi required documents upload karein, including Old PAN Copy.','error');correctionStepIndex=correctionSteps.length-2;renderCorrectionSteps();return;}
    const btn=v4$('corSubmitBtn');try{btn.disabled=true;btn.textContent='Uploading Documents…';const urls=await Promise.all(files.map(uploadToCloudinary));const d=window.buildCorrectionData();Object.assign(d,{photo:urls[0],signature:urls[1],aadhaarFront:urls[2],aadhaarBack:urls[3],dobProof:urls[4],oldPanCopy:urls[5],status:'pending',workflowStage:'payment_verification',paymentStatus:'pending',paymentAmount:Number(v4Settings.panFee||190),documentStatuses:{photo:'pending',signature:'pending',aadhaarFront:'pending',aadhaarBack:'pending',dobProof:'pending',oldPanCopy:'pending'}});const ref=await db.collection('applications').add(d);d.id=ref.id;generatePDF(d);clearCorrectionDraft();resetCorrectionFormAfterSubmit();showToast('PAN Correction submitted successfully ✓');setTimeout(()=>openCustomerPaymentByAck(d.ackNo),600);}catch(e){showToast('Correction error: '+(e.message||e),'error');}finally{btn.disabled=false;btn.textContent='Submit Correction';}
  }

  // Direct payment uses live admin UPI and current admin fee.
  window.openDirectPayment=async function(ack){
    const snap=await db.collection('applications').where('ackNo','==',ack).limit(1).get();if(snap.empty)throw new Error('Application not found.');const app={id:snap.docs[0].id,...snap.docs[0].data()};if(String(app.paymentStatus||'').toLowerCase()==='paid')throw new Error('Payment already verified.');const s=await v4GetSettings();const amount=Number(app.paymentAmount||s.panFee||190);v4$('directPayCustomer').textContent=`${getCustomerName(app)} • ${app.ackNo}`;v4$('directPayAmount').textContent=amount.toLocaleString('en-IN');v4$('directPayQr').innerHTML='';const upi=`upi://pay?pa=${encodeURIComponent(s.upiId)}&pn=${encodeURIComponent(s.businessName||'TECH SOURCE')}&am=${encodeURIComponent(amount.toFixed(2))}&cu=INR&tn=${encodeURIComponent(`PAN Payment | ACK: ${app.ackNo}`)}`;if(window.QRCode)new QRCode(v4$('directPayQr'),{text:upi,width:190,height:190,correctLevel:QRCode.CorrectLevel.M});v4$('directPayUtr').value='';v4$('directPaySubmit').dataset.appId=app.id;v4$('directPaySubmit').dataset.ack=app.ackNo;const upiEl=document.querySelector('#directPaymentView .cp-upi strong');if(upiEl)upiEl.textContent=s.upiId;openPopup('paymentPopup');
  };

  // Customer payment page always uses the amount stored in the payment-link document and live admin UPI.
  const _v4LoadCustomerPaymentPage=window.loadCustomerPaymentPage;
  window.loadCustomerPaymentPage=async function(){const result=await _v4LoadCustomerPaymentPage();try{const s=await v4GetSettings();const u=v4$('cpUpi');if(u)u.textContent=s.upiId; if(customerPaymentContext?.amount) v4$('cpAmount').textContent=Number(customerPaymentContext.amount).toLocaleString('en-IN');}catch(e){}return result;};

  window.retryCustomerPayment=async function(){
    if(!customerPaymentContext?.id)return;
    try{const now=firebase.firestore.FieldValue.serverTimestamp();await db.collection('customerPaymentRequests').doc(customerPaymentContext.id).update({status:'pending',paymentStatus:'pending',utr:'',customerMarkedPaid:false,retryAt:now});if(customerPaymentContext.applicationId)await db.collection('applications').doc(customerPaymentContext.applicationId).update({paymentStatus:'pending',paymentRequestSubmittedAt:null});customerPaymentContext.status='pending';const panel=v4$('cpSuccessPanel');if(panel)panel.hidden=true;document.querySelector('.cp-qr-wrap')?.classList.remove('v3-paid-hide');document.querySelector('.cp-upi')?.classList.remove('v3-paid-hide');v4$('cpDoneBtn').hidden=false;v4$('cpDoneBtn').disabled=false;v4$('cpStatus').textContent='Payment page ready again. Please complete the payment.';v4$('cpStatus').style.color='';await v4LoadCustomerPaymentPage();}catch(e){showToast(e.message||String(e),'error');}
  };

  // Customer payment done: immediate polished pending state; QR disappears. UTR remains available if configured.
  window.customerPaymentDone=async function(){
    if(!customerPaymentContext?.id)return;const btn=v4$('cpDoneBtn');if(btn)btn.disabled=true;
    try{const now=firebase.firestore.FieldValue.serverTimestamp();await db.collection('customerPaymentRequests').doc(customerPaymentContext.id).update({status:'customer_marked_paid',paymentStatus:'verification_pending',customerMarkedPaid:true,customerMarkedPaidAt:now});if(customerPaymentContext.applicationId)await db.collection('applications').doc(customerPaymentContext.applicationId).update({paymentStatus:'verification_pending',customerPaymentRequestId:customerPaymentContext.id,paymentRequestSubmittedAt:now});customerPaymentContext.status='customer_marked_paid';document.querySelector('.cp-qr-wrap')?.classList.add('v3-paid-hide');document.querySelector('.cp-upi')?.classList.add('v3-paid-hide');const panel=v4$('cpSuccessPanel');if(panel)panel.hidden=false;v4$('cpTitle').textContent='Payment Request Sent';v4$('cpMessage').textContent='Your payment request has been sent. Payment is pending for review. Please wait.';v4$('cpStatus').textContent='Verification Pending';v4$('cpStatus').style.color='#15803d';if(btn)btn.hidden=true;}catch(e){if(btn)btn.disabled=false;v4$('cpStatus').textContent='Could not send request: '+(e.message||e);v4$('cpStatus').style.color='#dc2626';}
  };

  // Keep receipt as the only PDF output. Documents remain images only.
  function v4ImageAccept(){return 'image/jpeg,image/png,image/webp';}
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('input[type=file]').forEach(i=>{if(i.id!=='profilePhoto'&&!/final/i.test(i.id))i.accept=v4ImageAccept();});
    const sm=v4$('serviceMenuBtn');if(sm)sm.onclick=()=>toggleServiceMenu();
    v4ApplySettingsToUI();
    if(currentUser)v4LoadUserActions();
  });
  window.toggleServiceMenu=function(force){const d=v4$('serviceDrawer');if(!d)return;const open=force===undefined?!d.classList.contains('show'):force;d.classList.toggle('show',open);d.setAttribute('aria-hidden',String(!open));};
  document.addEventListener('click',e=>{const d=v4$('serviceDrawer'),w=document.querySelector('.service-menu-wrap');if(d?.classList.contains('show')&&!w?.contains(e.target))toggleServiceMenu(false);});
})();
/* V4 corrections: reliable rejected-app lookup and workflow metadata defaults */
(function(){
  const oldBuild=window.v3BuildFormData;
  if(oldBuild) window.v3BuildFormData=function(){
    const d=oldBuild();
    const ds={photo:'pending',signature:'pending',aadhaarFront:'pending',aadhaarBack:'pending',dobProof:'pending'};
    if(d.guardianFront)ds.guardianFront='pending'; if(d.guardianBack)ds.guardianBack='pending';
    d.documentStatuses=ds; d.workflowStage='payment_verification'; d.paymentAmount=Number(window.v4Settings?.panFee||d.paymentAmount||190);
    return d;
  };
  window.v4OpenRejectedUpload=async function(appId,key){
    let app=null; try{const s=await db.collection('applications').doc(appId).get();if(!s.exists){showToast('Application not found.','error');return;}app={id:s.id,...s.data()};}catch(e){showToast('Could not load application.','error');return;}
    window.v4RejectedContext={appId,key};
    let modal=document.getElementById('v4RejectedUploadModal');
    if(!modal){modal=document.createElement('div');modal.id='v4RejectedUploadModal';modal.className='popup v4-reject-upload-modal';modal.innerHTML='<div class="popup-box"><div class="v4-upload-head"><div><span class="eyebrow">DOCUMENT REPLACEMENT</span><h3 id="v4RejectTitle">Upload document</h3><p id="v4RejectMeta"></p></div></div><div class="v4-upload-note"><i class="fa fa-circle-info"></i> Sirf rejected document replace hoga. Baaki documents safe rahenge.</div><input id="v4RejectedFile" type="file" accept="image/jpeg,image/png,image/webp"><p id="v4RejectedMsg" class="message"></p><div class="popup-actions"><button class="btn ghost" type="button" onclick="closePopup(\'v4RejectedUploadModal\')">Cancel</button><button class="btn" type="button" id="v4RejectedUploadBtn">Upload Document</button></div></div>';document.body.appendChild(modal)}
    document.getElementById('v4RejectTitle').textContent=(window.__v4DocLabels?.[key]||({photo:'Photo',signature:'Signature',aadhaarFront:'Aadhaar Front',aadhaarBack:'Aadhaar Back',dobProof:'DOB Proof',guardianFront:'Guardian Aadhaar Front',guardianBack:'Guardian Aadhaar Back',oldPanCopy:'Old PAN Card Copy'}[key]||key))+' — Upload Again';
    document.getElementById('v4RejectMeta').textContent='ACK: '+(app.ackNo||'');document.getElementById('v4RejectedFile').value='';document.getElementById('v4RejectedMsg').textContent='';openPopup('v4RejectedUploadModal');
    document.getElementById('v4RejectedUploadBtn').onclick=async()=>{const f=document.getElementById('v4RejectedFile').files?.[0],msg=document.getElementById('v4RejectedMsg'),btn=document.getElementById('v4RejectedUploadBtn');if(!f){msg.textContent='Please select an image.';return;}if(!f.type.startsWith('image/')){msg.textContent='Only JPG, JPEG, PNG or WEBP allowed.';return;}try{btn.disabled=true;msg.textContent='Uploading…';const url=await uploadToCloudinary(f);const rejected=(app.rejectedDocuments||[]).filter(x=>x.key!==key);const statuses={...(app.documentStatuses||{}),[key]:'pending'};const update={[key]:url,rejectedDocuments:rejected,documentStatuses:statuses,workflowStage:'document_verification',lastDocumentResubmitted:key,lastDocumentResubmittedAt:firebase.firestore.FieldValue.serverTimestamp()};await db.collection('applications').doc(appId).update(update);showToast('Document uploaded for re-verification ✓');closePopup('v4RejectedUploadModal');}catch(e){msg.textContent=e.message||String(e);}finally{btn.disabled=false;}};
  };
})();
/* V4 final: load current fee before New PAN preview/submission */
(function(){
  const oldIntercept=window.v3InterceptNewSubmit;
  if(oldIntercept) window.v3InterceptNewSubmit=async function(e){
    e.preventDefault();e.stopImmediatePropagation();
    try{const s=await window.v4GetSettings();window.__v4PanFee=Number(s.panFee||190);}catch(e){window.__v4PanFee=190;}
    const data=window.v3BuildFormData(); if(data)data.paymentAmount=window.__v4PanFee||190;
    if(!data)return; window.v3OpenPreview(data);
  };
  const oldBuild=window.v3BuildFormData;
  if(oldBuild) window.v3BuildFormData=function(){const d=oldBuild();d.paymentAmount=Number(window.__v4PanFee||d.paymentAmount||190);return d;};
})();
/* V4 customer payment page refresh: apply live UPI after legacy startup call. */
if(window.customerPaymentLoaded){setTimeout(()=>window.loadCustomerPaymentPage?.(),0);}
/* V4 rejected customer payment link can be reopened for another payment attempt. */
(function(){
  const base=window.loadCustomerPaymentPage;
  window.loadCustomerPaymentPage=async function(){const ok=await base();if(customerPaymentContext?.status==='rejected'){const s=await window.v4GetSettings();document.querySelector('.cp-qr-wrap')?.classList.remove('v3-paid-hide');document.querySelector('.cp-upi')?.classList.remove('v3-paid-hide');document.getElementById('cpSuccessPanel')?.setAttribute('hidden','');document.getElementById('cpTitle').textContent='Payment Rejected';document.getElementById('cpMessage').textContent='Your previous payment request was rejected. You can retry the payment below.';document.getElementById('cpStatus').textContent='Please complete the payment again.';document.getElementById('cpDoneBtn').hidden=false;document.getElementById('cpDoneBtn').disabled=false;document.getElementById('cpUpi').textContent=s.upiId||'';}return ok;};
  if(window.customerPaymentLoaded)setTimeout(()=>window.loadCustomerPaymentPage?.(),50);
})();
/* V4 correction sync/draft support for the complete New PAN field set. */
(function(){
  const oldSync=window.syncCorrectionToBase;
  window.syncCorrectionToBase=function(){
    const val=id=>document.getElementById(id)?.value||'';
    const set=(id,v)=>{const e=document.getElementById(id);if(e&&v!==undefined)e.value=v;};
    if(selectedCorrections().includes('name')){set('corFirstName',val('corNewFirstName'));set('corMiddleName',val('corNewMiddleName'));set('corLastName',val('corNewLastName'));}
    if(selectedCorrections().includes('father'))set('corFatherName',[val('corNewFatherFirst'),val('corNewFatherMiddle'),val('corNewFatherLast')].filter(Boolean).join(' '));
    if(selectedCorrections().includes('mother'))set('corMotherName',[val('corNewMotherFirst'),val('corNewMotherMiddle'),val('corNewMotherLast')].filter(Boolean).join(' '));
    if(selectedCorrections().includes('dob'))set('corDob',val('corNewDob'));if(selectedCorrections().includes('gender'))set('corGender',val('corNewGender'));if(selectedCorrections().includes('contact')){set('corPhone',val('corNewPhone'));set('corEmail',val('corNewEmail'));}if(selectedCorrections().includes('address')){['Pin','Flat','Village','Post','SubDivision','District','State'].forEach(k=>set('cor'+k,val('corNew'+k)));}
  };
  const oldInputIds=window.correctionInputIds;
  window.correctionInputIds=function(){const base=oldInputIds?oldInputIds():[];return [...new Set(base.concat(['corNewLastName','corNewFirstName','corNewMiddleName','corNewNameAadhar','corNewAadhaar','corNewDob','corNewGender','corNewFatherLast','corNewFatherFirst','corNewFatherMiddle','corNewMotherLast','corNewMotherFirst','corNewMotherMiddle','corNewGuardianLast','corNewGuardianFirst','corNewGuardianMiddle','corNewPhone','corNewEmail','corNewPin','corNewFlat','corNewVillage','corNewPost','corNewSubDivision','corNewDistrict','corNewState','corOtherValue']))]};
})();
/* V4 user timeline: exact payment → documents → process → PAN workflow. */
(function(){
  const stageLabels={payment_verification:'Payment Verification',document_verification:'Document Verification',under_process:'Under Process',pan_processing:'PAN Processing',approved:'Approved',final_upload:'Final PAN Upload',completed:'Completed'};
  function userStage(a){return a.workflowStage||((String(a.paymentStatus||'').toLowerCase()==='paid')?'document_verification':'payment_verification');}
  window.renderTimeline=function(a){const order=['payment_verification','document_verification','under_process','pan_processing','approved','final_upload','completed'];const cur=Math.max(0,order.indexOf(userStage(a)));return `<div class="status-timeline v4-user-timeline">${order.map((s,i)=>`<div class="timeline-step ${i<cur?'done':i===cur?'active':''}"><span>${i<cur?'✓':i+1}</span><strong>${stageLabels[s]}</strong></div>`).join('')}</div>`};
  window.renderStatusDetails=function(data){const stage=userStage(data),docs=data.documentStatuses||{},rejected=Array.isArray(data.rejectedDocuments)?data.rejectedDocuments:[];return `<div class="status-panel v4-status-panel"><div class="status-panel-head"><div><span class="history-label">Application Status</span><h4>${escapeHtml(data.name||'PAN Application')}</h4><p>${escapeHtml(data.ackNo||'N/A')}</p></div><span class="status-badge ${stage==='completed'?'approved':rejected.length?'rejected':'pending'}">${escapeHtml(stageLabels[stage]||stage)}</span></div>${renderTimeline(data)}<div class="status-list"><div class="status-row"><small>Payment</small><strong>${data.paymentStatus==='paid'?'✓ Verified':'Pending Verification'}</strong></div><div class="status-row"><small>Documents</small><strong>${rejected.length?'Action Required':Object.keys(docs).length?Object.values(docs).filter(x=>x==='verified').length+' verified':'Pending Verification'}</strong></div><div class="status-row"><small>Applied On</small><strong>${escapeHtml(formatDate(data.createdAt))}</strong></div><div class="status-row status-row-wide"><small>Remark</small><strong>${escapeHtml(data.remark||'No remark')}</strong></div></div>${rejected.length?`<div class="v4-user-rejected-list"><b>Documents needing attention</b>${rejected.map(r=>`<div><span>${escapeHtml(r.label||r.key)}</span><button type="button" onclick="v4OpenRejectedUpload('${data.id}','${escapeHtml(r.key)}')">Upload Again</button><small>${escapeHtml(r.remark||'')}</small></div>`).join('')}</div>`:''}</div>`};
})();

/* TECH SOURCE FINAL UX PATCH */
(function(){
  const escU=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const labelU={photo:'Photo',signature:'Signature',aadhaarFront:'Aadhaar Front',aadhaarBack:'Aadhaar Back',dobProof:'DOB Proof',guardianFront:'Guardian Aadhaar Front',guardianBack:'Guardian Aadhaar Back',oldPanCopy:'Old PAN Card Copy'};
  function userAppsDocs(a){
    const docs=['photo','signature','aadhaarFront','aadhaarBack','dobProof'];
    if(a.guardianFront)docs.push('guardianFront');
    if(a.guardianBack)docs.push('guardianBack');
    if(a.oldPanCopy)docs.push('oldPanCopy');
    return docs;
  }
  function allDocsVerifiedU(a){
    const statuses=a.documentStatuses||{};
    const docs=userAppsDocs(a);
    return docs.length>0 && docs.every(k=>String(statuses[k]||'pending').toLowerCase()==='verified');
  }
  function renderHeaderActionsU(list){
    const badge=document.getElementById('userActionBadge'),panel=document.getElementById('serviceActionPanel');
    if(!badge||!panel)return;
    const actions=[];
    list.forEach(a=>{
      (Array.isArray(a.rejectedDocuments)?a.rejectedDocuments:[]).forEach(d=>actions.push({type:'doc',app:a,doc:d}));
      if(String(a.paymentStatus||'').toLowerCase()==='rejected')actions.push({type:'payment',app:a});
    });
    badge.textContent=actions.length;
    badge.hidden=!actions.length;
    if(!actions.length){panel.hidden=true;panel.innerHTML='';return;}
    panel.hidden=false;
    panel.innerHTML=`<div class="service-action-head"><div><b>Action Required</b><small>${actions.length} item${actions.length===1?'':'s'} need your attention</small></div><span>${actions.length}</span></div><div class="service-action-list">${actions.map(x=>x.type==='doc'?`<div class="service-action-item"><div class="service-action-icon"><i class="fa fa-file-circle-exclamation"></i></div><div><b>${escU(x.doc.label||labelU[x.doc.key]||x.doc.key)}</b><small>${escU(x.app.ackNo||'')}</small><p>${escU(x.doc.remark||'Document rejected. Please upload again.')}</p></div><button type="button" onclick="v4OpenRejectedUpload('${escU(x.app.id)}','${escU(x.doc.key)}')">Upload</button></div>`:`<div class="service-action-item"><div class="service-action-icon"><i class="fa fa-credit-card"></i></div><div><b>Payment request rejected</b><small>${escU(x.app.ackNo||'')}</small><p>${escU(x.app.paymentRemark||x.app.remark||'Please retry the payment.')}</p></div><button type="button" onclick="v4RetryRejectedPayment('${escU(x.app.ackNo)}')">Retry</button></div>`).join('')}</div>`;
  }
  // Replace the old home notification/action bar with a compact header badge + service drawer actions.
  window.v4RenderUserActionCenter=renderHeaderActionsU;
  window.v4LoadUserActions=async function(){
    if(window.__finalUserActionUnsub){window.__finalUserActionUnsub();window.__finalUserActionUnsub=null;}
    const old=document.getElementById('userActionCenter');if(old)old.remove();
    if(!currentUser){const b=document.getElementById('userActionBadge');if(b)b.hidden=true;const p=document.getElementById('serviceActionPanel');if(p){p.hidden=true;p.innerHTML='';}return;}
    window.__finalUserActionUnsub=db.collection('applications').where('userId','==',currentUser.uid).onSnapshot(s=>renderHeaderActionsU(s.docs.map(d=>({id:d.id,...d.data()}))),()=>{});
  };

  // If an old startup callback already ran, start the new compact action indicator as well.
  document.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>window.v4LoadUserActions?.(),500);});
})();

/* FINAL PAN DEMO PREVIEW: show the uploaded signature in the correct signature area. */
(function(){
  const escP=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  window.v4DemoPreviewCard=function(data,photo,rootId,signature){
    const root=document.getElementById(rootId);if(!root)return;
    root.innerHTML=`<div class="v4-pan-card"><div class="v4-pan-watermark">DEMO • NOT OFFICIAL</div><div class="v4-pan-head"><div><b>आयकर विभाग</b><span>INCOME TAX DEPARTMENT</span></div><div class="v4-emblem">✦</div><div><b>भारत सरकार</b><span>GOVT. OF INDIA</span></div></div><div class="v4-pan-sub">स्थायी लेखा संख्या कार्ड <span>Permanent Account Number Card</span></div><div class="v4-pan-main"><div class="v4-pan-photo"><img src="${escP(photo||'')}" alt="Photo"></div><div class="v4-pan-center"><div class="v4-pan-number">${escP(data.demoPan||'XXXP0000X')}</div><div class="v4-pan-field"><small>नाम / Name</small><strong>${escP(data.name||'YOUR NAME')}</strong></div><div class="v4-pan-field"><small>पिता का नाम / Father's Name</small><strong>${escP(data.father||'FATHER NAME')}</strong></div><div class="v4-pan-row"><div><small>लिंग / Gender</small><strong>${escP(data.gender||'—')}</strong></div><div><small>जन्म की तारीख / DOB</small><strong>${escP(data.dob||'DD/MM/YYYY')}</strong></div></div></div><div class="v4-pan-qr"><span>DEMO</span><div class="fake-qr"></div></div></div><div class="v4-pan-sign"><span>हस्ताक्षर / Signature</span>${signature?`<img src="${escP(signature)}" alt="Signature">`:'<div>Signature</div>'}</div></div>`;
  };
  window.v4UpdateNewPreview=function(){
    const val=id=>document.getElementById(id)?.value||'';
    const data={name:[val('firstName'),val('middleName'),val('lastName')].filter(Boolean).join(' '),father:[val('fatherFirstName'),val('fatherMiddleName'),val('fatherlastName')].filter(Boolean).join(' '),gender:val('gender'),dob:val('dob')?new Date(val('dob')+'T00:00:00').toLocaleDateString('en-IN'):'DD/MM/YYYY',demoPan:'XXXP0000X'};
    const photo=window.croppedFiles?.photo||document.getElementById('photo')?.files?.[0];
    const signature=window.croppedFiles?.signature||document.getElementById('signature')?.files?.[0];
    if(!photo)return;
    const pu=URL.createObjectURL(photo),su=signature?URL.createObjectURL(signature):'';
    let target=document.getElementById('newPanFinalPreview');if(!target){URL.revokeObjectURL(pu);if(su)URL.revokeObjectURL(su);return;}
    let root=document.getElementById('v4NewPanCard');if(!root){root=document.createElement('div');root.id='v4NewPanCard';target.prepend(root);}
    window.v4DemoPreviewCard(data,pu,'v4NewPanCard',su);
    setTimeout(()=>{URL.revokeObjectURL(pu);if(su)URL.revokeObjectURL(su)},1000);
  };
  document.addEventListener('input',e=>{if(e.target?.closest('#newpanForm'))window.v4UpdateNewPreview();});
  document.addEventListener('change',e=>{if(e.target?.closest('#newpanForm'))window.v4UpdateNewPreview();});
})();

/* FINAL PAYMENT UX: customer-link QR always uses live admin UPI; link amount remains immutable. */
(function(){
  function rebuildCustomerQr(){
    const ctx=window.customerPaymentContext;if(!ctx)return;
    const qr=document.getElementById('cpQr');if(!qr||!window.QRCode)return;
    const amount=Number(ctx.amount||0); if(!amount)return;
    window.v4GetSettings?.().then(s=>{
      qr.innerHTML='';
      const upi=`upi://pay?pa=${encodeURIComponent(s.upiId||'')}&pn=${encodeURIComponent(s.businessName||'TECH SOURCE')}&am=${encodeURIComponent(amount.toFixed(2))}&cu=INR&tn=${encodeURIComponent(`PAN Payment | ACK: ${ctx.ackNo||''} | NAME: ${ctx.name||''}`)}`;
      new QRCode(qr,{text:upi,width:190,height:190,correctLevel:QRCode.CorrectLevel.M});
      const u=document.getElementById('cpUpi');if(u)u.textContent=s.upiId||'';
    }).catch(()=>{});
  }
  const baseLoad=window.loadCustomerPaymentPage;
  window.loadCustomerPaymentPage=async function(){
    const result=await baseLoad?.();
    setTimeout(rebuildCustomerQr,50);
    return result;
  };
  window.retryCustomerPayment=async function(){
    if(!window.customerPaymentContext?.id)return;
    try{
      const now=firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('customerPaymentRequests').doc(customerPaymentContext.id).update({status:'pending',paymentStatus:'pending',utr:'',customerMarkedPaid:false,retryAt:now});
      if(customerPaymentContext.applicationId)await db.collection('applications').doc(customerPaymentContext.applicationId).update({paymentStatus:'pending',paymentRequestSubmittedAt:null});
      customerPaymentContext.status='pending';
      const panel=document.getElementById('cpSuccessPanel');if(panel)panel.hidden=true;
      document.querySelector('.cp-qr-wrap')?.classList.remove('v3-paid-hide');
      document.querySelector('.cp-upi')?.classList.remove('v3-paid-hide');
      const done=document.getElementById('cpDoneBtn');if(done){done.hidden=false;done.disabled=false;}
      const status=document.getElementById('cpStatus');if(status){status.textContent='Payment page ready again. Please complete the payment.';status.style.color='';}
      await window.loadCustomerPaymentPage?.();
      rebuildCustomerQr();
    }catch(e){showToast(e.message||String(e),'error');}
  };
  const oldDone=window.customerPaymentDone;
  window.customerPaymentDone=async function(){
    await oldDone?.();
    try{showPaymentReceivedAnimation?.();}catch(e){}
  };
})();
