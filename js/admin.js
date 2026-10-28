/* =========================================================
   NAGI CUSTOM | ADMIN PANEL
   GitHub Pages + Google Apps Script
========================================================= */

const API_URL = "https://script.google.com/macros/s/AKfycbxwnDGrUDOGGfrKLa17GM59nR4z3Ajpi3aGJniQ0rMYxzTJo3MqVIQMGr2tquu4usJZ/exec";

const SESSION_KEY = "nagi_custom_admin_session";
const ADMIN_KEY = "nagi_custom_admin_info";

const $ = (id) => document.getElementById(id);

let sessionToken = "";
let currentAdmin = null;
let eventsCache = [];
let resultsCache = [];
let adminsCache = [];

/* =========================================================
   初期化
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();

  const savedToken = sessionStorage.getItem(SESSION_KEY);
  const savedAdmin = sessionStorage.getItem(ADMIN_KEY);

  if (savedToken && savedAdmin) {
    try {
      sessionToken = savedToken;
      currentAdmin = JSON.parse(savedAdmin);

      showDashboard();
      await loadDashboard();
    } catch (error) {
      console.error(error);
      clearSession();
      showLogin();
    }
  } else {
    showLogin();
  }
});

function bindEvents() {
  $("loginForm").addEventListener("submit", handleLogin);
  $("logoutButton").addEventListener("click", handleLogout);

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  $("newEventButton").addEventListener("click", () => openEventForm());
  $("cancelEventButton").addEventListener("click", closeEventForm);
  $("cancelEventButtonBottom").addEventListener("click", closeEventForm);
  $("eventForm").addEventListener("submit", handleSaveEvent);
  $("reloadEventsButton").addEventListener("click", loadEvents);
  $("eventSearch").addEventListener("input", renderEvents);

  $("newResultButton").addEventListener("click", () => openResultForm());
  $("cancelResultButton").addEventListener("click", closeResultForm);
  $("cancelResultButtonBottom").addEventListener("click", closeResultForm);
  $("resultForm").addEventListener("submit", handleSaveResult);

  $("adminForm").addEventListener("submit", handleCreateAdmin);
  $("reloadAdminsButton").addEventListener("click", loadAdmins);

  $("passwordForm").addEventListener("submit", handleChangePassword);
}

/* =========================================================
   API通信
========================================================= */

/**
 * Apps ScriptのdoPost(e)へJSON文字列を送信します。
 * text/plainを使って不要なCORSプリフライトを避けます。
 *
 * 注意：
 * Apps Script側のリダイレクトやブラウザのCORS制限によって
 * 通信が失敗する場合があります。その場合は通信方式の変更が必要です。
 */
