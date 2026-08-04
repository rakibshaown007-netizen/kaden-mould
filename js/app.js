/* ==================================================================
   Kadena Mould Tracker Pro — vanilla HTML/CSS/JS build
   No framework, no build step. All data stays private on this
   device only (browser localStorage). Nothing is shared with
   anyone else, and nothing requires an internet connection after
   the first page load.
   ================================================================== */

(function () {
  "use strict";

  /* ---------------------------------------------------------------- */
  /* Constants                                                        */
  /* ---------------------------------------------------------------- */

  const ITEM_TYPES = ["Snap Button", "Logo", "TPR", "Rubber Patch", "Others"];
  const STATUS = {
    IN_FLOOR: "In My Floor",
    PENDING: "Pending",
    REPAIR: "Repair",
    MISSING: "Missing",
    ARCHIVE: "Archive",
  };
  const MY_FLOOR = "My Floor";

  const STATUS_COLOR = {
    [STATUS.IN_FLOOR]: { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
    [STATUS.PENDING]: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
    [STATUS.REPAIR]: { bg: "bg-purple-100 dark:bg-purple-900/40", text: "text-purple-700 dark:text-purple-300", dot: "bg-purple-500" },
    [STATUS.MISSING]: { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300", dot: "bg-red-500" },
    [STATUS.ARCHIVE]: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-400" },
  };

  const COMPANY = {
    name: "Kadena Sportswear Limited",
    address: "Comilla EPZ, Cumilla",
    supervisor: "Md. Jalal Hossain (Member)",
    phone: "01326953236",
    version: "1.0.0",
  };

  const STORAGE_KEYS = { moulds: "kmt_moulds", movements: "kmt_movements", theme: "kmt_theme" };

  const NAV_ITEMS = [
    { key: "dashboard", label: "Dashboard", icon: "layout-dashboard" },
    { key: "moulds", label: "Moulds", icon: "list-checks" },
    { key: "transfer", label: "Transfer", icon: "arrow-left-right" },
    { key: "pending", label: "Pending", icon: "clock" },
    { key: "profile", label: "Profile", icon: "user" },
  ];

  /* ---------------------------------------------------------------- */
  /* Helpers                                                           */
  /* ---------------------------------------------------------------- */

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function escapeHtml(str) {
    if (str === undefined || str === null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }
  function fmtDateTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  function daysBetween(iso) {
    const then = new Date(iso).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((now - then) / (1000 * 60 * 60 * 24)));
  }

  function statusBadgeHtml(status, small) {
    const c = STATUS_COLOR[status] || STATUS_COLOR[STATUS.IN_FLOOR];
    const pad = small ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs";
    return `<span class="inline-flex items-center gap-1.5 rounded-full font-semibold ${c.bg} ${c.text} ${pad}">
      <span class="w-1.5 h-1.5 rounded-full ${c.dot}"></span>${escapeHtml(status)}
    </span>`;
  }

  function icon(name, cls) {
    return `<i data-lucide="${name}" class="${cls || ""}"></i>`;
  }

  /* ---------------------------------------------------------------- */
  /* State                                                             */
  /* ---------------------------------------------------------------- */

  const state = {
    moulds: [],
    movements: [],
    dark: false,
    tab: "dashboard",
    modal: null, // { type: 'addEdit'|'details'|'delete'|'restoreConfirm', ...payload }
    toast: null,
    query: "",
    statusFilter: "",
    typeFilter: "",
    sortBy: "Newest",
    showFilters: false,
    dashboardThreshold: 7,
    transferMode: null, // null | 'send' | 'receive'
    pendingFile: null,
  };

  /* ---------------------------------------------------------------- */
  /* Persistence (private to this device/browser only)                */
  /* ---------------------------------------------------------------- */

  function loadState() {
    try { state.moulds = JSON.parse(localStorage.getItem(STORAGE_KEYS.moulds)) || []; } catch (e) { state.moulds = []; }
    try { state.movements = JSON.parse(localStorage.getItem(STORAGE_KEYS.movements)) || []; } catch (e) { state.movements = []; }
    state.dark = localStorage.getItem(STORAGE_KEYS.theme) === "dark";
  }
  function saveMoulds() { try { localStorage.setItem(STORAGE_KEYS.moulds, JSON.stringify(state.moulds)); } catch (e) {} }
  function saveMovements() { try { localStorage.setItem(STORAGE_KEYS.movements, JSON.stringify(state.movements)); } catch (e) {} }
  function saveTheme() { try { localStorage.setItem(STORAGE_KEYS.theme, state.dark ? "dark" : "light"); } catch (e) {} }

  /* ---------------------------------------------------------------- */
  /* Derived collections                                               */
  /* ---------------------------------------------------------------- */

  function inFloorList() { return state.moulds.filter((m) => m.status === STATUS.IN_FLOOR); }
  function pendingList() { return state.moulds.filter((m) => m.status === STATUS.PENDING); }
  function repairList() { return state.moulds.filter((m) => m.status === STATUS.REPAIR); }
  function missingList() { return state.moulds.filter((m) => m.status === STATUS.MISSING); }
  function outsideList() { return state.moulds.filter((m) => m.status !== STATUS.IN_FLOOR && m.status !== STATUS.ARCHIVE); }

  /* ---------------------------------------------------------------- */
  /* CRUD                                                              */
  /* ---------------------------------------------------------------- */

  function nameExists(name, excludeId) {
    const n = name.trim().toLowerCase();
    return state.moulds.some((m) => m.mouldName.trim().toLowerCase() === n && m.id !== excludeId);
  }

  function addMould(data) {
    if (nameExists(data.mouldName)) {
      notify("A mould with this name already exists. Duplicate names are not allowed.", "error");
      return false;
    }
    const now = new Date().toISOString();
    const next = state.moulds.length + 1;
    state.moulds.unshift({
      id: uid(),
      uniqueId: `KMT-${String(next).padStart(4, "0")}`,
      buyerName: data.buyerName.trim(),
      styleName: data.styleName.trim(),
      itemType: data.itemType,
      mouldName: data.mouldName.trim(),
      partA: (data.partA || "").trim(),
      partB: (data.partB || "").trim(),
      partC: (data.partC || "").trim(),
      partD: (data.partD || "").trim(),
      status: STATUS.IN_FLOOR,
      floor: MY_FLOOR,
      dateCreated: now,
      lastUpdated: now,
      remarks: (data.remarks || "").trim(),
      favorite: false,
    });
    saveMoulds();
    notify("Mould created successfully.");
    return true;
  }

  function editMould(id, data) {
    if (nameExists(data.mouldName, id)) {
      notify("A mould with this name already exists. Duplicate names are not allowed.", "error");
      return false;
    }
    const m = state.moulds.find((x) => x.id === id);
    if (!m) return false;
    Object.assign(m, {
      buyerName: data.buyerName.trim(),
      styleName: data.styleName.trim(),
      itemType: data.itemType,
      mouldName: data.mouldName.trim(),
      partA: (data.partA || "").trim(),
      partB: (data.partB || "").trim(),
      partC: (data.partC || "").trim(),
      partD: (data.partD || "").trim(),
      remarks: (data.remarks || "").trim(),
      lastUpdated: new Date().toISOString(),
    });
    saveMoulds();
    notify("Mould updated successfully.");
    return true;
  }

  function deleteMould(id) {
    state.moulds = state.moulds.filter((m) => m.id !== id);
    state.movements = state.movements.filter((mv) => mv.mouldId !== id);
    saveMoulds();
    saveMovements();
    notify("Mould deleted.");
  }

  function toggleFavorite(id) {
    const m = state.moulds.find((x) => x.id === id);
    if (m) { m.favorite = !m.favorite; saveMoulds(); }
  }

  function setMouldStatus(id, status) {
    const m = state.moulds.find((x) => x.id === id);
    if (m) { m.status = status; m.lastUpdated = new Date().toISOString(); saveMoulds(); notify(`Status updated to ${status}.`); }
  }

  function sendMould(id, destinationFloor, remarks) {
    const now = new Date().toISOString();
    state.movements.unshift({ id: uid(), mouldId: id, type: "Send", fromFloor: MY_FLOOR, toFloor: destinationFloor, dateTime: now, remarks: remarks || "" });
    const m = state.moulds.find((x) => x.id === id);
    if (m) { m.status = STATUS.PENDING; m.floor = destinationFloor; m.lastUpdated = now; }
    saveMoulds(); saveMovements();
    notify("Mould sent successfully.");
  }

  function receiveMould(id, sourceFloor, remarks) {
    const now = new Date().toISOString();
    state.movements.unshift({ id: uid(), mouldId: id, type: "Receive", fromFloor: sourceFloor, toFloor: MY_FLOOR, dateTime: now, remarks: remarks || "" });
    const m = state.moulds.find((x) => x.id === id);
    if (m) { m.status = STATUS.IN_FLOOR; m.floor = MY_FLOOR; m.lastUpdated = now; }
    saveMoulds(); saveMovements();
    notify("Mould received successfully.");
  }

  /* ---------------------------------------------------------------- */
  /* Backup / restore / export                                        */
  /* ---------------------------------------------------------------- */

  function exportBackup() {
    const payload = { moulds: state.moulds, movements: state.movements, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `kadena_backup_${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    notify("Backup downloaded.");
  }

  function importBackupFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        state.moulds = data.moulds || [];
        state.movements = data.movements || [];
        saveMoulds(); saveMovements();
        notify("Backup restored successfully.");
        renderApp();
      } catch (err) {
        notify("Invalid backup file.", "error");
      }
    };
    reader.readAsText(file);
  }

  function exportCsv() {
    const headers = ["Unique ID", "Mould Name", "Buyer", "Style", "Item Type", "Status", "Floor", "Date Created"];
    const rows = state.moulds.map((m) => [m.uniqueId, m.mouldName, m.buyerName, m.styleName, m.itemType, m.status, m.floor, fmtDate(m.dateCreated)]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `mould_report_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    notify("CSV report downloaded.");
  }

  /* ---------------------------------------------------------------- */
  /* Toast                                                             */
  /* ---------------------------------------------------------------- */

  let toastTimer = null;
  function notify(message, type) {
    state.toast = { message, type: type || "success" };
    renderToast();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { state.toast = null; renderToast(); }, 2600);
  }
  function renderToast() {
    const el = document.getElementById("toast-root");
    if (!el) return;
    if (!state.toast) { el.innerHTML = ""; return; }
    const bg = state.toast.type === "error" ? "bg-red-500" : "bg-emerald-600";
    el.innerHTML = `<div class="kmt-toast fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white ${bg}">${escapeHtml(state.toast.message)}</div>`;
  }

  /* ================================================================ */
  /* RENDERING                                                         */
  /* ================================================================ */

  function renderApp() {
    document.documentElement.classList.toggle("dark", state.dark);
    const root = document.getElementById("app");
    root.innerHTML = `
      ${renderHeader()}
      <main class="max-w-5xl mx-auto px-4 sm:px-6 py-5 pb-24 sm:pb-10">
        <div id="tab-content">${renderTabContent()}</div>
      </main>
      ${renderMobileNav()}
      <div id="modal-root">${renderModal()}</div>
      <div id="toast-root"></div>
    `;
    renderToast();
    lucide.createIcons();
  }

  function renderHeader() {
    return `
      <header class="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-100 dark:border-slate-800">
        <div class="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
              ${icon("factory", "w-5 h-5 text-white")}
            </div>
            <div>
              <div class="font-extrabold text-sm leading-none">Kadena Mould Tracker</div>
              <div class="text-[11px] text-slate-400 leading-none mt-0.5">Pro • Offline Web App</div>
            </div>
          </div>
          <button data-action="toggle-dark" class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
            ${icon(state.dark ? "sun" : "moon", "w-[18px] h-[18px]")}
          </button>
        </div>
        <nav class="hidden sm:flex max-w-5xl mx-auto px-6 gap-1 pb-2">
          ${NAV_ITEMS.map((item) => `
            <button data-action="nav-tab" data-tab="${item.key}" class="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition ${state.tab === item.key ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}">
              ${icon(item.icon, "w-4 h-4")}${item.label}
            </button>`).join("")}
        </nav>
      </header>`;
  }

  function renderMobileNav() {
    return `
      <nav class="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-around py-2">
        ${NAV_ITEMS.map((item) => {
          const active = state.tab === item.key;
          return `<button data-action="nav-tab" data-tab="${item.key}" class="flex flex-col items-center gap-0.5 px-2 py-1">
            ${icon(item.icon, `w-5 h-5 ${active ? "text-indigo-600" : "text-slate-400"}`)}
            <span class="text-[10px] font-medium ${active ? "text-indigo-600" : "text-slate-400"}">${item.label}</span>
          </button>`;
        }).join("")}
      </nav>`;
  }

  function renderTabContent() {
    switch (state.tab) {
      case "dashboard": return renderDashboard();
      case "moulds": return renderMouldList();
      case "transfer": return renderTransfer();
      case "pending": return renderPending();
      case "profile": return renderProfile();
      default: return "";
    }
  }

  /* -------------------------- Dashboard --------------------------- */

  function renderDashboard() {
    const moulds = state.moulds;
    const inFloor = inFloorList(), pend = pendingList(), rep = repairList(), miss = missingList();
    return `
      <div class="space-y-6">
        <div>
          <h2 class="text-lg font-extrabold mb-3">Overview</h2>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            ${statCard("Total Mould", moulds.length, "list-checks", "indigo", "moulds")}
            ${statCard("Currently In My Floor", inFloor.length, "factory", "emerald", "moulds")}
            ${statCard("Pending", pend.length, "clock", "amber", "pending")}
            ${statCard("Repair / Missing", rep.length + miss.length, "wrench", "purple", "moulds")}
          </div>
        </div>
        ${renderAlertsCard()}
        ${renderRecentActivityCard()}
      </div>`;
  }

  function statCard(label, value, iconName, color, navTarget) {
    const colorMap = {
      indigo: "from-indigo-50 to-white dark:from-indigo-950 dark:to-slate-900 border-indigo-100 dark:border-indigo-900 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300",
      emerald: "from-emerald-50 to-white dark:from-emerald-950 dark:to-slate-900 border-emerald-100 dark:border-emerald-900 bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300",
      amber: "from-amber-50 to-white dark:from-amber-950 dark:to-slate-900 border-amber-100 dark:border-amber-900 bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300",
      purple: "from-purple-50 to-white dark:from-purple-950 dark:to-slate-900 border-purple-100 dark:border-purple-900 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300",
    };
    const parts = colorMap[color].split(" border-");
    const grad = parts[0];
    const rest = "border-" + parts[1];
    const restParts = rest.split(" bg-");
    const border = restParts[0];
    const iconWrap = "bg-" + restParts[1].split(" text-")[0];
    const iconText = "text-" + restParts[1].split(" text-")[1];
    return `
      <button data-action="nav-tab" data-tab="${navTarget}" class="text-left p-4 rounded-2xl border transition hover:shadow-md active:scale-[0.98] bg-gradient-to-br ${grad} ${border}">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${iconWrap}">
          ${icon(iconName, `w-5 h-5 ${iconText}`)}
        </div>
        <div class="text-2xl font-extrabold text-slate-800 dark:text-white">${value}</div>
        <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${label}</div>
      </button>`;
  }

  function renderAlertsCard() {
    const threshold = state.dashboardThreshold;
    const alertMoulds = state.moulds.filter((m) => m.status !== STATUS.IN_FLOOR && m.status !== STATUS.ARCHIVE && daysBetween(m.lastUpdated) >= threshold);
    return `
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2 font-bold">${icon("alert-triangle", "w-[18px] h-[18px] text-red-500")}Alerts</div>
          <select data-action="set-threshold" class="text-xs font-semibold border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg px-2 py-1">
            <option value="7" ${threshold === 7 ? "selected" : ""}>7 days</option>
            <option value="15" ${threshold === 15 ? "selected" : ""}>15 days</option>
            <option value="30" ${threshold === 30 ? "selected" : ""}>30 days</option>
          </select>
        </div>
        ${alertMoulds.length === 0
          ? `<p class="text-sm text-slate-400">No moulds outside your floor for ${threshold}+ days.</p>`
          : `<div class="space-y-2">${alertMoulds.slice(0, 6).map((m) => `
              <button data-action="open-details" data-id="${m.id}" class="w-full flex items-center justify-between text-left text-sm py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg px-2">
                <span class="flex items-center gap-2 truncate">
                  ${icon("alert-circle", "w-4 h-4 text-red-500 shrink-0")}
                  <span class="font-semibold truncate">${escapeHtml(m.mouldName)}</span>
                  <span class="text-slate-400 truncate">• ${escapeHtml(m.floor)}</span>
                </span>
                <span class="text-xs font-semibold text-red-500 whitespace-nowrap">${daysBetween(m.lastUpdated)}d outside</span>
              </button>`).join("")}</div>`}
      </div>`;
  }

  function renderRecentActivityCard() {
    const movements = state.movements;
    return `
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
        <div class="flex items-center gap-2 font-bold mb-3">${icon("clock", "w-[18px] h-[18px] text-teal-500")}Recent Activity</div>
        ${movements.length === 0
          ? `<p class="text-sm text-slate-400">No movements yet.</p>`
          : `<div class="space-y-3">${movements.slice(0, 8).map((mv) => {
              const mould = state.moulds.find((m) => m.id === mv.mouldId);
              const isReceive = mv.type === "Receive";
              return `
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isReceive ? "bg-emerald-100 dark:bg-emerald-900" : "bg-amber-100 dark:bg-amber-900"}">
                  ${icon(isReceive ? "arrow-down-left" : "arrow-up-right", `w-4 h-4 ${isReceive ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"}`)}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-semibold truncate">${escapeHtml(mould ? mould.mouldName : "Deleted mould")}</div>
                  <div class="text-xs text-slate-400">${isReceive ? `Received from ${escapeHtml(mv.fromFloor)}` : `Sent to ${escapeHtml(mv.toFloor)}`} • ${fmtDateTime(mv.dateTime)}</div>
                </div>
              </div>`;
            }).join("")}</div>`}
      </div>`;
  }

  /* -------------------------- Mould List --------------------------- */

  function filteredMoulds() {
    let list = [...state.moulds];
    if (state.query.trim()) {
      const q = state.query.trim().toLowerCase();
      list = list.filter((m) => m.mouldName.toLowerCase().includes(q) || m.buyerName.toLowerCase().includes(q) || m.styleName.toLowerCase().includes(q) || m.uniqueId.toLowerCase().includes(q));
    }
    if (state.statusFilter) list = list.filter((m) => m.status === state.statusFilter);
    if (state.typeFilter) list = list.filter((m) => m.itemType === state.typeFilter);
    switch (state.sortBy) {
      case "Oldest": list.sort((a, b) => new Date(a.dateCreated) - new Date(b.dateCreated)); break;
      case "Buyer": list.sort((a, b) => a.buyerName.localeCompare(b.buyerName)); break;
      case "Style": list.sort((a, b) => a.styleName.localeCompare(b.styleName)); break;
      default: list.sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated));
    }
    return list;
  }

  function renderMouldList() {
    return `
      <div>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-extrabold">Mould List</h2>
          <button data-action="open-add" class="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700">
            ${icon("plus", "w-4 h-4")}Add Mould
          </button>
        </div>
        <div class="flex gap-2 mb-4">
          <div class="relative flex-1">
            ${icon("search", "w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2")}
            <input id="search-input" data-action="search-input" value="${escapeHtml(state.query)}" placeholder="Search by name, buyer, style, ID…"
              class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-400" />
          </div>
          <button data-action="toggle-filters" class="px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
            ${icon("sliders-horizontal", "w-[18px] h-[18px]")}
          </button>
        </div>
        ${state.showFilters ? renderFilterPanel() : ""}
        <div id="mould-results">${renderMouldResults()}</div>
      </div>`;
  }

  function renderFilterPanel() {
    return `
      <div class="grid grid-cols-3 gap-2 mb-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-3">
        <select data-action="filter-status" class="${selectCls()}">
          <option value="">All Status</option>
          ${Object.values(STATUS).map((s) => `<option value="${s}" ${state.statusFilter === s ? "selected" : ""}>${s}</option>`).join("")}
        </select>
        <select data-action="filter-type" class="${selectCls()}">
          <option value="">All Types</option>
          ${ITEM_TYPES.map((t) => `<option value="${t}" ${state.typeFilter === t ? "selected" : ""}>${t}</option>`).join("")}
        </select>
        <select data-action="filter-sort" class="${selectCls()}">
          ${["Newest", "Oldest", "Buyer", "Style"].map((s) => `<option value="${s}" ${state.sortBy === s ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </div>`;
  }
  function selectCls() {
    return "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-400";
  }

  function renderMouldResults() {
    const results = filteredMoulds();
    if (results.length === 0) {
      return `<div class="text-center py-16 text-slate-400">${icon("list-checks", "w-10 h-10 mx-auto mb-3 opacity-40")}<div>No moulds found.</div></div>`;
    }
    return `<div class="space-y-3">${results.map((m) => `
      <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 hover:shadow-sm transition">
        <div class="flex items-start justify-between gap-3">
          <button data-action="open-details" data-id="${m.id}" class="min-w-0 flex-1 text-left">
            <div class="flex items-center gap-1.5">
              <span class="font-bold truncate">${escapeHtml(m.mouldName)}</span>
              ${m.favorite ? icon("star", "w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0") : ""}
            </div>
            <div class="text-xs text-slate-400 truncate mt-0.5">${escapeHtml(m.buyerName)} • ${escapeHtml(m.styleName)}</div>
            <div class="mt-2">${statusBadgeHtml(m.status, true)}</div>
          </button>
          <div class="flex items-center gap-1 shrink-0">
            <button data-action="toggle-favorite" data-id="${m.id}" title="Favorite" class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">${icon("star", `w-4 h-4 ${m.favorite ? "text-amber-400 fill-amber-400" : "text-slate-400"}`)}</button>
            <button data-action="open-edit" data-id="${m.id}" title="Edit" class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">${icon("pencil", "w-4 h-4 text-slate-400")}</button>
            <button data-action="archive-mould" data-id="${m.id}" title="Archive" class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">${icon("archive", "w-4 h-4 text-slate-400")}</button>
            <button data-action="confirm-delete" data-id="${m.id}" title="Delete" class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">${icon("trash-2", "w-4 h-4 text-red-400")}</button>
          </div>
        </div>
      </div>`).join("")}</div>`;
  }

  function updateMouldResultsOnly() {
    const el = document.getElementById("mould-results");
    if (el) { el.innerHTML = renderMouldResults(); lucide.createIcons(); }
  }

  /* -------------------------- Add/Edit form ------------------------- */

  function renderMouldFormModal(mould) {
    const isEdit = !!mould;
    const v = (key) => escapeHtml(mould ? mould[key] : "");
    return `
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm kmt-modal-backdrop">
        <div class="kmt-modal-panel w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto shadow-2xl">
          <div class="sticky top-0 bg-white dark:bg-slate-900 flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 class="font-bold text-lg">${isEdit ? "Edit Mould" : "Add Mould"}</h3>
            <button data-action="close-modal" class="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">${icon("x", "w-5 h-5 text-slate-500")}</button>
          </div>
          <div class="p-5">
            <label class="block text-sm font-semibold mb-1.5">Buyer Name</label>
            <input id="f-buyer" value="${v("buyerName")}" class="${inputCls()} mb-4" />
            <label class="block text-sm font-semibold mb-1.5">Style Name</label>
            <input id="f-style" value="${v("styleName")}" class="${inputCls()} mb-4" />
            <label class="block text-sm font-semibold mb-1.5">Item Type</label>
            <select id="f-type" class="${inputCls()} mb-4">
              ${ITEM_TYPES.map((t) => `<option value="${t}" ${mould && mould.itemType === t ? "selected" : ""}>${t}</option>`).join("")}
            </select>
            <label class="block text-sm font-semibold mb-1.5">Mould Name</label>
            <input id="f-mouldname" value="${v("mouldName")}" class="${inputCls()} mb-1" />
            <p class="text-xs text-slate-400 mb-4">${isEdit ? "Must remain unique." : "Must be unique. Created only once."}</p>
            <div class="grid grid-cols-2 gap-3 mb-4">
              <div><label class="block text-sm font-semibold mb-1.5">Part A</label><input id="f-parta" value="${v("partA")}" class="${inputCls()}" /></div>
              <div><label class="block text-sm font-semibold mb-1.5">Part B</label><input id="f-partb" value="${v("partB")}" class="${inputCls()}" /></div>
              <div><label class="block text-sm font-semibold mb-1.5">Part C</label><input id="f-partc" value="${v("partC")}" class="${inputCls()}" /></div>
              <div><label class="block text-sm font-semibold mb-1.5">Part D</label><input id="f-partd" value="${v("partD")}" class="${inputCls()}" /></div>
            </div>
            <label class="block text-sm font-semibold mb-1.5">Remarks</label>
            <textarea id="f-remarks" rows="3" class="${inputCls()} mb-1">${v("remarks")}</textarea>
            <div id="form-error" class="text-sm text-red-500 mb-3 flex items-center gap-1.5 hidden">${icon("alert-circle", "w-4 h-4")}<span id="form-error-text"></span></div>
            <button data-action="submit-mould-form" data-editing-id="${mould ? mould.id : ""}" class="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 mt-2">
              ${isEdit ? "Save Changes" : "Save Mould"}
            </button>
          </div>
        </div>
      </div>`;
  }
  function inputCls() {
    return "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-400";
  }

  function submitMouldForm(editingId) {
    const data = {
      buyerName: document.getElementById("f-buyer").value,
      styleName: document.getElementById("f-style").value,
      itemType: document.getElementById("f-type").value,
      mouldName: document.getElementById("f-mouldname").value,
      partA: document.getElementById("f-parta").value,
      partB: document.getElementById("f-partb").value,
      partC: document.getElementById("f-partc").value,
      partD: document.getElementById("f-partd").value,
      remarks: document.getElementById("f-remarks").value,
    };
    if (!data.buyerName.trim() || !data.styleName.trim() || !data.mouldName.trim()) {
      const errBox = document.getElementById("form-error");
      document.getElementById("form-error-text").textContent = "Buyer Name, Style Name and Mould Name are required.";
      errBox.classList.remove("hidden");
      return;
    }
    const ok = editingId ? editMould(editingId, data) : addMould(data);
    if (ok) { state.modal = null; renderApp(); }
  }

  /* -------------------------- Details modal -------------------------- */

  function renderDetailsModal(id) {
    const m = state.moulds.find((x) => x.id === id);
    if (!m) return "";
    const history = state.movements.filter((mv) => mv.mouldId === id).sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
    return `
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm kmt-modal-backdrop">
        <div class="kmt-modal-panel w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto shadow-2xl">
          <div class="sticky top-0 bg-white dark:bg-slate-900 flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 class="font-bold text-lg truncate">${escapeHtml(m.mouldName)}</h3>
            <button data-action="close-modal" class="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">${icon("x", "w-5 h-5 text-slate-500")}</button>
          </div>
          <div class="p-5">
            <div class="flex items-center justify-between mb-4">
              ${statusBadgeHtml(m.status, false)}
              <div class="flex items-center gap-1">
                <button data-action="toggle-favorite" data-id="${m.id}" title="Favorite" class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">${icon("star", `w-[18px] h-[18px] ${m.favorite ? "text-amber-400 fill-amber-400" : "text-slate-400"}`)}</button>
                <button data-action="open-edit" data-id="${m.id}" title="Edit" class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">${icon("pencil", "w-[18px] h-[18px] text-slate-400")}</button>
                <button data-action="confirm-delete" data-id="${m.id}" title="Delete" class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">${icon("trash-2", "w-[18px] h-[18px] text-red-400")}</button>
              </div>
            </div>
            <div class="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 mb-4 space-y-2 text-sm">
              ${infoRow("Unique ID", m.uniqueId)}
              ${infoRow("Buyer Name", m.buyerName)}
              ${infoRow("Style Name", m.styleName)}
              ${infoRow("Item Type", m.itemType)}
              ${infoRow("Current Floor", m.floor)}
              ${m.partA ? infoRow("Part A", m.partA) : ""}
              ${m.partB ? infoRow("Part B", m.partB) : ""}
              ${m.partC ? infoRow("Part C", m.partC) : ""}
              ${m.partD ? infoRow("Part D", m.partD) : ""}
              ${infoRow("Date Created", fmtDate(m.dateCreated))}
              ${infoRow("Last Updated", fmtDateTime(m.lastUpdated))}
              ${m.remarks ? infoRow("Remarks", m.remarks) : ""}
            </div>
            <div class="flex gap-2 mb-6 flex-wrap">
              <button data-action="set-status" data-id="${m.id}" data-status="${STATUS.REPAIR}" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">Mark as Repair</button>
              <button data-action="set-status" data-id="${m.id}" data-status="${STATUS.MISSING}" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">Mark as Missing</button>
              <button data-action="set-status" data-id="${m.id}" data-status="${STATUS.ARCHIVE}" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">Archive</button>
            </div>
            <h4 class="font-bold text-sm mb-3">History Timeline</h4>
            ${history.length === 0 ? `<p class="text-sm text-slate-400">No movement history yet.</p>` : `
              <div>${history.map((mv, i) => `
                <div class="flex gap-3">
                  <div class="flex flex-col items-center">
                    <span class="w-3 h-3 rounded-full ${mv.type === "Receive" ? "bg-emerald-500" : "bg-amber-500"}"></span>
                    ${i < history.length - 1 ? `<span class="w-0.5 flex-1 bg-slate-200 dark:bg-slate-700"></span>` : ""}
                  </div>
                  <div class="pb-5 -mt-0.5">
                    <div class="text-sm font-semibold">${mv.type === "Receive" ? `Received from ${escapeHtml(mv.fromFloor)}` : `Sent to ${escapeHtml(mv.toFloor)}`}</div>
                    <div class="text-xs text-slate-400">${fmtDateTime(mv.dateTime)}</div>
                    ${mv.remarks ? `<div class="text-xs text-slate-500 mt-1">${escapeHtml(mv.remarks)}</div>` : ""}
                  </div>
                </div>`).join("")}</div>`}
          </div>
        </div>
      </div>`;
  }
  function infoRow(label, value) {
    return `<div class="flex justify-between gap-3"><span class="text-slate-400">${label}</span><span class="font-semibold text-right">${escapeHtml(value)}</span></div>`;
  }

  /* -------------------------- Delete confirm -------------------------- */

  function renderDeleteModal(id) {
    const m = state.moulds.find((x) => x.id === id);
    if (!m) return "";
    return `
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm kmt-modal-backdrop">
        <div class="kmt-modal-panel w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl">
          <div class="sticky top-0 bg-white dark:bg-slate-900 flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 class="font-bold text-lg">Delete Mould?</h3>
            <button data-action="close-modal" class="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">${icon("x", "w-5 h-5 text-slate-500")}</button>
          </div>
          <div class="p-5">
            <div class="flex items-start gap-3 mb-5">
              ${icon("alert-triangle", "w-8 h-8 text-red-500 shrink-0")}
              <p class="text-sm text-slate-600 dark:text-slate-300">This will permanently delete the mould <strong>${escapeHtml(m.mouldName)}</strong> and all of its movement history. This action cannot be undone.</p>
            </div>
            <div class="flex gap-3">
              <button data-action="close-modal" class="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-sm">Cancel</button>
              <button data-action="do-delete" data-id="${m.id}" class="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm">Delete</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  /* -------------------------- Transfer -------------------------- */

  function renderTransfer() {
    if (state.transferMode === "send") return renderSendForm();
    if (state.transferMode === "receive") return renderReceiveForm();
    return `
      <div>
        <h2 class="text-lg font-extrabold mb-4">Transfer</h2>
        <div class="space-y-4">
          ${actionCard("Send", "Send a mould from My Floor to another floor", "arrow-up-right", "amber", "send")}
          ${actionCard("Receive", "Receive a mould back into My Floor", "arrow-down-left", "emerald", "receive")}
        </div>
      </div>`;
  }
  function actionCard(title, subtitle, iconName, color, mode) {
    const colorMap = {
      amber: "from-amber-50 to-white dark:from-amber-950 dark:to-slate-900 border-amber-100 dark:border-amber-900|bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300",
      emerald: "from-emerald-50 to-white dark:from-emerald-950 dark:to-slate-900 border-emerald-100 dark:border-emerald-900|bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300",
    };
    const [grad, iconWrap] = colorMap[color].split("|");
    return `
      <button data-action="set-transfer-mode" data-mode="${mode}" class="w-full text-left p-5 rounded-2xl border bg-gradient-to-br ${grad} flex items-center gap-4 hover:shadow-md transition">
        <div class="w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${iconWrap}">${icon(iconName, "w-6 h-6")}</div>
        <div class="flex-1">
          <div class="font-extrabold text-lg">${title}</div>
          <div class="text-xs text-slate-500 dark:text-slate-400">${subtitle}</div>
        </div>
        ${icon("chevron-right", "w-5 h-5 text-slate-400")}
      </button>`;
  }

  function renderSendForm() {
    const moulds = inFloorList();
    return `
      <div>
        <button data-action="set-transfer-mode" data-mode="" class="flex items-center gap-1 text-sm font-semibold text-slate-500 mb-4">${icon("chevron-left", "w-4 h-4")}Back</button>
        <h2 class="text-lg font-extrabold mb-4">Send Mould</h2>
        <label class="block text-sm font-semibold mb-1.5">Select Mould</label>
        <select id="send-mould" class="${inputCls()} mb-1">
          <option value="">Choose a mould in My Floor</option>
          ${moulds.map((m) => `<option value="${m.id}">${escapeHtml(m.mouldName)} (${escapeHtml(m.buyerName)})</option>`).join("")}
        </select>
        ${moulds.length === 0 ? `<p class="text-xs text-slate-400 mb-3">No moulds currently in My Floor.</p>` : `<div class="mb-4"></div>`}
        <label class="block text-sm font-semibold mb-1.5 mt-3">Destination Floor</label>
        <input id="send-dest" placeholder="e.g. Floor-7, Cutting, Sewing Line 3" class="${inputCls()} mb-4" />
        <label class="block text-sm font-semibold mb-1.5">Date &amp; Time</label>
        <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-500 mb-4">
          ${icon("clock", "w-4 h-4")}${fmtDateTime(new Date().toISOString())}<span class="ml-auto text-xs">Auto</span>
        </div>
        <label class="block text-sm font-semibold mb-1.5">Remarks (optional)</label>
        <textarea id="send-remarks" rows="3" class="${inputCls()} mb-6"></textarea>
        <button data-action="submit-send" class="w-full py-3 rounded-xl bg-amber-500 text-white font-bold">Confirm Send</button>
      </div>`;
  }

  function renderReceiveForm() {
    const moulds = outsideList();
    return `
      <div>
        <button data-action="set-transfer-mode" data-mode="" class="flex items-center gap-1 text-sm font-semibold text-slate-500 mb-4">${icon("chevron-left", "w-4 h-4")}Back</button>
        <h2 class="text-lg font-extrabold mb-4">Receive Mould</h2>
        <label class="block text-sm font-semibold mb-1.5">Select Mould</label>
        <select id="receive-mould" data-action="receive-mould-change" class="${inputCls()} mb-1">
          <option value="">Choose a mould that is outside</option>
          ${moulds.map((m) => `<option value="${m.id}" data-floor="${escapeHtml(m.floor)}">${escapeHtml(m.mouldName)} (${escapeHtml(m.floor)})</option>`).join("")}
        </select>
        ${moulds.length === 0 ? `<p class="text-xs text-slate-400 mb-3">No moulds currently outside My Floor.</p>` : `<div class="mb-4"></div>`}
        <label class="block text-sm font-semibold mb-1.5 mt-3">Source Floor</label>
        <input id="receive-source" placeholder="e.g. Floor-4, Finishing" class="${inputCls()} mb-4" />
        <label class="block text-sm font-semibold mb-1.5">Date &amp; Time</label>
        <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-500 mb-4">
          ${icon("clock", "w-4 h-4")}${fmtDateTime(new Date().toISOString())}<span class="ml-auto text-xs">Auto</span>
        </div>
        <label class="block text-sm font-semibold mb-1.5">Remarks (optional)</label>
        <textarea id="receive-remarks" rows="3" class="${inputCls()} mb-6"></textarea>
        <button data-action="submit-receive" class="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold">Confirm Receive</button>
      </div>`;
  }

  /* -------------------------- Pending -------------------------- */

  function renderPending() {
    const sorted = outsideList().sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
    return `
      <div>
        <h2 class="text-lg font-extrabold mb-4">Pending</h2>
        ${sorted.length === 0
          ? `<div class="text-center py-16 text-slate-400">${icon("check", "w-10 h-10 mx-auto mb-3 opacity-40")}<div>All moulds are currently in My Floor.</div></div>`
          : `<div class="space-y-3">${sorted.map((m) => {
              const days = daysBetween(m.lastUpdated);
              return `
              <button data-action="open-details" data-id="${m.id}" class="w-full text-left bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-bold">${escapeHtml(m.mouldName)}</span>${statusBadgeHtml(m.status, true)}
                </div>
                <div class="grid grid-cols-2 gap-y-1 text-xs">
                  <span class="text-slate-400">Buyer</span><span class="font-semibold text-right">${escapeHtml(m.buyerName)}</span>
                  <span class="text-slate-400">Style</span><span class="font-semibold text-right">${escapeHtml(m.styleName)}</span>
                  <span class="text-slate-400">Current Floor</span><span class="font-semibold text-right">${escapeHtml(m.floor)}</span>
                  <span class="text-slate-400">Days Outside</span><span class="font-bold text-right ${days >= 15 ? "text-red-500" : "text-amber-500"}">${days} days</span>
                </div>
              </button>`;
            }).join("")}</div>`}
      </div>`;
  }

  /* -------------------------- Profile -------------------------- */

  function renderProfile() {
    const total = state.moulds.length;
    const inFloor = inFloorList().length, pend = pendingList().length, rep = repairList().length, miss = missingList().length;
    const archived = state.moulds.filter((m) => m.status === STATUS.ARCHIVE).length;
    return `
      <div class="space-y-5">
        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 text-center">
          <div class="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center mx-auto mb-3">${icon("factory", "w-7 h-7 text-white")}</div>
          <div class="font-extrabold text-lg">${COMPANY.name}</div>
          <div class="text-sm text-slate-400 flex items-center justify-center gap-1 mt-1">${icon("map-pin", "w-3.5 h-3.5")}${COMPANY.address}</div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
          ${profileRow("user", "Supervisor", COMPANY.supervisor)}
          ${profileRow("phone", "Phone", COMPANY.phone)}
          ${profileRow("info", "App Version", COMPANY.version)}
        </div>
        <div>
          <div class="text-xs font-extrabold uppercase tracking-wide text-slate-400 mb-2 px-1">Reports</div>
          <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5">
            <div class="grid grid-cols-2 gap-y-1.5 text-sm mb-4">
              <span class="text-slate-400">Total Mould</span><span class="font-bold text-right">${total}</span>
              <span class="text-slate-400">In My Floor</span><span class="font-bold text-right text-emerald-600">${inFloor}</span>
              <span class="text-slate-400">Pending</span><span class="font-bold text-right text-amber-600">${pend}</span>
              <span class="text-slate-400">Repair</span><span class="font-bold text-right text-purple-600">${rep}</span>
              <span class="text-slate-400">Missing</span><span class="font-bold text-right text-red-600">${miss}</span>
              <span class="text-slate-400">Archived</span><span class="font-bold text-right text-gray-500">${archived}</span>
            </div>
            <button data-action="export-csv" class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-sm">${icon("download", "w-4 h-4")}Export CSV Report</button>
          </div>
        </div>
        <div>
          <div class="text-xs font-extrabold uppercase tracking-wide text-slate-400 mb-2 px-1">Data &amp; Security</div>
          <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
            <button data-action="export-backup" class="w-full flex items-center gap-3 px-4 py-3.5 text-left">
              ${icon("download", "w-[18px] h-[18px] text-emerald-500")}
              <div><div class="text-sm font-semibold">Export Backup</div><div class="text-xs text-slate-400">Save all data as a JSON file</div></div>
            </button>
            <button data-action="trigger-restore" class="w-full flex items-center gap-3 px-4 py-3.5 text-left">
              ${icon("upload", "w-[18px] h-[18px] text-amber-500")}
              <div><div class="text-sm font-semibold">Restore Backup</div><div class="text-xs text-slate-400">Restore data from a backup file</div></div>
            </button>
            <input id="restore-file-input" type="file" accept="application/json" class="hidden" />
          </div>
        </div>
        <div>
          <div class="text-xs font-extrabold uppercase tracking-wide text-slate-400 mb-2 px-1">Appearance</div>
          <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-2">
            <button data-action="set-theme" data-dark="false" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${!state.dark ? "bg-indigo-50 dark:bg-indigo-950" : ""}">
              ${icon("sun", "w-[18px] h-[18px]")}<span class="text-sm font-semibold">Light Mode</span>${!state.dark ? icon("check", "w-4 h-4 ml-auto text-indigo-600") : ""}
            </button>
            <button data-action="set-theme" data-dark="true" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${state.dark ? "bg-indigo-50 dark:bg-indigo-950" : ""}">
              ${icon("moon", "w-[18px] h-[18px]")}<span class="text-sm font-semibold">Dark Mode</span>${state.dark ? icon("check", "w-4 h-4 ml-auto text-indigo-600") : ""}
            </button>
          </div>
        </div>
        <p class="text-center text-xs text-slate-400 pt-2">© ${new Date().getFullYear()} ${COMPANY.name} • Kadena Mould Tracker Pro v${COMPANY.version}</p>
      </div>`;
  }
  function profileRow(iconName, label, value) {
    return `<div class="flex items-center gap-3 px-4 py-3.5">${icon(iconName, "w-[18px] h-[18px] text-indigo-500")}
      <div><div class="text-xs text-slate-400">${label}</div><div class="text-sm font-bold">${escapeHtml(value)}</div></div></div>`;
  }

  function renderRestoreConfirmModal() {
    return `
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm kmt-modal-backdrop">
        <div class="kmt-modal-panel w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl">
          <div class="sticky top-0 bg-white dark:bg-slate-900 flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 class="font-bold text-lg">Restore Backup?</h3>
            <button data-action="close-modal" class="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">${icon("x", "w-5 h-5 text-slate-500")}</button>
          </div>
          <div class="p-5">
            <p class="text-sm text-slate-600 dark:text-slate-300 mb-5">This will overwrite your current data with the selected backup file. This cannot be undone.</p>
            <div class="flex gap-3">
              <button data-action="close-modal" class="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-sm">Cancel</button>
              <button data-action="do-restore" class="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm">Restore</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  /* -------------------------- Modal dispatcher -------------------------- */

  function renderModal() {
    if (!state.modal) return "";
    switch (state.modal.type) {
      case "addEdit": return renderMouldFormModal(state.modal.mould || null);
      case "details": return renderDetailsModal(state.modal.id);
      case "delete": return renderDeleteModal(state.modal.id);
      case "restoreConfirm": return renderRestoreConfirmModal();
      default: return "";
    }
  }

  /* ================================================================ */
  /* EVENT DELEGATION                                                  */
  /* ================================================================ */

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;
    const id = el.dataset.id;

    switch (action) {
      case "nav-tab":
        state.tab = el.dataset.tab;
        state.transferMode = null;
        renderApp();
        break;
      case "toggle-dark":
        state.dark = !state.dark;
        saveTheme();
        renderApp();
        break;
      case "open-add":
        state.modal = { type: "addEdit", mould: null };
        renderApp();
        break;
      case "open-edit": {
        const m = state.moulds.find((x) => x.id === id);
        state.modal = { type: "addEdit", mould: m };
        renderApp();
        break;
      }
      case "open-details":
        state.modal = { type: "details", id };
        renderApp();
        break;
      case "close-modal":
        state.modal = null;
        renderApp();
        break;
      case "confirm-delete":
        state.modal = { type: "delete", id };
        renderApp();
        break;
      case "do-delete":
        deleteMould(id);
        state.modal = null;
        renderApp();
        break;
      case "toggle-favorite":
        toggleFavorite(id);
        if (state.modal && state.modal.type === "details" && state.modal.id === id) renderApp();
        else updateMouldResultsOnly();
        break;
      case "archive-mould":
        setMouldStatus(id, STATUS.ARCHIVE);
        updateMouldResultsOnly();
        break;
      case "set-status":
        setMouldStatus(id, el.dataset.status);
        renderApp();
        break;
      case "submit-mould-form":
        submitMouldForm(el.dataset.editingId || null);
        break;
      case "toggle-filters":
        state.showFilters = !state.showFilters;
        renderApp();
        break;
      case "set-transfer-mode":
        state.transferMode = el.dataset.mode || null;
        renderApp();
        break;
      case "submit-send": {
        const mouldId = document.getElementById("send-mould").value;
        const dest = document.getElementById("send-dest").value.trim();
        const remarks = document.getElementById("send-remarks").value.trim();
        if (!mouldId || !dest) { notify("Please select a mould and enter a destination floor.", "error"); return; }
        sendMould(mouldId, dest, remarks);
        state.transferMode = null;
        renderApp();
        break;
      }
      case "submit-receive": {
        const mouldId = document.getElementById("receive-mould").value;
        const source = document.getElementById("receive-source").value.trim();
        const remarks = document.getElementById("receive-remarks").value.trim();
        if (!mouldId || !source) { notify("Please select a mould and enter the source floor.", "error"); return; }
        receiveMould(mouldId, source, remarks);
        state.transferMode = null;
        renderApp();
        break;
      }
      case "export-csv":
        exportCsv();
        break;
      case "export-backup":
        exportBackup();
        break;
      case "trigger-restore":
        document.getElementById("restore-file-input").click();
        break;
      case "do-restore":
        if (state.pendingFile) importBackupFile(state.pendingFile);
        state.pendingFile = null;
        state.modal = null;
        break;
      case "set-theme":
        state.dark = el.dataset.dark === "true";
        saveTheme();
        renderApp();
        break;
    }
  });

  document.addEventListener("change", (e) => {
    const el = e.target.closest("[data-action]");
    if (el) {
      switch (el.dataset.action) {
        case "set-threshold":
          state.dashboardThreshold = Number(el.value);
          renderApp();
          break;
        case "filter-status":
          state.statusFilter = el.value;
          updateMouldResultsOnly();
          break;
        case "filter-type":
          state.typeFilter = el.value;
          updateMouldResultsOnly();
          break;
        case "filter-sort":
          state.sortBy = el.value;
          updateMouldResultsOnly();
          break;
        case "receive-mould-change": {
          const opt = el.options[el.selectedIndex];
          const floor = opt ? opt.dataset.floor : "";
          const src = document.getElementById("receive-source");
          if (src && floor) src.value = floor;
          break;
        }
      }
    }
    if (e.target.id === "restore-file-input" && e.target.files && e.target.files[0]) {
      state.pendingFile = e.target.files[0];
      state.modal = { type: "restoreConfirm" };
      renderApp();
    }
  });

  // Live search without losing input focus: only re-render the results list.
  document.addEventListener("input", (e) => {
    if (e.target.id === "search-input") {
      state.query = e.target.value;
      updateMouldResultsOnly();
    }
  });

  /* ================================================================ */
  /* INIT                                                              */
  /* ================================================================ */

  document.addEventListener("DOMContentLoaded", () => {
    loadState();
    renderApp();

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch(() => {});
      });
    }
  });
})();
