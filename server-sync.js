(() => {
  const PREFIX = "sellerflow_v2_";
  const STATE_KEYS = {
    orders: "orders",
    products: "products",
    suppliers: "suppliers",
    invoices: "invoices",
    purchaseBatches: "purchase_batches",
    purchaseDispatches: "purchase_dispatches",
    inquiries: "cs_inquiries",
    returnCases: "cs_returns",
    csLogs: "cs_logs",
    invoiceLogs: "invoice_logs",
    activityLogs: "activity_logs",
    notifications: "notifications",
    marketingLogs: "marketing_logs",
    settings: "settings",
  };

  const TRACKED_LOCAL_KEYS = new Set(
    Object.values(STATE_KEYS).map((key) => PREFIX + key)
  );

  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;

  const hadStateAtBoot = [...TRACKED_LOCAL_KEYS].some(
    (key) => localStorage.getItem(key) !== null
  );

  let restoreCheckPending = !hadStateAtBoot;
  let syncEnabled = hadStateAtBoot;
  let saveTimer = null;
  let authPromptOpen = false;
  let lastSavedJson = "";

  function readJson(localKey, fallback) {
    const raw = localStorage.getItem(PREFIX + localKey);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function snapshot() {
    const returns = readJson(STATE_KEYS.returnCases, []).map((item) => ({
      ...item,
      evidenceImages: [],
    }));

    const settings = readJson(STATE_KEYS.settings, {});

    return {
      version: Number(settings?.dataVersion || 7),
      exportedAt: new Date().toISOString(),
      orders: readJson(STATE_KEYS.orders, []),
      products: readJson(STATE_KEYS.products, []),
      suppliers: readJson(STATE_KEYS.suppliers, []),
      invoices: readJson(STATE_KEYS.invoices, []),
      purchaseBatches: readJson(STATE_KEYS.purchaseBatches, []),
      purchaseDispatches: readJson(STATE_KEYS.purchaseDispatches, []),
      inquiries: readJson(STATE_KEYS.inquiries, []),
      returnCases: returns,
      csLogs: readJson(STATE_KEYS.csLogs, []),
      invoiceLogs: readJson(STATE_KEYS.invoiceLogs, []),
      activityLogs: readJson(STATE_KEYS.activityLogs, []),
      notifications: readJson(STATE_KEYS.notifications, []),
      marketingLogs: readJson(STATE_KEYS.marketingLogs, []),
      settings,
    };
  }

  async function login() {
    if (authPromptOpen) return false;
    authPromptOpen = true;
    try {
      const password = window.prompt(
        "SellerFlow 서버 백업 관리자 비밀번호를 입력하세요.\n12시간 동안 다시 묻지 않습니다."
      );
      if (!password) return false;

      const response = await fetch("/api/auth-login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      let data = {};
      try {
        data = await response.json();
      } catch {}

      if (!response.ok || !data?.ok) {
        window.alert(data?.message || "서버 백업 잠금 해제 실패");
        return false;
      }
      return true;
    } finally {
      authPromptOpen = false;
    }
  }

  async function apiRequest(method, body = null, retried = false) {
    const options = {
      method,
      credentials: "same-origin",
    };

    if (body) {
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify(body);
    }

    const response = await fetch("/api/state", options);

    let data = {};
    try {
      data = await response.json();
    } catch {}

    if (
      response.status === 401 &&
      data?.code === "AUTH_REQUIRED" &&
      !retried
    ) {
      const unlocked = await login();
      if (unlocked) return apiRequest(method, body, true);
    }

    if (!response.ok || data?.ok === false) {
      const error = new Error(
        data?.message || `서버 백업 오류 (${response.status})`
      );
      error.code = data?.code || "SERVER_SYNC_FAILED";
      throw error;
    }

    return data;
  }

  async function saveNow() {
    if (!syncEnabled || restoreCheckPending) return false;

    const data = snapshot();
    const serialized = JSON.stringify(data);

    if (serialized === lastSavedJson) return true;

    const result = await apiRequest("PUT", {
      data,
      version: Number(data.version || 7),
    });

    lastSavedJson = serialized;

    originalSetItem.call(
      localStorage,
      PREFIX + "server_last_sync",
      result.updatedAt || new Date().toISOString()
    );

    return true;
  }

  function scheduleSave() {
    if (!syncEnabled || restoreCheckPending) return;
    clearTimeout(saveTimer);

    saveTimer = setTimeout(() => {
      saveNow().catch((error) => {
        console.warn(
          "SellerFlow server backup skipped:",
          error?.code || error?.message || error
        );
      });
    }, 4000);
  }

  function restoreState(data, updatedAt = "") {
    for (const [stateKey, localKey] of Object.entries(STATE_KEYS)) {
      if (!(stateKey in data)) continue;

      originalSetItem.call(
        localStorage,
        PREFIX + localKey,
        JSON.stringify(data[stateKey])
      );
    }

    if (updatedAt) {
      originalSetItem.call(
        localStorage,
        PREFIX + "server_last_sync",
        updatedAt
      );
    }
  }

  async function restoreNow({ force = false } = {}) {
    const result = await apiRequest("GET");

    if (!result.exists || !result.state) {
      if (force) window.alert("서버에 저장된 백업이 없습니다.");
      return false;
    }

    if (
      force &&
      !window.confirm(
        "서버 백업으로 현재 브라우저 데이터를 복구할까요?\n현재 브라우저 데이터가 서버 백업으로 교체됩니다."
      )
    ) {
      return false;
    }

    restoreState(result.state, result.updatedAt || "");
    window.location.reload();
    return true;
  }

  Storage.prototype.setItem = function (key, value) {
    originalSetItem.call(this, key, value);

    if (this === localStorage && TRACKED_LOCAL_KEYS.has(String(key))) {
      scheduleSave();
    }
  };

  Storage.prototype.removeItem = function (key) {
    originalRemoveItem.call(this, key);

    if (this === localStorage && TRACKED_LOCAL_KEYS.has(String(key))) {
      scheduleSave();
    }
  };

  window.SellerFlowServerSync = {
    saveNow: () => saveNow(),
    restoreNow: () => restoreNow({ force: true }),
    getLastSyncAt: () =>
      localStorage.getItem(PREFIX + "server_last_sync") || "",
  };

  async function boot() {
    if (hadStateAtBoot) {
      syncEnabled = true;
      restoreCheckPending = false;
      scheduleSave();
      return;
    }

    try {
      const result = await apiRequest("GET");

      if (result.exists && result.state) {
        restoreState(result.state, result.updatedAt || "");
        window.location.reload();
        return;
      }

      // 서버에도 백업이 없다면 현재 앱의 초기 데이터를 첫 서버 백업으로 사용.
      syncEnabled = true;
      restoreCheckPending = false;
      scheduleSave();
    } catch (error) {
      // 빈 브라우저 상태에서 서버 백업 확인에 실패하면
      // 기본 데모 데이터가 기존 서버 백업을 덮어쓰지 않도록 자동 동기화를 중지.
      syncEnabled = false;
      restoreCheckPending = false;
      console.warn(
        "SellerFlow server restore check failed; autosave disabled for safety:",
        error?.code || error?.message || error
      );
    }
  }

  boot();
})();