async function apiRequest(action, payload = {}, requiresAuth = true) {
  if (!API_URL || API_URL.includes("ここにApps_Script")) {
    throw new Error("admin.js の API_URL にApps ScriptのWebアプリURLを設定してください。");
  }

  const body = {
    action,
    ...payload
  };

  if (requiresAuth && sessionToken) {
    body.token = sessionToken;
  }

  let response;

  try {
    response = await fetch(API_URL, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    console.error("API通信エラー:", error);
    throw new Error(
      "サーバーに接続できません。Apps Scriptの公開設定・URL・ブラウザの通信制限を確認してください。"
    );
  }

  if (!response.ok) {
    throw new Error(`サーバーエラー：HTTP ${response.status}`);
  }

  let result;

  try {
    result = await response.json();
  } catch (error) {
    throw new Error(
      "サーバーからJSON以外の応答が返されました。Apps ScriptのURLやデプロイ状態を確認してください。"
    );
  }

  if (
    result.success === false ||
    result.ok === false ||
    result.error
  ) {
    throw new Error(
      result.message ||
      result.error ||
      "サーバーで処理に失敗しました。"
    );
  }

  return result;
}

function unwrapData(result) {
  return result && result.data !== undefined ? result.data : result;
}

/* =========================================================
   ログイン・ログアウト
========================================================= */

async function handleLogin(event) {
  event.preventDefault();

  const button = $("loginButton");
  const message = $("loginMessage");

  setMessage(message, "");
  setButtonLoading(button, true, "認証中...");

  const adminId = $("loginId").value.trim();
  const password = $("loginPassword").value;

  try {
    const result = await apiRequest(
      "login",
      { adminId, password },
      false
    );

    const data = unwrapData(result);

    const token =
      data.token ||
      data.sessionToken ||
      result.token ||
      result.sessionToken;

    const admin =
      data.admin ||
      result.admin ||
      {
        adminId: data.adminId || adminId,
        role: data.role || ""
      };

    if (!token) {
      throw new Error(
        "ログイン応答にセッショントークンがありません。Code.gsのlogin処理と応答形式を確認してください。"
      );
    }

    sessionToken = token;
    currentAdmin = admin;

    sessionStorage.setItem(SESSION_KEY, sessionToken);
    sessionStorage.setItem(ADMIN_KEY, JSON.stringify(currentAdmin));

    $("loginPassword").value = "";

    showDashboard();
    await loadDashboard();
  } catch (error) {
    setMessage(message, error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
}

async function handleLogout() {
  try {
    if (sessionToken) {
      await apiRequest("logout");
    }
  } catch (error) {
    console.warn("ログアウト通知に失敗しました:", error);
  } finally {
    clearSession();
    showLogin();
    setMessage($("loginMessage"), "ログアウトしました。", "success");
  }
}

function clearSession() {
  sessionToken = "";
  currentAdmin = null;

  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(ADMIN_KEY);
}

function showLogin() {
  $("loginView").classList.remove("hidden");
  $("dashboardView").classList.add("hidden");
}

function showDashboard() {
  $("loginView").classList.add("hidden");
  $("dashboardView").classList.remove("hidden");

  $("currentAdmin").textContent =
    currentAdmin?.adminId ||
    currentAdmin?.id ||
    "ログイン中の管理者";

  $("currentRole").textContent =
    currentAdmin?.role || "権限確認中";

  const isSuperAdmin = isSuperAdminRole(currentAdmin?.role);

  document.querySelectorAll(".super-admin-only").forEach((element) => {
    element.classList.toggle("hidden", !isSuperAdmin);
  });

  // 一般管理者がURLから管理者管理タブを直接表示しないようにする
  if (!isSuperAdmin && $("tab-admins")) {
    $("tab-admins").classList.add("hidden");
  }
}

function isSuperAdminRole(role) {
  return ["最高管理者", "superadmin", "SUPER_ADMIN"].includes(role);
}

/* =========================================================
   ダッシュボード
========================================================= */

async function loadDashboard() {
  showGlobalMessage("データを読み込み中...");

  try {
    const result = await apiRequest("getDashboard");
    const data = unwrapData(result);

    if (data.admin) {
      currentAdmin = data.admin;
      sessionStorage.setItem(ADMIN_KEY, JSON.stringify(currentAdmin));
      showDashboard();
    }

    if (Array.isArray(data.events)) {
      eventsCache = data.events;
    }

    if (Array.isArray(data.results)) {
      resultsCache = data.results;
    }

    $("statEvents").textContent =
      data.stats?.eventCount ??
      data.eventCount ??
      eventsCache.length;

    $("statResults").textContent =
      data.stats?.resultCount ??
      data.resultCount ??
      resultsCache.length;

    renderEvents();
    renderResults();
    updateEventSelect();

    showGlobalMessage("データを読み込みました。", "success");
  } catch (error) {
    showGlobalMessage(error.message, "error");

    // 認証エラー時は画面に残さずログインし直す
    if (/認証|セッション|トークン|ログイン期限|権限/i.test(error.message)) {
      clearSession();
      showLogin();
    }
  }
}

async function loadEvents() {
  try {
    const result = await apiRequest("getDashboard");
    const data = unwrapData(result);

    eventsCache = Array.isArray(data.events) ? data.events : eventsCache;
    resultsCache = Array.isArray(data.results) ? data.results : resultsCache;

    renderEvents();
    renderResults();
    updateEventSelect();

    showGlobalMessage("大会情報を更新しました。", "success");
  } catch (error) {
    showGlobalMessage(error.message, "error");
  }
}

/* =========================================================
   タブ切り替え
========================================================= */

function switchTab(tabName) {
  if (tabName === "admins" && !isSuperAdminRole(currentAdmin?.role)) {
    showGlobalMessage("管理者管理は最高管理者のみ利用できます。", "error");
    return;
  }

  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  document.querySelectorAll('[id^="tab-"]').forEach((section) => {
    section.classList.add("hidden");
  });

  const selected = $("tab-" + tabName);

  if (selected) {
    selected.classList.remove("hidden");
  }

  if (tabName === "admins") {
    loadAdmins();
  }
}

/* =========================================================
   大会登録・編集・削除
========================================================= */

function openEventForm(eventData = null) {
  $("eventForm").classList.remove("hidden");
  $("eventFormTitle").textContent = eventData ? "大会を編集" : "大会を登録";

  $("eventId").value = eventData?.id || "";
  $("eventName").value = eventData?.eventName || "";
  $("eventGame").value = eventData?.game || "";
  $("eventThumbnail").value = eventData?.thumbnailUrl || "";
  $("eventApplicationUrl").value = eventData?.applicationUrl || "";
  $("eventStart").value = toDateInput(eventData?.startDate);
  $("eventEnd").value = toDateInput(eventData?.endDate);
  $("eventRegistrationStart").value = toDateInput(eventData?.registrationStart);
  $("eventRegistrationEnd").value = toDateInput(eventData?.registrationEnd);
  $("eventStatus").value = eventData?.status || "draft";
  $("eventFeatured").checked =
    eventData?.featured === true ||
    String(eventData?.featured).toLowerCase() === "true";

  $("eventDescription").value = eventData?.description || "";
  $("eventRules").value = eventData?.rules || "";

  $("eventForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeEventForm() {
  $("eventForm").classList.add("hidden");
  $("eventForm").reset();
  $("eventId").value = "";
}

async function handleSaveEvent(event) {
  event.preventDefault();

  const button = $("saveEventButton");
  setButtonLoading(button, true, "保存中...");

  const eventData = {
    id: $("eventId").value.trim(),
    eventName: $("eventName").value.trim(),
    game: $("eventGame").value.trim(),
    thumbnailUrl: $("eventThumbnail").value.trim(),
    applicationUrl: $("eventApplicationUrl").value.trim(),
    startDate: $("eventStart").value,
    endDate: $("eventEnd").value,
    registrationStart: $("eventRegistrationStart").value,
    registrationEnd: $("eventRegistrationEnd").value,
    status: $("eventStatus").value,
    featured: $("eventFeatured").checked,
    description: $("eventDescription").value.trim(),
    rules: $("eventRules").value.trim()
  };

  try {
    await apiRequest("saveEvent", { event: eventData });

    closeEventForm();
    await loadDashboard();

    showGlobalMessage("大会情報を保存しました。", "success");
  } catch (error) {
    showGlobalMessage(error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
}

async function deleteEvent(id, name) {
  const confirmed = window.confirm(
    `「${name}」を削除しますか？\nこの操作は取り消せません。`
  );

  if (!confirmed) return;

  try {
    await apiRequest("deleteEvent", { id });
    await loadDashboard();
    showGlobalMessage("大会を削除しました。", "success");
  } catch (error) {
    showGlobalMessage(error.message, "error");
  }
}

function renderEvents() {
  const container = $("eventsList");
  const keyword = $("eventSearch").value.trim().toLowerCase();

  const filtered = eventsCache.filter((item) => {
    const text = `${item.eventName || ""} ${item.game || ""}`.toLowerCase();
    return text.includes(keyword);
  });

  container.replaceChildren();

  if (!filtered.length) {
    container.innerHTML =
      '<div class="empty-state">該当する大会がありません。</div>';
    return;
  }

  filtered.forEach((item) => {
    const card = document.createElement("article");
    card.className = "data-card";

    const main = document.createElement("div");
    main.className = "data-card-main";

    const status = document.createElement("span");
    status.className = "status-tag " + safeClass(item.status);
    status.textContent = statusLabel(item.status);

    const title = document.createElement("h3");
    title.textContent = item.eventName || "名称未設定";

    const game = document.createElement("p");
    game.textContent = "GAME： " + (item.game || "未設定");

    const date = document.createElement("p");
    date.textContent =
      "開催日： " +
      (item.startDate || "未設定") +
      (item.endDate && item.endDate !== item.startDate
        ? " ～ " + item.endDate
        : "");

    main.append(status, title, game, date);

    const actions = document.createElement("div");
    actions.className = "data-card-actions";

    const editButton = makeButton("編集", "button button-outline button-small", () => {
      openEventForm(item);
    });

    const deleteButton = makeButton("削除", "button button-danger button-small", () => {
      deleteEvent(item.id, item.eventName || "名称未設定");
    });

    actions.append(editButton, deleteButton);
    card.append(main, actions);
    container.append(card);
  });
}

/* =========================================================
   大会結果
========================================================= */

function openResultForm(resultData = null) {
  updateEventSelect();

  $("resultForm").classList.remove("hidden");
  $("resultFormTitle").textContent = resultData
    ? "大会結果を編集"
    : "大会結果を登録";

  $("resultId").value = resultData?.id || "";
  $("resultEvent").value = resultData?.eventId || "";
  $("resultRank").value = resultData?.rank || "";
  $("resultTeam").value = resultData?.teamName || "";
  $("resultPlayer").value = resultData?.playerName || "";
  $("resultNotes").value = resultData?.notes || "";

  $("resultForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeResultForm() {
  $("resultForm").classList.add("hidden");
  $("resultForm").reset();
  $("resultId").value = "";
}

function updateEventSelect() {
  const select = $("resultEvent");
  const previousValue = select.value;

  select.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "大会を選択してください";
  select.append(placeholder);

  eventsCache.forEach((eventData) => {
    const option = document.createElement("option");
    option.value = eventData.id;
    option.textContent = eventData.eventName || eventData.id;
    select.append(option);
  });

  if (previousValue) {
    select.value = previousValue;
  }
}

async function handleSaveResult(event) {
  event.preventDefault();

  const button = $("saveResultButton");
  setButtonLoading(button, true, "保存中...");

  const eventId = $("resultEvent").value;
  const selectedEvent = eventsCache.find((item) => item.id === eventId);

  const resultData = {
    id: $("resultId").value.trim(),
    eventId,
    eventName: selectedEvent?.eventName || "",
    rank: $("resultRank").value.trim(),
    teamName: $("resultTeam").value.trim(),
    playerName: $("resultPlayer").value.trim(),
    notes: $("resultNotes").value.trim()
  };

  try {
    await apiRequest("saveResult", { result: resultData });

    closeResultForm();
    await loadDashboard();

    showGlobalMessage("大会結果を保存しました。", "success");
  } catch (error) {
    showGlobalMessage(error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
}

async function deleteResult(id, name) {
  if (!window.confirm(`「${name}」の結果を削除しますか？`)) return;

  try {
    await apiRequest("deleteResult", { id });
    await loadDashboard();
    showGlobalMessage("大会結果を削除しました。", "success");
  } catch (error) {
    showGlobalMessage(error.message, "error");
  }
}

function renderResults() {
  const container = $("resultsList");
  container.replaceChildren();

  if (!resultsCache.length) {
    container.innerHTML =
      '<div class="empty-state">大会結果はまだ登録されていません。</div>';
    return;
  }

  resultsCache.forEach((item) => {
    const card = document.createElement("article");
    card.className = "data-card";

    const main = document.createElement("div");
    main.className = "data-card-main";

    const title = document.createElement("h3");
    title.textContent =
      `${item.rank || "順位未設定"}｜${item.eventName || "大会名未設定"}`;

    const team = document.createElement("p");
    team.textContent =
      "チーム： " + (item.teamName || "未設定");

    const player = document.createElement("p");
    player.textContent =
      "プレイヤー： " + (item.playerName || "未設定");

    const notes = document.createElement("p");
    notes.textContent = item.notes || "";

    main.append(title, team, player, notes);

    const actions = document.createElement("div");
    actions.className = "data-card-actions";

    actions.append(
      makeButton("編集", "button button-outline button-small", () => {
        openResultForm(item);
      }),
      makeButton("削除", "button button-danger button-small", () => {
        deleteResult(item.id, item.eventName || "大会結果");
      })
    );

    card.append(main, actions);
    container.append(card);
  });
}

/* =========================================================
   管理者管理：最高管理者専用
========================================================= */

async function loadAdmins() {
  if (!isSuperAdminRole(currentAdmin?.role)) {
    showGlobalMessage("管理者管理は最高管理者のみ利用できます。", "error");
    return;
  }

  const container = $("adminsList");
  container.replaceChildren();

  const loading = document.createElement("div");
  loading.className = "empty-state";
  loading.textContent = "管理者一覧を読み込み中...";
  container.append(loading);

  try {
    const result = await apiRequest("listAdmins");
    const data = unwrapData(result);

    adminsCache = Array.isArray(data)
      ? data
      : Array.isArray(data.admins)
        ? data.admins
        : [];

    renderAdmins();
  } catch (error) {
    container.replaceChildren();

    const message = document.createElement("div");
    message.className = "empty-state";
    message.textContent = error.message;
    container.append(message);
  }
}

async function handleCreateAdmin(event) {
  event.preventDefault();

  if (!isSuperAdminRole(currentAdmin?.role)) {
    showGlobalMessage("最高管理者の権限が必要です。", "error");
    return;
  }

  const adminId = $("newAdminId").value.trim();
  const password = $("newAdminPassword").value;
  const role = $("newAdminRole").value;

  if (password.length < 12) {
    showGlobalMessage("パスワードは12文字以上にしてください。", "error");
    return;
  }

  const button = $("createAdminButton");
  setButtonLoading(button, true, "登録中...");

  try {
    await apiRequest("createAdmin", {
      adminId,
      password,
      role
    });

    $("adminForm").reset();
    await loadAdmins();

    showGlobalMessage("管理者アカウントを追加しました。", "success");
  } catch (error) {
    showGlobalMessage(error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
}

function renderAdmins() {
  const container = $("adminsList");
  container.replaceChildren();

  if (!adminsCache.length) {
    container.innerHTML =
      '<div class="empty-state">管理者が登録されていません。</div>';
    return;
  }

  adminsCache.forEach((admin) => {
    const id = admin.adminId || admin.id || "";
    const role = admin.role || "権限未設定";
    const active =
      admin.active === true ||
      String(admin.active).toLowerCase() === "true";

    const card = document.createElement("article");
    card.className = "data-card";

    const main = document.createElement("div");
    main.className = "data-card-main";

    const title = document.createElement("h3");
    title.textContent = id;

    const roleText = document.createElement("p");
    roleText.textContent = "権限： " + role;

    const status = document.createElement("p");
    status.textContent = "状態： " + (active ? "有効" : "停止中");

    main.append(title, roleText, status);

    const actions = document.createElement("div");
    actions.className = "data-card-actions";

    const toggleButton = makeButton(
      active ? "利用停止" : "利用再開",
      active
        ? "button button-danger button-small"
        : "button button-outline button-small",
      () => toggleAdmin(id, !active)
    );

    const resetButton = makeButton(
      "PW再設定",
      "button button-outline button-small",
      () => resetAdminPassword(id)
    );

    actions.append(toggleButton, resetButton);
    card.append(main, actions);
    container.append(card);
  });
}

async function toggleAdmin(adminId, active) {
  if (!isSuperAdminRole(currentAdmin?.role)) return;

  const actionText = active ? "利用再開" : "利用停止";

  if (!window.confirm(`${adminId} のアカウントを${actionText}しますか？`)) {
    return;
  }

  try {
    await apiRequest("setAdminActive", { adminId, active });
    await loadAdmins();
    showGlobalMessage(`管理者の${actionText}を実行しました。`, "success");
  } catch (error) {
    showGlobalMessage(error.message, "error");
  }
}

async function resetAdminPassword(adminId) {
  if (!isSuperAdminRole(currentAdmin?.role)) return;

  const password = window.prompt(
    `${adminId} の新しい初期パスワードを入力してください。\n12文字以上を推奨します。`
  );

  if (password === null) return;

  if (password.length < 12) {
    showGlobalMessage("パスワードは12文字以上にしてください。", "error");
    return;
  }

  if (!window.confirm(`${adminId} のパスワードを再設定しますか？`)) {
    return;
  }

  try {
    await apiRequest("resetAdminPassword", {
      adminId,
      newPassword: password
    });

    showGlobalMessage(
      "パスワードを再設定しました。新しいパスワードを安全な方法で本人に伝えてください。",
      "success"
    );
  } catch (error) {
    showGlobalMessage(error.message, "error");
  }
}

/* =========================================================
   自分のパスワード変更
========================================================= */

async function handleChangePassword(event) {
  event.preventDefault();

  const oldPassword = $("oldPassword").value;
  const newPassword = $("newPassword").value;
  const confirmPassword = $("confirmPassword").value;

  if (newPassword.length < 12) {
    showGlobalMessage("新しいパスワードは12文字以上にしてください。", "error");
    return;
  }

  if (newPassword !== confirmPassword) {
    showGlobalMessage("新しいパスワードが一致しません。", "error");
    return;
  }

  if (oldPassword === newPassword) {
    showGlobalMessage("現在と異なるパスワードを設定してください。", "error");
    return;
  }

  const button = $("changePasswordButton");
  setButtonLoading(button, true, "変更中...");

  try {
    await apiRequest("changePassword", {
      oldPassword,
      newPassword
    });

    $("passwordForm").reset();

    showGlobalMessage(
      "パスワードを変更しました。必要に応じて再ログインしてください。",
      "success"
    );
  } catch (error) {
    showGlobalMessage(error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
}

/* =========================================================
   共通関数
========================================================= */

function setMessage(element, text, type = "") {
  if (!element) return;

  element.textContent = text;
  element.className = "message";

  if (type) {
    element.classList.add(type);
  }
}

function showGlobalMessage(text, type = "") {
  setMessage($("globalMessage"), text, type);
}

function setButtonLoading(button, loading, text = "処理中...") {
  if (!button) return;

  if (loading) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = text;
  } else {
    button.disabled = false;

    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
}

function makeButton(label, className, callback) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", callback);
  return button;
}

function safeClass(value) {
  return String(value || "draft").toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

function statusLabel(status) {
  const labels = {
    draft: "下書き",
    upcoming: "開催予定",
    open: "応募受付中",
    ongoing: "開催中",
    completed: "終了"
  };

  return labels[status] || status || "未設定";
}

function toDateInput(value) {
  if (!value) return "";

  const text = String(value);

  // YYYY-MM-DD形式ならそのまま使用
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
