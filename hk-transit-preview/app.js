/* HK Transit — shortest & cheapest planner with live ETAs */
(() => {
  const APP = {
    version: "1.3.0",
    updatedAt: "2026-09-02 13:20 UTC",
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
      fareMtr: "MTR",
      fareBus: "Bus",
      fareGmb: "Minibus",
      fareWalk: "Walk",
      fareTotal: "Total (Octopus adult est.)",
      fareNote: "Fares are estimates per mode; Octopus adult.",
      interchange: "Interchange",
      interchangeAt: "Change at",
      routeMap: "Route on map",
      free: "Free",
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
      fareMtr: "港鐵",
      fareBus: "巴士",
      fareGmb: "小巴",
      fareWalk: "步行",
      fareTotal: "總車費（成人八達通估算）",
      fareNote: "各段車費按交通工具分列；成人八達通估算。",
      interchange: "轉乘",
      interchangeAt: "轉乘站",
      routeMap: "路線地圖",
      free: "免費",
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
    etaTimer: null,
    routeMap: null,
    osrmCache: new Map(),
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
    document.documentElement.classList.toggle("map-dark", theme === "dark");
    if (state.trips.length) drawRouteMap(state.trips[state.selected]);
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

  function fareModeKey(leg) {
    if (!leg || leg.type === "walk") return null;
    if (leg.co === "mtr" || leg.co === "lightRail") return "mtr";
    if (leg.co === "gmb") return "gmb";
    return "bus";
  }

  function fareModeLabel(key) {
    return ({ mtr: t("fareMtr"), bus: t("fareBus"), gmb: t("fareGmb") })[key] || key;
  }

  function roundFare(n) { return Math.round((n || 0) * 10) / 10; }

  function annotateTrips(trips) {
    for (const tr of trips) {
      let mtr = 0, bus = 0, gmb = 0;
      for (const leg of tr.legs) {
        if (leg.type === "walk") continue;
        if (leg.fare == null) {
          if (leg.routeKey && leg.boardSeq != null) {
            const route = state.db.routeList[leg.routeKey];
            leg.fare = leg.co === "mtr"
              ? mtrPairFare(leg.stopId, leg.alightId)
              : sectionFare(route, leg.boardSeq, leg.alightSeq);
          } else if (leg.stopId && leg.alightId) {
            leg.fare = mtrPairFare(leg.stopId, leg.alightId);
          } else {
            leg.fare = defaultFare({ co: [leg.co || "kmb"] });
          }
        }
        leg.fare = roundFare(leg.fare);
        const k = fareModeKey(leg);
        if (k === "mtr") mtr += leg.fare;
        else if (k === "gmb") gmb += leg.fare;
        else bus += leg.fare;
      }
      tr.fareBreakdown = { mtr: roundFare(mtr), bus: roundFare(bus), gmb: roundFare(gmb) };
      tr.fare = roundFare(mtr + bus + gmb);
    }
  }

  function fareBreakdownHtml(bd) {
    if (!bd) return "";
    const pills = [];
    if (bd.mtr > 0) pills.push(`<span class="fare-pill mtr">${t("fareMtr")} $${bd.mtr.toFixed(1)}</span>`);
    if (bd.bus > 0) pills.push(`<span class="fare-pill bus">${t("fareBus")} $${bd.bus.toFixed(1)}</span>`);
    if (bd.gmb > 0) pills.push(`<span class="fare-pill gmb">${t("fareGmb")} $${bd.gmb.toFixed(1)}</span>`);
    return pills.length ? `<div class="fare-breakdown">${pills.join("")}</div>` : "";
  }

  function stopLat(id) {
    const s = state.db && state.db.stopList[id];
    return s && s.location ? [s.location.lat, s.location.lng] : null;
  }

  function transitStopPoints(leg) {
    const pts = [];
    if (!leg.routeKey || leg.boardSeq == null || leg.alightSeq == null) {
      const a = stopLat(leg.stopId), b = stopLat(leg.alightId);
      if (a) pts.push(a);
      if (b && b !== a) pts.push(b);
      return pts;
    }
    const route = state.db.routeList[leg.routeKey];
    const seq = (route.stops && route.stops[leg.co]) || [];
    const from = Math.min(leg.boardSeq, leg.alightSeq);
    const to = Math.max(leg.boardSeq, leg.alightSeq);
    for (let i = from; i <= to; i++) {
      const p = stopLat(seq[i]);
      if (p) pts.push(p);
    }
    return pts;
  }

  function mtrLineStations(fromId, toId, line) {
    const pts = [];
    if (!fromId || !toId) return pts;
    const q = [[fromId, [fromId]]];
    const seen = new Set([fromId]);
    while (q.length) {
      const [cur, path] = q.shift();
      if (cur === toId) {
        for (const id of path) {
          const p = stopLat(id);
          if (p) pts.push(p);
        }
        return pts;
      }
      for (const e of state.mtrAdj.get(cur) || []) {
        if (e.line !== line || seen.has(e.to)) continue;
        seen.add(e.to);
        q.push([e.to, path.concat([e.to])]);
      }
      if (q.length > 120) break;
    }
    const a = stopLat(fromId), b = stopLat(toId);
    if (a) pts.push(a);
    if (b) pts.push(b);
    return pts;
  }

  async function walkPolyline(a, b) {
    const key = `${a[0].toFixed(5)},${a[1].toFixed(5)}|${b[0].toFixed(5)},${b[1].toFixed(5)}`;
    if (state.osrmCache.has(key)) return state.osrmCache.get(key);
    try {
      const url = `https://router.project-osrm.org/route/v1/foot/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`;
      const j = await fetch(url).then((r) => r.json());
      const coords = j.routes && j.routes[0] && j.routes[0].geometry && j.routes[0].geometry.coordinates;
      const line = coords ? coords.map((c) => [c[1], c[0]]) : [a, b];
      state.osrmCache.set(key, line);
      return line;
    } catch (_) {
      const fallback = [a, b];
      state.osrmCache.set(key, fallback);
      return fallback;
    }
  }

  async function buildRouteGeometry(tr) {
    const segments = [];
    let cursor = state.origin ? [state.origin.lat, state.origin.lng] : null;
    for (let i = 0; i < tr.legs.length; i++) {
      const leg = tr.legs[i];
      if (leg.type === "walk") {
        const nextTransit = tr.legs.slice(i + 1).find((l) => l.type !== "walk");
        const nextPt = nextTransit
          ? stopLat(nextTransit.stopId)
          : (state.dest ? [state.dest.lat, state.dest.lng] : null);
        if (cursor && nextPt) {
          const line = await walkPolyline(cursor, nextPt);
          segments.push({ type: "walk", pts: line });
          cursor = line[line.length - 1] || nextPt;
        }
        continue;
      }
      let pts = [];
      if (leg.type === "mtr" && leg.route) pts = mtrLineStations(leg.stopId, leg.alightId, leg.route);
      if (!pts.length) pts = transitStopPoints(leg);
      if (pts.length) {
        segments.push({ type: leg.type, co: leg.co, color: leg.color, pts });
        cursor = pts[pts.length - 1];
      }
    }
    if (state.dest && cursor) {
      const d = [state.dest.lat, state.dest.lng];
      if (haversine(cursor[0], cursor[1], d[0], d[1]) > 30) {
        const line = await walkPolyline(cursor, d);
        segments.push({ type: "walk", pts: line });
      }
    }
    return segments;
  }

  async function drawRouteMap(tr) {
    const host = document.querySelector(".trip.active .route-map");
    if (!host || !tr || !window.L) return;
    host.innerHTML = "";
    if (state.routeMap) {
      state.routeMap.remove();
      state.routeMap = null;
    }
    const map = L.map(host, { zoomControl: false, attributionControl: true }).setView([22.32, 114.17], 12);
    state.routeMap = map;
    const dark = state.theme === "dark";
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OSM",
      maxZoom: 18,
      className: dark ? "tile-dark" : "",
    }).addTo(map);
    const layer = L.layerGroup().addTo(map);
    const segments = await buildRouteGeometry(tr);
    const bounds = [];
    for (const seg of segments) {
      if (!seg.pts || seg.pts.length < 2) continue;
      const color = seg.type === "walk" ? "#9bb4c7" : (seg.color || "#5b8cff");
      L.polyline(seg.pts, {
        color,
        weight: seg.type === "walk" ? 3 : 5,
        opacity: 0.92,
        dashArray: seg.type === "walk" ? "5 7" : null,
      }).addTo(layer);
      bounds.push(...seg.pts);
    }
    if (state.origin) {
      L.circleMarker([state.origin.lat, state.origin.lng], { radius: 6, color: "#2ee0c0", fillColor: "#2ee0c0", fillOpacity: 1 }).addTo(layer);
      bounds.push([state.origin.lat, state.origin.lng]);
    }
    if (state.dest) {
      L.circleMarker([state.dest.lat, state.dest.lng], { radius: 6, color: "#ff6b6b", fillColor: "#ff6b6b", fillOpacity: 1 }).addTo(layer);
      bounds.push([state.dest.lat, state.dest.lng]);
    }
    const transitLegs = tr.legs.filter((l) => l.type !== "walk");
    for (let i = 1; i < transitLegs.length; i++) {
      const cur = transitLegs[i];
      const p = stopLat(cur.stopId);
      if (p) {
        L.marker(p, {
          icon: L.divIcon({
            className: "xfer-pin",
            html: '<div style="background:#f4c15d;color:#3a2a12;font-weight:800;font-size:10px;border-radius:999px;padding:2px 6px;border:1px solid #fff">⇄</div>',
            iconSize: [24, 16],
            iconAnchor: [12, 8],
          }),
        }).addTo(layer);
        bounds.push(p);
      }
    }
    if (bounds.length) map.fitBounds(bounds, { padding: [18, 18], maxZoom: 15 });
    setTimeout(() => map.invalidateSize(), 80);
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

  function nearbyMtr(lat, lng, radius = 1100, limit = 5) {
    const out = [];
    for (const id of state.mtrIds) {
      const s = state.db.stopList[id];
      if (!s || !s.location) continue;
      const d = haversine(lat, lng, s.location.lat, s.location.lng);
      if (d <= radius) out.push({ id, walk: d, name: s.name, location: s.location });
    }
    out.sort((a, b) => a.walk - b.walk);
    return out.slice(0, limit);
  }

  function sectionFare(route, boardSeq, alightSeq) {
    const fares = route.fares;
    if (!fares || !fares.length) return defaultFare(route);
    const idx = Math.min(boardSeq, fares.length - 1);
    const raw = parseFloat(fares[idx]);
    if (Number.isNaN(raw)) return defaultFare(route);
    const span = Math.max(1, (route.seq || fares.length) - 1);
    const used = Math.max(1, alightSeq - boardSeq);
    if (used / span < 0.45 && raw > 5) return Math.max(3.5, Math.round(raw * 0.72 * 10) / 10);
    return raw;
  }
  function defaultFare(route) {
    const co = route.co[0];
    if (co === "gmb") return 7.4;
    if (co === "nlb") return 10;
    if (co === "mtr") return 8.5;
    return 6.8;
  }

  function rideMinutes(route, boardSeq, alightSeq) {
    const hops = Math.max(1, alightSeq - boardSeq);
    const jt = parseFloat(route.jt);
    const totalStops = Math.max(2, (route.stops[route.co[0]] || []).length);
    if (!Number.isNaN(jt) && jt > 0) return Math.max(3, jt * (hops / (totalStops - 1)));
    const co = route.co[0];
    const per = co === "mtr" ? 2.15 : co === "gmb" ? 1.35 : co === "lightRail" ? 1.8 : 1.65;
    return hops * per;
  }

  function defaultWait(co) {
    if (co === "mtr") return 3.5;
    if (co === "lightRail") return 5;
    if (co === "gmb") return 8;
    return 6.5;
  }

  function nm(obj) { return state.lang === "zh" ? obj.zh : obj.en; }

  function makeDirectTrips(origin, dest) {
    const trips = [];
    const origNear = nearbyStops(origin.lat, origin.lng, 680, 28);
    const seen = new Set();
    for (const os of origNear) {
      const refs = state.stopToRoutes.get(os.id) || [];
      for (const ref of refs) {
        const route = state.db.routeList[ref.key];
        if (!route) continue;
        const seqStops = (route.stops && route.stops[ref.co]) || [];
        let best = null;
        for (let i = ref.seq + 1; i < seqStops.length; i++) {
          const st = state.db.stopList[seqStops[i]];
          if (!st || !st.location) continue;
          const dDest = haversine(dest.lat, dest.lng, st.location.lat, st.location.lng);
          if (dDest <= 680 && (!best || dDest < best.dDest)) {
            best = { alightSeq: i, alightId: seqStops[i], alight: st, dDest };
          }
        }
        if (!best) continue;
        const sig = `${ref.key}|${ref.co}|${ref.seq}|${best.alightSeq}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        const wait = defaultWait(ref.co);
        const ride = rideMinutes(route, ref.seq, best.alightSeq);
        const w1 = walkMin(os.walk), w2 = walkMin(best.dDest);
        const fare = ref.co === "mtr"
          ? mtrPairFare(os.id, best.alightId)
          : sectionFare(route, ref.seq, best.alightSeq);
        trips.push({
          id: sig,
          kind: "direct",
          duration: w1 + wait + ride + w2,
          fare,
          transfers: 0,
          board: os,
          legs: [
            walkLeg(origin, os, w1),
            {
              type: modeOf(ref.co),
              co: ref.co,
              route: route.route,
              routeKey: ref.key,
              serviceType: route.serviceType,
              bound: (route.bound && route.bound[ref.co]) || "",
              from: nm(os.name),
              to: nm(best.alight.name),
              destName: nm(route.dest),
              stopId: os.id,
              alightId: best.alightId,
              boardSeq: ref.seq,
              alightSeq: best.alightSeq,
              mins: ride,
              wait,
              etaMin: null,
              color: LINE_COLOR[route.route] || null,
              fare,
            },
            walkLeg(best.alight.location, dest, w2, nm(best.alight.name)),
          ],
        });
      }
    }
    return trips;
  }

  function walkLeg(from, to, mins, fromName) {
    return {
      type: "walk",
      from: fromName || (from.name || t("walk")),
      to: to.name || "",
      mins,
      meters: Math.round(mins * 80),
    };
  }

  function mtrPairFare(a, b) {
    if (a === b) return 0;
    const k1 = `${a}-${b}`, k2 = `${b}-${a}`;
    if (state.mtrFare[k1] != null) return state.mtrFare[k1];
    if (state.mtrFare[k2] != null) return state.mtrFare[k2];
    if (AEL_FARE[k1] != null) return AEL_FARE[k1];
    if (AEL_FARE[k2] != null) return AEL_FARE[k2];
    return 8.5;
  }

  function mtrPathTrips(origin, dest) {
    const starts = nearbyMtr(origin.lat, origin.lng, 1200, 4);
    const ends = nearbyMtr(dest.lat, dest.lng, 1200, 4);
    if (!starts.length || !ends.length) return [];
    const endSet = new Set(ends.map((e) => e.id));
    const endWalk = Object.fromEntries(ends.map((e) => [e.id, e]));
    const trips = [];

    for (const s of starts) {
      const distMap = new Map();
      const prev = new Map();
      const pq = [[walkMin(s.walk) + 3.2, s.id, null, 0]];
      distMap.set(s.id + "|", walkMin(s.walk) + 3.2);

      while (pq.length) {
        pq.sort((a, b) => a[0] - b[0]);
        const [cost, node, line, xfers] = pq.shift();
        if (endSet.has(node) && node !== s.id) {
          const path = reconstruct(prev, node, line);
          const ew = endWalk[node];
          const fare = mtrPathFare(path);
          const ride = cost - walkMin(s.walk) - 3.2;
          trips.push({
            id: `mtr|${s.id}|${node}|${path.map((p) => p.line).join("-")}`,
            kind: "mtr",
            duration: cost + walkMin(ew.walk),
            fare,
            transfers: Math.max(0, new Set(path.map((p) => p.line)).size - 1),
            board: s,
            legs: [
              walkLeg(origin, s, walkMin(s.walk)),
              ...collapseMtr(path, s),
              walkLeg(ew.location, dest, walkMin(ew.walk), nm(ew.name)),
            ],
          });
          endSet.delete(node);
          if (![...endSet].length) break;
        }
        const edges = state.mtrAdj.get(node) || [];
        const used = new Set();
        for (const e of edges) {
          const sig = e.to + e.line;
          if (used.has(sig)) continue;
          used.add(sig);
          const xfer = line && line !== e.line ? 3.8 : 0;
          const nextCost = cost + 2.15 + xfer;
          const key = e.to + "|" + e.line;
          if (nextCost < (distMap.get(key) || 1e9) && xfers + (xfer ? 1 : 0) <= 3) {
            distMap.set(key, nextCost);
            prev.set(key, { from: node, line: e.line, co: e.co, prevLine: line });
            pq.push([nextCost, e.to, e.line, xfers + (xfer ? 1 : 0)]);
          }
        }
        if (pq.length > 800) break;
      }
    }
    return trips;
  }

  function reconstruct(prev, node, line) {
    const path = [];
    let cur = node, curLine = line, guard = 0;
    while (cur && guard++ < 80) {
      const key = cur + "|" + (curLine || "");
      const p = prev.get(key) || prev.get(cur + "|" + curLine);
      if (!p) break;
      path.push({ to: cur, line: p.line, co: p.co });
      cur = p.from;
      curLine = p.prevLine;
    }
    path.reverse();
    return path;
  }

  function collapseMtr(path, start) {
    if (!path.length) return [];
    const legs = [];
    let i = 0;
    while (i < path.length) {
      const line = path[i].line;
      let j = i;
      while (j < path.length && path[j].line === line) j++;
      const last = path[j - 1];
      const fromStop = i === 0 ? start : state.db.stopList[path[i - 1].to] || start;
      const toStop = state.db.stopList[last.to];
      const fromId = (fromStop.id || start.id);
      const toId = last.to;
      legs.push({
        type: "mtr",
        co: last.co || "mtr",
        route: line,
        from: nm(fromStop.name || { en: start.id, zh: start.id }),
        to: nm((toStop && toStop.name) || { en: last.to, zh: last.to }),
        destName: line,
        stopId: fromId,
        alightId: toId,
        mins: (j - i) * 2.15,
        wait: i === 0 ? 3.2 : 3.8,
        etaMin: null,
        color: LINE_COLOR[line],
        fare: mtrPairFare(fromId, toId),
      });
      i = j;
    }
    return legs;
  }

  function mtrPathFare(path) {
    if (!path.length) return 0;
    const stations = [];
    const ids = path.map((p) => p.to);
    const firstLine = path[0].line;
    const lastLine = path[path.length - 1].line;
    const end = path[path.length - 1].to;
    if (firstLine === "AEL" || lastLine === "AEL") {
      const aelStops = path.filter((p) => p.line === "AEL").map((p) => p.to);
      const a = aelStops[0], b = aelStops[aelStops.length - 1];
      let f = AEL_FARE[`${a}-${b}`] || AEL_FARE[`${b}-${a}`] || 115;
      const rest = path.filter((p) => p.line !== "AEL");
      if (rest.length) f += mtrPairFare(rest[0].to, rest[rest.length - 1].to);
      return Math.round(f * 10) / 10;
    }
    return mtrPairFare(ids[0], end);
  }

  function transferTrips(origin, dest, existing) {
    if (existing.some((tr) => tr.duration < 32 && tr.transfers === 0)) return [];
    const hubs = nearbyMtr(origin.lat, origin.lng, 2200, 6);
    const destM = nearbyMtr(dest.lat, dest.lng, 1600, 4);
    if (!hubs.length || !destM.length) return [];
    const trips = [];
    const seen = new Set();
    for (const hub of hubs) {
      const mtrPart = mtrPathTrips(
        { lat: hub.location.lat, lng: hub.location.lng, name: nm(hub.name) },
        dest
      ).sort((a, b) => a.duration - b.duration)[0];
      if (!mtrPart) continue;
      const origNear = nearbyStops(origin.lat, origin.lng, 480, 8);
      for (const os of origNear) {
        const refs = state.stopToRoutes.get(os.id) || [];
        for (const ref of refs) {
          if (ref.co === "mtr" || ref.co === "lightRail") continue;
          const route = state.db.routeList[ref.key];
          if (!route) continue;
          const seqStops = (route.stops && route.stops[ref.co]) || [];
          let alight = null;
          const maxI = Math.min(seqStops.length, ref.seq + 14);
          for (let i = ref.seq + 1; i < maxI; i++) {
            const st = state.db.stopList[seqStops[i]];
            if (!st) continue;
            const d = haversine(st.location.lat, st.location.lng, hub.location.lat, hub.location.lng);
            if (d < 280) { alight = { i, st, d, id: seqStops[i] }; break; }
          }
          if (!alight) continue;
          const sig = `${ref.key}|${hub.id}`;
          if (seen.has(sig)) continue;
          seen.add(sig);
          const wait = defaultWait(ref.co);
          const ride = rideMinutes(route, ref.seq, alight.i);
          trips.push({
            id: "xf|" + sig,
            kind: "transfer",
            duration: walkMin(os.walk) + wait + ride + walkMin(alight.d) + mtrPart.duration,
            fare: sectionFare(route, ref.seq, alight.i) + mtrPart.fare,
            transfers: 1 + (mtrPart.transfers || 0),
            board: os,
            legs: [
              walkLeg(origin, os, walkMin(os.walk)),
              {
                type: modeOf(ref.co), co: ref.co, route: route.route, routeKey: ref.key,
                serviceType: route.serviceType, bound: (route.bound && route.bound[ref.co]) || "",
                from: nm(os.name), to: nm(alight.st.name), destName: nm(route.dest),
                stopId: os.id, alightId: alight.id, boardSeq: ref.seq, alightSeq: alight.i,
                mins: ride, wait, etaMin: null,
                fare: sectionFare(route, ref.seq, alight.i),
              },
              walkLeg(alight.st.location, hub.location, walkMin(alight.d), nm(alight.st.name)),
              ...mtrPart.legs.filter((l) => l.type === "mtr"),
              mtrPart.legs[mtrPart.legs.length - 1],
            ],
          });
          if (trips.length >= 8) return trips;
        }
      }
    }
    return trips;
  }

  function dedupeRank(trips) {
    const bySig = new Map();
    for (const tr of trips) {
      const transit = tr.legs.filter((l) => l.type !== "walk").map((l) => l.route + l.from + l.to).join(">");
      const prev = bySig.get(transit);
      if (!prev || tr.duration < prev.duration - 0.4 || (Math.abs(tr.duration - prev.duration) < 0.4 && tr.fare < prev.fare)) {
        bySig.set(transit, tr);
      }
    }
    const list = [...bySig.values()].filter((t) => t.duration < 180 && t.fare < 200);
    list.sort((a, b) => a.duration - b.duration || a.fare - b.fare);
    return list.slice(0, 10);
  }

  function pickWinners(list) {
    if (!list.length) return { fastest: null, cheapest: null };
    const fastest = list[0];
    const cheapest = [...list].sort((a, b) => a.fare - b.fare || a.duration - b.duration)[0];
    return { fastest, cheapest };
  }

  async function plan() {
    if (!state.db) return;
    if (!state.origin) {
      setStatus(t("geoFail"));
      return;
    }
    if (!state.dest) {
      setStatus(t("needDest"));
      return;
    }
    $("planBtn").disabled = true;
    setStatus(t("planning"));
    await new Promise((r) => setTimeout(r, 30));
    try {
      const direct = makeDirectTrips(state.origin, state.dest);
      const mtr = mtrPathTrips(state.origin, state.dest);
      const xf = transferTrips(state.origin, state.dest, [...direct, ...mtr]);
      const ranked = dedupeRank([...direct, ...mtr, ...xf]);
      annotateTrips(ranked);
      state.trips = ranked;
      state.selected = 0;
      await refreshEtas(ranked.slice(0, 6));
      rerankWithEta();
      annotateTrips(state.trips);
      renderTrips();
      if (!ranked.length) setStatus(t("none"));
      else setStatus(`${state.origin.name} → ${state.dest.name}`);
    } catch (err) {
      console.error(err);
      setStatus("Planning error: " + err.message);
    } finally {
      $("planBtn").disabled = false;
    }
  }

  function rerankWithEta() {
    for (const tr of state.trips) {
      let waitAdj = 0;
      const first = tr.legs.find((l) => l.type !== "walk");
      if (first && first.etaMin != null) waitAdj = first.etaMin - (first.wait || 0);
      tr.duration = Math.max(4, tr.duration + waitAdj);
      if (first && first.etaMin != null) first.wait = first.etaMin;
    }
    state.trips.sort((a, b) => a.duration - b.duration || a.fare - b.fare);
  }

  async function refreshEtas(trips) {
    const jobs = [];
    for (const tr of trips) {
      const leg = tr.legs.find((l) => l.type !== "walk");
      if (!leg) continue;
      jobs.push(fillEta(leg));
    }
    await Promise.all(jobs);
  }

  async function fillEta(leg) {
    try {
      const mins = await liveEta(leg);
      if (mins != null) leg.etaMin = mins;
    } catch (_) { /* keep schedule wait */ }
  }

  async function liveEta(leg) {
    const now = Date.now();
    if (leg.co === "kmb" || leg.co === "lrtfeeder") {
      const st = leg.serviceType || "1";
      const url = `https://data.etabus.gov.hk/v1/transport/kmb/eta/${leg.stopId}/${leg.route}/${st}`;
      const j = await fetch(url).then((r) => r.json());
      return firstEtaMinutes(j.data, now);
    }
    if (leg.co === "ctb") {
      const url = `https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/${leg.stopId}/${leg.route}`;
      const j = await fetch(url).then((r) => r.json());
      return firstEtaMinutes(j.data, now);
    }
    if (leg.co === "gmb") {
      const url = `https://data.etagmb.gov.hk/eta/stop/${leg.stopId}`;
      const j = await fetch(url).then((r) => r.json());
      const rows = [];
      for (const r of j.data || []) {
        for (const e of r.eta || []) rows.push(e);
      }
      const times = rows.map((e) => e.timestamp || e.eta).filter(Boolean);
      return minFuture(times, now);
    }
    if (leg.co === "mtr") {
      const url = `https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=${leg.route}&sta=${leg.stopId}`;
      const j = await fetch(url).then((r) => r.json());
      const pack = j.data && j.data[`${leg.route}-${leg.stopId}`];
      if (!pack) return null;
      const rows = [...(pack.UP || []), ...(pack.DOWN || [])];
      const times = rows.map((r) => r.time).filter(Boolean);
      return minFuture(times.map((x) => x.replace(" ", "T") + "+08:00"), now);
    }
    return null;
  }

  function firstEtaMinutes(rows, now) {
    if (!rows || !rows.length) return null;
    return minFuture(rows.map((r) => r.eta).filter(Boolean), now);
  }
  function minFuture(isoList, now) {
    const mins = isoList.map((s) => (Date.parse(s) - now) / 60000).filter((m) => m >= -0.4 && m < 90);
    if (!mins.length) return null;
    return Math.max(0, Math.min(...mins));
  }

  function renderLegsList(legs) {
    const parts = [];
    let prevTransit = null;
    for (const leg of legs) {
      if (leg.type !== "walk" && prevTransit) {
        parts.push(`<div class="interchange"><span class="interchange-icon">⇄</span><span>${t("interchange")} · ${t("interchangeAt")} ${esc(leg.from)}</span></div>`);
      }
      parts.push(renderLeg(leg));
      if (leg.type !== "walk") prevTransit = leg;
    }
    return parts.join("");
  }

  function renderTrips() {
    const { fastest, cheapest } = pickWinners(state.trips);
    const hero = $("hero");
    if (!fastest) {
      hero.innerHTML = "";
      $("trips").innerHTML = `<div class="empty">${t("none")}</div>`;
      return;
    }
    const same = fastest.id === cheapest.id;
    hero.innerHTML = `
      <div class="hero fast">
        <h3>${t("shortest")}</h3>
        <div class="big">${fmtMin(fastest.duration)}</div>
        <div class="sub">$${fastest.fare.toFixed(1)} · ${fastest.transfers} ${fastest.transfers === 1 ? t("transfer1") : t("transfers")}</div>
        ${fareBreakdownHtml(fastest.fareBreakdown)}
      </div>
      <div class="hero cheap">
        <h3>${t("cheapest")}${same ? " · " + t("both") : ""}</h3>
        <div class="big">$${cheapest.fare.toFixed(1)}</div>
        <div class="sub">${fmtMin(cheapest.duration)}</div>
        ${fareBreakdownHtml(cheapest.fareBreakdown)}
      </div>
      <p class="empty" style="grid-column:1/-1;margin:0;font-size:11px">${t("fareNote")}</p>`;

    $("trips").innerHTML = state.trips.map((tr, i) => {
      const tags = [];
      if (tr.id === fastest.id) tags.push(t("shortest"));
      if (tr.id === cheapest.id) tags.push(t("cheapest"));
      const active = i === state.selected;
      return `<article class="trip ${active ? "active" : ""}" data-i="${i}">
        <div class="trip-top">
          <div>
            <div class="mins">${fmtMin(tr.duration)}</div>
            <div class="muted" style="font-size:11px;margin-top:2px">${tags.join(" · ") || tr.kind}</div>
          </div>
          <div style="text-align:right">
            <div class="fare-total">$${tr.fare.toFixed(1)}</div>
            <div class="fare-note">${t("fareTotal")}</div>
          </div>
        </div>
        ${fareBreakdownHtml(tr.fareBreakdown)}
        ${active ? `<div class="route-map" aria-label="${t("routeMap")}"></div>` : ""}
        <div class="legs">${renderLegsList(tr.legs)}</div>
      </article>`;
    }).join("");

    $("trips").querySelectorAll(".trip").forEach((el) => {
      el.onclick = () => {
        state.selected = +el.dataset.i;
        renderTrips();
        drawRouteMap(state.trips[state.selected]);
      };
    });
    drawRouteMap(state.trips[state.selected]);
  }

  function renderLeg(leg) {
    if (leg.type === "walk") {
      return `<div class="leg"><div class="badge walk">W</div><div><div class="leg-mode">${t("fareWalk")}</div>${t("walk")} ${leg.meters || Math.round(leg.mins * 80)} m · ${fmtMin(leg.mins)}</div><div class="leg-fare free">${t("free")}</div></div>`;
    }
    const eta = leg.etaMin != null ? `<span class="eta">${Math.round(leg.etaMin)} ${t("min")}</span>` : `<span class="muted">${t("wait")} ${fmtMin(leg.wait || 0)}</span>`;
    const mode = fareModeLabel(fareModeKey(leg));
    const label = `${coLabel(leg.co)} ${leg.route}`;
    const fareTxt = leg.fare != null ? `$${leg.fare.toFixed(1)}` : "—";
    return `<div class="leg"><div class="badge ${leg.type}" style="${leg.color ? `background:${leg.color};color:#fff` : ""}">${esc(leg.route)}</div>
      <div><div class="leg-mode">${esc(mode)}</div><strong>${esc(label)}</strong><div class="muted">${esc(leg.from)} → ${esc(leg.to)}${leg.destName ? " · " + esc(leg.destName) : ""}</div></div>
      <div><div class="leg-fare">${fareTxt}</div>${eta}</div></div>`;
  }

  function fmtMin(n) {
    n = Math.max(0, n);
    const m = Math.round(n);
    return `${m} ${t("min")}`;
  }
  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  async function photonReverse(lat, lng) {
    try {
      const u = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=${state.lang === "zh" ? "default" : "en"}`;
      const j = await fetch(u).then((r) => r.json());
      const f = j.features && j.features[0];
      if (!f) return null;
      const p = f.properties || {};
      return p.name || p.street || p.district || p.city || null;
    } catch (_) {
      return null;
    }
  }

  function useGeo() {
    if (!navigator.geolocation) { setStatus(t("geoFail")); return; }
    setStatus(t("locating"));
    $("originInput").value = t("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const label = (await photonReverse(lat, lng)) || (state.lang === "zh" ? "目前位置" : "Current location");
        state.origin = { lat, lng, name: label };
        $("originInput").value = label;
        setStatus(label);
        if (state.dest) plan();
      },
      () => {
        if (!$("originInput").value || $("originInput").value === t("locating")) $("originInput").value = "";
        setStatus(t("geoFail"));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }

  function tickClock() {
    $("clock").textContent = new Date().toLocaleString(state.lang === "zh" ? "zh-HK" : "en-HK", { timeZone: "Asia/Hong_Kong", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function startEtaLoop() {
    clearInterval(state.etaTimer);
    state.etaTimer = setInterval(async () => {
      if (!state.trips.length) return;
      await refreshEtas(state.trips.slice(0, 6));
      rerankWithEta();
      renderTrips();
    }, 20000);
  }

  async function main() {
    renderChips();
    applyLang();
    bindSuggest($("originInput"), $("originSuggest"), (p) => {
      state.origin = p;
      $("originInput").value = p.name;
      if (state.dest) plan();
    });
    bindSuggest($("destInput"), $("destSuggest"), (p) => {
      state.dest = p;
      $("destInput").value = p.name;
      if (state.origin) plan();
    });
    $("destChips").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-i]");
      if (!btn) return;
      const h = HOT[+btn.dataset.i];
      state.dest = { lat: h.lat, lng: h.lng, name: state.lang === "zh" ? h.zh : h.en };
      $("destInput").value = state.dest.name;
      if (state.origin) plan();
    });
    $("geoBtn").onclick = useGeo;
    $("planBtn").onclick = plan;
    $("swapBtn").onclick = () => {
      const a = state.origin, b = state.dest;
      state.origin = b; state.dest = a;
      $("originInput").value = (b && b.name) || "";
      $("destInput").value = (a && a.name) || "";
      if (state.origin && state.dest) plan();
    };
    $("langBtn").onclick = () => {
      state.lang = state.lang === "en" ? "zh" : "en";
      localStorage.setItem(LANG_KEY, state.lang);
      applyLang();
    };
    $("themeBtn").onclick = () => applyTheme(state.theme === "dark" ? "light" : "dark");
    const onEnter = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        plan();
      }
    };
    $("originInput").addEventListener("keydown", onEnter);
    $("destInput").addEventListener("keydown", onEnter);
    tickClock();
    setInterval(tickClock, 1000);
    document.documentElement.setAttribute("data-theme", state.theme);
    renderFooter();
    await loadData();
    startEtaLoop();
    // Soft-start: try geo, but do not block typing
    useGeo();
  }

  window.HKTransit = { state, plan, APP };
  main().catch((err) => setStatus("Startup failed: " + err.message));
})();
