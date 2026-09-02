
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
      legs.push({
        type: "mtr",
        co: last.co || "mtr",
        route: line,
        from: nm(fromStop.name || { en: start.id, zh: start.id }),
        to: nm((toStop && toStop.name) || { en: last.to, zh: last.to }),
        destName: line,
        stopId: (fromStop.id || start.id),
        alightId: last.to,
        mins: (j - i) * 2.15,
        wait: i === 0 ? 3.2 : 3.8,
        etaMin: null,
        color: LINE_COLOR[line],
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

