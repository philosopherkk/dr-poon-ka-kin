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
      state.trips = ranked;
      state.selected = 0;
      await refreshEtas(ranked.slice(0, 6));
      rerankWithEta();
      renderTrips();
      drawTrip(state.trips[state.selected]);
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
      </div>
      <div class="hero cheap">
        <h3>${t("cheapest")}${same ? " · " + t("both") : ""}</h3>
        <div class="big">$${cheapest.fare.toFixed(1)}</div>
        <div class="sub">${fmtMin(cheapest.duration)}</div>
      </div>`;

    $("trips").innerHTML = state.trips.map((tr, i) => {
      const tags = [];
      if (tr.id === fastest.id) tags.push(t("shortest"));
      if (tr.id === cheapest.id) tags.push(t("cheapest"));
      return `<article class="trip ${i === state.selected ? "active" : ""}" data-i="${i}">
        <div class="trip-top">
          <div class="mins">${fmtMin(tr.duration)}</div>
          <div class="fare">$${tr.fare.toFixed(1)}</div>
        </div>
        <div class="muted" style="font-size:12px;margin:2px 0 6px">${tags.join(" · ") || (tr.kind === "mtr" ? "MTR" : tr.kind)}</div>
        <div class="legs">${tr.legs.map(renderLeg).join("")}</div>
      </article>`;
    }).join("");

    $("trips").querySelectorAll(".trip").forEach((el) => {
      el.onclick = () => {
        state.selected = +el.dataset.i;
        renderTrips();
        drawTrip(state.trips[state.selected]);
      };
    });
  }

  function renderLeg(leg) {
    if (leg.type === "walk") {
      return `<div class="leg"><div class="badge walk">W</div><div>${t("walk")} ${leg.meters || Math.round(leg.mins * 80)} m</div><div class="muted">${fmtMin(leg.mins)}</div></div>`;
    }
    const eta = leg.etaMin != null ? `<span class="eta">${Math.round(leg.etaMin)} ${t("min")}</span>` : `<span class="muted">${t("wait")} ${fmtMin(leg.wait || 0)}</span>`;
    const label = `${coLabel(leg.co)} ${leg.route}`;
    return `<div class="leg"><div class="badge ${leg.type}" style="${leg.color ? `background:${leg.color};color:#fff` : ""}">${esc(leg.route)}</div>
      <div><strong>${esc(label)}</strong><div class="muted">${esc(leg.from)} → ${esc(leg.to)}${leg.destName ? " · " + esc(leg.destName) : ""}</div></div>
      <div>${eta}</div></div>`;
  }

  function fmtMin(n) {
    n = Math.max(0, n);
    const m = Math.round(n);
    return `${m} ${t("min")}`;
  }
  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function drawTrip(tr) {
    state.layer.clearLayers();
    if (!tr) return;
    const pts = [];
    if (state.origin) {
      L.circleMarker([state.origin.lat, state.origin.lng], { radius: 8, color: "#2ee0c0", fillColor: "#2ee0c0", fillOpacity: 1 }).addTo(state.layer).bindTooltip("A");
      pts.push([state.origin.lat, state.origin.lng]);
    }
    if (state.dest) {
      L.circleMarker([state.dest.lat, state.dest.lng], { radius: 8, color: "#ff6b6b", fillColor: "#ff6b6b", fillOpacity: 1 }).addTo(state.layer).bindTooltip("B");
      pts.push([state.dest.lat, state.dest.lng]);
    }
    if (tr.board && tr.board.location) {
      L.circleMarker([tr.board.location.lat, tr.board.location.lng], { radius: 6, color: "#f4c15d" }).addTo(state.layer);
      pts.push([tr.board.location.lat, tr.board.location.lng]);
    }
    if (pts.length >= 2) {
      L.polyline(pts, { color: "#2ee0c0", weight: 3, dashArray: "6 8", opacity: 0.7 }).addTo(state.layer);
      state.map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
    }
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
        state.map.setView([lat, lng], 15);
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
    initMap();
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
    window.addEventListener("resize", () => state.map && state.map.invalidateSize());
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
