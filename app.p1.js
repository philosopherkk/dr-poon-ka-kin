/* HK Transit — shortest & cheapest planner with live ETAs */
(() => {
  const APP = {
    version: "1.2.0",
    updatedAt: "2026-09-02 06:10 UTC",
  };
  const CATALOG_URL = "https://data.hkbus.app/routeFareList.min.json";
  const MTR_FARE_URL = "./data/mtr-fares.json";
  const THEME_KEY = "hk-transit-theme";
  const LANG_KEY = "hk-transit-lang";

  const I18N = {
    en: {
      title: "HK Transit",
      sub: "MTR · Bus · Minibus · Live ETA",
      from: "From",
      to: "To",
      plan: "Plan shortest & cheapest",
      live: "Live arrivals refresh every 20s",
      shortest: "Shortest",
      cheapest: "Cheapest",
      walk: "Walk",
      wait: "Wait",
      min: "min",
      fare: "Adult Octopus est.",
      loading: "Loading Hong Kong route catalogue…",
      ready: "Catalogue ready. Set origin & destination.",
      locating: "Getting current position…",
      geoFail: "Location unavailable — type an origin instead.",
      needDest: "Choose a destination to plan a trip.",
      planning: "Calculating routes and checking live arrivals…",
      none: "No reasonable public-transport trip found. Try a closer landmark.",
      both: "Best on both time and fare",
      originPh: "Current location or a stop",
      destPh: "MTR station, estate, or landmark",
      themeLight: "Light",
      themeDark: "Dark",
      tip: "Tip: tap a place chip, or type a station name.",
      locatingBtn: "Locate me",
      updated: "Updated",
      version: "Version",
      transfers: "transfers",
      transfer1: "transfer",
      clearDest: "Clear",
      examples: "Popular places",
      mapHint: "Map shows your selected trip",
      pressEnter: "Press Enter to plan",
      retryGeo: "Try location again",
      catalogueReady: "Ready — pick From and To, then Plan.",
    },
    zh: {
      title: "香港出行",
      sub: "港鐵 · 巴士 · 小巴 · 實時到站",
      from: "起點",
      to: "目的地",
      plan: "計算最快及最平路線",
      live: "到站時間每 20 秒更新",
      shortest: "最快",
      cheapest: "最平",
      walk: "步行",
      wait: "等候",
      min: "分鐘",
      fare: "成人八達通估算",
      loading: "正在載入全港路線資料…",
      ready: "資料已就緒，請設定起點及目的地。",
      locating: "正在取得目前位置…",
      geoFail: "未能定位，請手動輸入起點。",
      needDest: "請先選擇目的地。",
      planning: "正在計算路線並查詢實時到站…",
      none: "找不到合適路線，請試一個更接近的地標。",
      both: "同時最快又最平",
      originPh: "目前位置或車站",
      destPh: "港鐵站、屋邸或地標",
      themeLight: "淺色",
      themeDark: "深色",
      tip: "提示：點選常用地點，或輸入車站名稱。",
      locatingBtn: "定位",
      updated: "更新",
      version: "版本",
      transfers: "轉乘",
      transfer1: "轉乘",
      clearDest: "清除",
      examples: "常用地點",
      mapHint: "地圖顯示已選路線",
      pressEnter: "按 Enter 計算",
      retryGeo: "再次定位",
      catalogueReady: "已就緒 — 設定起點及目的地後按計算。",
    },
  };

  const LINE_COLOR = {
    AEL: "#1c7670", TCL: "#fe7f1d", TWL: "#e03131", ISL: "#0860a8",
    KTL: "#1a9431", TKL: "#7d499d", EAL: "#5eb7e8", TML: "#9a3b26",
    SIL: "#b5bd00", DRL: "#f550a6", WRL: "#b00e3b",
  };
  const AEL_FARE = { "HOK-AIR": 115, "AIR-HOK": 115, "KOW-AIR": 115, "AIR-KOW": 115, "TSY-AIR": 72, "AIR-TSY": 72, "HOK-AWE": 115, "AWE-HOK": 115, "KOW-AWE": 115, "AWE-KOW": 115, "TSY-AWE": 72, "AWE-TSY": 72, "AIR-AWE": 6.1, "AWE-AIR": 6.1 };

  const HOT = [
    { zh: "機場", en: "Airport", lat: 22.31592, lng: 113.93648 },
    { zh: "中環", en: "Central", lat: 22.2822, lng: 114.1577 },
    { zh: "金鐘", en: "Admiralty", lat: 22.2794, lng: 114.1644 },
    { zh: "尖沙咀", en: "Tsim Sha Tsui", lat: 22.2977, lng: 114.1722 },
    { zh: "旺角", en: "Mong Kok", lat: 22.3193, lng: 114.1694 },
    { zh: "銅鑼灣", en: "Causeway Bay", lat: 22.2804, lng: 114.185 },
    { zh: "沙田", en: "Sha Tin", lat: 22.383, lng: 114.188 },
    { zh: "荃灣", en: "Tsuen Wan", lat: 22.3735, lng: 114.1178 },
    { zh: "東涌", en: "Tung Chung", lat: 22.2893, lng: 113.9414 },
    { zh: "迪士尼", en: "Disneyland", lat: 22.313, lng: 114.0433 },
    { zh: "屯門", en: "Tuen Mun", lat: 22.3951, lng: 113.9732 },
    { zh: "觀塘", en: "Kwun Tong", lat: 22.312, lng: 114.2265 },
  ];

  const state = {
    lang: localStorage.getItem(LANG_KEY) || ((navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en"),
    theme: localStorage.getItem(THEME_KEY) || "dark",
    db: null,
    mtrFare: {},
    stopToRoutes: new Map(),
    mtrIds: new Set(),
    mtrAdj: new Map(),
    origin: null,
    dest: null,
    trips: [],
    selected: 0,
    map: null,
    layer: null,
    etaTimer: null,
    tiles: null,
  };

  const $ = (id) => document.getElementById(id);
  const t = (k) => I18N[state.lang][k];

  function setStatus(msg) { $("status").textContent = msg; }

  function applyLang() {
    document.documentElement.lang = state.lang === "zh" ? "zh-HK" : "en";
    $("t-title").textContent = t("title");
    $("t-sub").textContent = t("sub");
    $("t-from").textContent = t("from");
    $("t-to").textContent = t("to");
    $("t-live").textContent = t("live");
    $("planBtn").textContent = t("plan");
    $("originInput").placeholder = t("originPh");
    $("destInput").placeholder = t("destPh");
    const tip = $("tipNote");
    if (tip) tip.textContent = t("tip");
    const ex = $("t-examples");
    if (ex) ex.textContent = t("examples");
    $("langBtn").textContent = state.lang === "en" ? "中文" : "EN";
    $("themeBtn").textContent = state.theme === "dark" ? t("themeLight") : t("themeDark");
    $("geoBtn").title = t("locatingBtn");
    renderFooter();
    renderChips();
    if (state.trips.length) renderTrips();
  }

  function renderFooter() {
    const el = $("appFooter");
    if (!el) return;
    el.innerHTML = `<span>${t("version")} <strong>v${APP.version}</strong></span>
      <span class="dot">·</span>
      <span>${t("updated")} ${esc(APP.updatedAt)}</span>`;
  }

  function applyTheme(theme) {
    state.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.setAttribute("data-theme", theme);
    $("themeBtn").textContent = theme === "dark" ? t("themeLight") : t("themeDark");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "dark" ? "#071018" : "#e8eef3";
    if (state.map && state.tiles) {
      state.map.removeLayer(state.tiles);
      state.tiles = makeTiles().addTo(state.map);
    }
  }

  function makeTiles() {
    const dark = state.theme === "dark";
    return L.tileLayer(
      dark
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      { attribution: "&copy; OSM &copy; CARTO", maxZoom: 19 }
    );
  }

  function haversine(aLat, aLng, bLat, bLng) {
    const R = 6371000, toR = Math.PI / 180;
    const dLat = (bLat - aLat) * toR, dLng = (bLng - aLng) * toR;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toR) * Math.cos(bLat * toR) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }
  const walkMin = (m) => m / 80;

  function modeOf(co) {
    if (co === "mtr" || co === "lightRail") return "mtr";
    if (co === "gmb") return "gmb";
    return "bus";
  }
  function coLabel(co) {
    return { kmb: "KMB", ctb: "CTB", nlb: "NLB", gmb: "GMB", mtr: "MTR", lightRail: "LRT", lrtfeeder: "MTR Bus" }[co] || (co || "").toUpperCase();
  }

  function initMap() {
    state.map = L.map("map", { zoomControl: true, zoomAnimation: true }).setView([22.32, 114.17], 12);
    state.tiles = makeTiles().addTo(state.map);
    state.layer = L.layerGroup().addTo(state.map);
    setTimeout(() => state.map.invalidateSize(), 80);
  }

  function renderChips() {
    $("destChips").innerHTML = HOT.map((h, i) =>
      `<button class="chip" data-i="${i}">${state.lang === "zh" ? h.zh : h.en}</button>`
    ).join("");
  }

  function bindSuggest(input, listEl, onPick) {
    let timer = 0;
    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => showSuggest(input.value, listEl, onPick), 160);
    });
    input.addEventListener("focus", () => {
      if (input.value.trim()) showSuggest(input.value, listEl, onPick);
    });
    document.addEventListener("click", (e) => {
      if (!listEl.contains(e.target) && e.target !== input) listEl.classList.remove("open");
    });
  }

  function showSuggest(q, listEl, onPick) {
    q = q.trim().toLowerCase();
    if (!q || !state.db) { listEl.classList.remove("open"); return; }
    const hits = [];
    for (const h of HOT) {
      if (h.zh.includes(q) || h.en.toLowerCase().includes(q)) hits.push({ name: h, lat: h.lat, lng: h.lng, kind: "place" });
    }
    for (const id of state.mtrIds) {
      const s = state.db.stopList[id];
      if (!s) continue;
      const en = s.name.en.toLowerCase(), zh = s.name.zh;
      if (en.includes(q) || zh.includes(q) || id.toLowerCase() === q) {
        hits.push({ name: s.name, lat: s.location.lat, lng: s.location.lng, kind: "mtr", id });
      }
      if (hits.length > 18) break;
    }
    if (hits.length < 12) {
      for (const [id, s] of Object.entries(state.db.stopList)) {
        const en = s.name.en.toLowerCase(), zh = s.name.zh;
        if (en.includes(q) || zh.includes(q)) {
          hits.push({ name: s.name, lat: s.location.lat, lng: s.location.lng, kind: "stop", id });
        }
        if (hits.length > 16) break;
      }
    }
    listEl.innerHTML = hits.slice(0, 12).map((h, i) => {
      const title = typeof h.name === "string" ? h.name : (state.lang === "zh" ? h.name.zh : h.name.en);
      const sub = h.kind === "mtr" ? "MTR" : h.kind === "place" ? (state.lang === "zh" ? "地標" : "Place") : (state.lang === "zh" ? "車站" : "Stop");
      return `<div class="suggest-item" data-i="${i}"><strong>${title}</strong><small>${sub}</small></div>`;
    }).join("");
    listEl.classList.toggle("open", hits.length > 0);
    listEl.querySelectorAll(".suggest-item").forEach((el) => {
      el.onclick = () => {
        const h = hits[+el.dataset.i];
        const title = typeof h.name === "string" ? h.name : (state.lang === "zh" ? h.name.zh : h.name.en);
        onPick({ lat: h.lat, lng: h.lng, name: title });
        listEl.classList.remove("open");
      };
    });
  }

  async function loadData() {
    setStatus(t("loading"));
    $("loadNote").textContent = t("loading");
    const [db, fares] = await Promise.all([
      fetch(CATALOG_URL).then((r) => r.json()),
      fetch(MTR_FARE_URL).then((r) => r.json()).catch(() => ({})),
    ]);
    state.db = db;
    state.mtrFare = fares;
    const map = new Map();
    for (const [key, route] of Object.entries(db.routeList)) {
      for (const co of route.co || []) {
        const stops = (route.stops && route.stops[co]) || [];
        if (co === "mtr" || co === "lightRail") {
          stops.forEach((sid) => state.mtrIds.add(sid));
          for (let i = 0; i < stops.length - 1; i++) {
            addEdge(stops[i], stops[i + 1], route.route, co);
            addEdge(stops[i + 1], stops[i], route.route, co);
          }
        }
        stops.forEach((sid, seq) => {
          if (!map.has(sid)) map.set(sid, []);
          map.get(sid).push({ key, co, seq });
        });
      }
    }
    state.stopToRoutes = map;
    const nR = Object.keys(db.routeList).length;
    const nS = Object.keys(db.stopList).length;
    $("loadNote").textContent = `${nR.toLocaleString()} routes · ${nS.toLocaleString()} stops`;
    setStatus(t("catalogueReady"));
  }

  function addEdge(a, b, line, co) {
    if (!state.mtrAdj.has(a)) state.mtrAdj.set(a, []);
    state.mtrAdj.get(a).push({ to: b, line, co });
  }

  function nearbyStops(lat, lng, radius = 640, limit = 30) {
    const out = [];
    for (const [id, s] of Object.entries(state.db.stopList)) {
      if (!s.location) continue;
      const d = haversine(lat, lng, s.location.lat, s.location.lng);
      if (d <= radius) out.push({ id, walk: d, name: s.name, location: s.location });
    }
    out.sort((a, b) => a.walk - b.walk);
    return out.slice(0, limit);
  }
