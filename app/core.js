// Anvil core: pure functions over the record. No DOM here, so the same file runs in the page
// and under node for the day-walk test (test/walk.js).

(function (root) {
  "use strict";

  // ---------- dates: the date is data, never the clock at write time (DOCTRINE invariant) ----------
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dateKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseKey(k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function addDays(k, n) { var d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d); }
  function weekday(k) { return parseKey(k).getDay(); }
  function weekStart(k) { return addDays(k, -weekday(k)); }            // weeks run Sunday to Saturday, as Block 1 does
  function daysBetween(a, b) { return Math.round((parseKey(b) - parseKey(a)) / 86400000); }
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function label(k) { var d = parseKey(k); return DAYS[d.getDay()] + " " + (d.getMonth() + 1) + "/" + d.getDate(); }
  function longLabel(k) { var d = parseKey(k); return DAYS[d.getDay()] + " " + MONTHS[d.getMonth()] + " " + d.getDate(); }
  function hm(t) { // "22:45" -> "10:45 pm"
    if (!t) return "";
    var p = t.split(":"), h = +p[0], m = p[1];
    return ((h % 12) || 12) + ":" + m + (h < 12 ? " am" : " pm");
  }
  function minutesOf(t) { var p = t.split(":"); return +p[0] * 60 + +p[1]; }
  function addMinutes(t, n) { var m = minutesOf(t) + n; return pad(Math.floor(m / 60) % 24) + ":" + pad(m % 60); }

  // ---------- storage: every key anvil-prefixed (decision 0006); writes are synchronous ----------
  // "anvil.v2." keeps this record apart from the first Anvil's keys on the same origin (its
  // anvil.draft has a different shape); still anvil-prefixed, so no sibling app is touched.
  var PREFIX = "anvil.v2.";
  function makeStore(backing) {
    function get(k, dflt) {
      try { var v = backing.getItem(PREFIX + k); return v == null ? dflt : JSON.parse(v); } catch (e) { return dflt; }
    }
    function set(k, v) { backing.setItem(PREFIX + k, JSON.stringify(v)); }
    function del(k) { backing.removeItem(PREFIX + k); }
    return { get: get, set: set, del: del };
  }

  // The shared daily row is patched field by field, never rewritten (incident 2026-08).
  // A nested group (supplements, routine) is patched key by key inside it, so ticking one
  // supplement can never drop another.
  function upsertDay(store, date, patch) {
    var all = store.get("daily", {});
    var row = all[date] || {};
    Object.keys(patch).forEach(function (f) {
      var v = patch[f];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        var g = Object.assign({}, row[f] || {});
        Object.keys(v).forEach(function (k) { if (v[k] === null) delete g[k]; else g[k] = v[k]; });
        row[f] = g;
      } else if (v === null) { delete row[f]; }
      else { row[f] = v; }
    });
    all[date] = row;
    store.set("daily", all);
    return row;
  }
  function day(store, date) { return store.get("daily", {})[date] || {}; }

  function uid() { return "s" + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6); }

  // ---------- profile: the code reads, the training section is the only thing it writes ----------
  function merge(a, b) {
    if (!b || typeof b !== "object" || Array.isArray(b)) return b === undefined ? a : b;
    var out = Object.assign({}, a);
    Object.keys(b).forEach(function (k) { out[k] = (a && typeof a[k] === "object" && !Array.isArray(a[k])) ? merge(a[k], b[k]) : b[k]; });
    return out;
  }
  function profile(store, seed) { return merge(seed, { training: store.get("profile.training", {}) }); }
  function saveTraining(store, patch) { store.set("profile.training", merge(store.get("profile.training", {}), patch)); }

  // ---------- programme gate: P13 and P12, run before anything is drawn ----------
  var GROUPS = ["chest", "back", "shoulders", "arms", "quads", "hamstrings", "core"];
  var RANGE = { lo: 10, hi: 20 };   // hard sets per muscle group per week (Training-Recipe table, the Nippard range)

  function planCheck(P, perWeek) {
    var gaps = [], sets = {}, freq = {};
    var cycle = P.queue.length, scale = (perWeek || cycle) / cycle;
    P.queue.forEach(function (sid) {
      var s = P.sessions[sid];
      if (!s) { gaps.push("The queue names " + sid + ", which the programme does not hold"); return; }
      s.lifts.forEach(function (l) {
        if (!l.source || !l.source.who) gaps.push(l.name + " has no source, so it cannot enter the programme (P13)");
        if (!l.cue) gaps.push(l.name + " has no cue (P13)");
        Object.keys(l.m || {}).forEach(function (g) {
          sets[g] = (sets[g] || 0) + l.sets * l.m[g] * scale;
          (freq[g] = freq[g] || {})[sid] = 1;
        });
      });
    });
    GROUPS.forEach(function (g) {
      var n = Math.round((sets[g] || 0) * 2) / 2;
      sets[g] = n;
      if (n < RANGE.lo) gaps.push(cap(g) + ": " + n + " hard sets a week, under the " + RANGE.lo + " to " + RANGE.hi + " range");
      if (n > RANGE.hi) gaps.push(cap(g) + ": " + n + " hard sets a week, over the " + RANGE.hi + " ceiling");
      if (Object.keys(freq[g] || {}).length < 2) gaps.push(cap(g) + " is trained in fewer than two sessions");
    });
    if (!P.conditioning || P.conditioning.perWeek < 1) gaps.push("No conditioning session in the week (tenet 1)");
    if (!P.mobility || !P.mobility.days.length) gaps.push("No mobility in the week (tenet 1)");
    return { ok: gaps.length === 0, gaps: gaps, sets: sets, range: RANGE, groups: GROUPS };
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ---------- the queue: completion, never the weekday (P1, P9) ----------
  function sessions(store) { return store.get("sessions", []); }
  function filedFor(store, P) { return sessions(store).filter(function (s) { return s.programme === P.id; }); }
  function nextInQueue(store, P) {
    var n = filedFor(store, P).length;
    return P.queue[n % P.queue.length];
  }

  // ---------- progression: a pure function of the top-set record (P2, decision 0010) ----------
  function pkey(l) { return l.progressKey || l.id; }
  function history(store, key) {
    var out = [];
    sessions(store).slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.seq || 0) - (b.seq || 0); })
      .forEach(function (s) {
        Object.keys(s.lifts || {}).forEach(function (lid) {
          var t = s.lifts[lid];
          if (t && t.key === key && t.w != null) out.push({ date: s.date, w: t.w, r: t.r, note: t.note });
        });
      });
    return out;
  }
  // the newest note left on this lift (any day it appears), so a question or a form concern
  // written last time is on screen the next time (David, 10/16)
  function lastNote(store, key) {
    var hit = null;
    sessions(store).forEach(function (s) {
      Object.keys(s.lifts || {}).forEach(function (lid) {
        var t = s.lifts[lid];
        if (t && t.key === key && t.note && String(t.note).trim() && (!hit || s.date >= hit.date)) hit = { date: s.date, note: t.note };
      });
    });
    return hit;
  }
  function prescribe(l, hist, startLoads) {
    var key = pkey(l);
    if (!hist.length) {
      if (l.load === "bodyweight") return { w: 0, r: l.lo, move: "First time: aim for " + l.lo + " clean reps", first: true };
      if (l.load === "added") return { w: 0, r: l.lo, move: "First time: start at bodyweight (0 lb added) unless you know your number", first: true };
      if (startLoads && startLoads[key] != null) return { w: startLoads[key], r: l.lo, move: "From your profile (now: " + startLoads[key] + "). Adjust once; after today it is your record", first: true, fromProfile: true };
      return { w: null, r: l.lo, move: "First time: set the weight once. The app will not guess it", first: true };
    }
    var last = hist[hist.length - 1];
    var stall = hist.length >= 3 && hist.slice(-3).every(function (h) { return h.w === last.w && h.r === last.r; });
    var p;
    if (last.r >= l.hi) {
      if (!l.inc) p = { w: last.w, r: l.hi, move: "Top of the range at bodyweight: slow the lowering or add a light DB" };
      else p = { w: last.w + l.inc, r: l.lo, move: "+" + l.inc + " lb: you hit " + last.r + " at " + last.w + " last time. Back to " + l.lo + " reps" };
    } else {
      p = { w: last.w, r: last.r + 1, move: "Same weight, one more rep than last time (" + last.w + " x " + last.r + ")" };
    }
    p.stall = stall;
    if (stall) p.stallNote = "Same load and reps three times in a row. Make the reps cleaner today; if it holds again, it goes on the week-review list";
    p.last = last;
    return p;
  }

  // ---------- session time, from the sets and rests actually prescribed (P12, decision 0011) ----------
  var WORK = 45; // seconds per working set, per side
  function liveSets(l, date, P) { return inDeload(date, P) ? Math.ceil(l.sets / 2) : l.sets; }
  function estimateMinutes(s, date, P) {
    var secs = 0, seenPair = {};
    s.lifts.forEach(function (l, i) {
      var n = liveSets(l, date, P), w = WORK * (l.side ? 2 : 1);
      if (i === 0) secs += (l.ramp || 2) * 60;
      if (l.pair) {
        var mates = s.lifts.filter(function (x) { return x.pair === l.pair; });
        if (seenPair[l.pair]) return;
        seenPair[l.pair] = 1;
        var rounds = Math.max.apply(null, mates.map(function (x) { return liveSets(x, date, P); }));
        mates.forEach(function (x) { secs += liveSets(x, date, P) * WORK * (x.side ? 2 : 1); });
        secs += rounds * l.rest + 60; // rest after each pair, plus setting up two stations
      } else {
        secs += n * w + n * l.rest + 30;
      }
    });
    return Math.round(secs / 60);
  }
  function effort(l, date, P) { return inDeload(date, P) ? "3 to 4 RIR, deload" : (l.effortText || P.effort[l.kind]); }
  function restLabel(l) {
    var s = l.rest; var m = Math.floor(s / 60), r = s % 60;
    var t = m + ":" + pad(r);
    if (l.pair) return t + " after the pair";
    return t;
  }

  // ---------- block calendar (Training-Recipe section 6) ----------
  function inDeload(date, P) { return !!P.deload && date >= P.deload.start && date <= P.deload.end; }
  function blockWeek(date, P) {
    if (date < P.start) return null;
    if (inDeload(date, P)) return "deload";
    if (date > P.end) return "after";
    return Math.floor(daysBetween(P.start, date) / 7) + 1;
  }
  function sessionsUntil(from, to, perWeek) { var d = daysBetween(from, to); return d <= 0 ? 0 : Math.floor(d / 7 * perWeek); }

  // ---------- body weight trend: the 7-day average (Training-Recipe section 5) ----------
  function avg7(store, date) {
    var all = store.get("daily", {}), xs = [];
    for (var i = 0; i < 7; i++) { var r = all[addDays(date, -i)]; if (r && r.weight != null) xs.push(r.weight); }
    if (!xs.length) return null;
    return Math.round(xs.reduce(function (a, b) { return a + b; }, 0) / xs.length * 10) / 10;
  }
  function lastValue(store, date, field) {
    var all = store.get("daily", {});
    var keys = Object.keys(all).filter(function (k) { return k < date && all[k][field] != null; }).sort();
    return keys.length ? { date: keys[keys.length - 1], v: all[keys[keys.length - 1]][field] } : null;
  }

  // ---------- activities: everything trained is in the record (P5) ----------
  function activities(store) { return store.get("activities", []); }
  function conditioningThisWeek(store, date) {
    var ws = weekStart(date), we = addDays(ws, 6);
    return activities(store).filter(function (a) { return a.conditioning && a.date >= ws && a.date <= we; });
  }

  // ---------- the routine card, in the order the day happens (P14, decision 0003) ----------
  function wallSquatsThisWeek(store, date) {
    var all = store.get("daily", {}), ws = weekStart(date), n = 0;
    for (var i = 0; i < 7; i++) { var r = all[addDays(ws, i)]; if (r && r.routine && r.routine.wallsquat) n++; }
    return n;
  }
  function sessionFiledOn(store, date) { return sessions(store).filter(function (s) { return s.date === date; }); }

  function routine(store, date, prof, P) {
    var T = prof.training, wd = weekday(date), weekend = wd === 0 || wd === 6;
    var times = weekend ? T.days.weekend : T.days.weekday;
    var row = day(store, date), r = row.routine || {}, sup = row.supplements || {};
    var y = addDays(date, -1), yrow = day(store, y);
    var morning = [], dayItems = [], evening = [];
    var hasCheckin = row.weight != null || row.sleep != null || row.pushups != null;

    morning.push({ key: "wake", label: "Up, standing. The Watch is the alarm", time: times.wake, kind: "tick", done: !!r.wake });
    morning.push({ key: "weigh", label: "Bathroom, then weigh in", time: null, kind: "checkin", done: row.weight != null, detail: "Before water or food. Recorded by the check-in" });
    morning.push({ key: "pushups", label: T.pushups + " push-ups", time: null, kind: "checkin", done: row.pushups != null, detail: "Recorded by the check-in" });
    morning.push({ key: "checkin", label: "Check-in: weight, sleep, push-ups", time: null, kind: "checkin", done: hasCheckin, remind: addMinutes(times.wake, 10) });
    // Lights out is a clock fact about last night, ticked this morning. It is recorded on TODAY's row
    // (routine.lightsOutLastNight): the app never writes to a past day (David, 10/13).
    var yWd = weekday(y);
    if (T.evening.rulesOn.indexOf(yWd) !== -1) {
      morning.push({ key: "lightsOutLastNight", label: "Lights out by " + hm(T.evening.lightsOut) + " last night", time: null, kind: "tick", done: !!r.lightsOutLastNight, detail: "A clock fact, ticked this morning" });
    }
    // The order the morning actually happens (David, 10/16): supplements with breakfast at home,
    // out the door, then the gym at the CoRec, shower there, straight to class. Nothing is taken
    // after leaving except what goes with the noon caffeine.
    T.supplements.filter(function (s) { return s.when === "morning"; }).forEach(function (s, i) {
      morning.push({ key: s.id, label: s.name + " " + s.dose, time: i === 0 ? times.supps : null, kind: "supp", done: !!sup[s.id], remind: times.supps, group: "breakfast supplements" });
    });
    if (times.out) morning.push({ key: "out", label: "Out the door", time: times.out, kind: "tick", done: !!r.out });
    var filed = sessionFiledOn(store, date);
    morning.push({ key: "gym", label: "Gym at the CoRec, shower there, then class", time: times.gym, kind: "session", done: filed.length > 0, remind: addMinutes(times.gym, 80), detail: filed.length ? "Filed: " + filed.map(function (s) { return P.sessions[s.template] ? P.sessions[s.template].name : s.template; }).join(", ") : "Opens the Gym tab" });

    T.supplements.filter(function (s) { return s.when === "noon"; }).forEach(function (s, i) {
      dayItems.push({ key: s.id, label: s.name + " " + s.dose, time: i === 0 ? T.noon : null, kind: "supp", done: !!sup[s.id], remind: T.noon, group: "noon caffeine", detail: s.note || null });
    });
    dayItems.push({ key: "water", label: "Water, " + T.water.what, time: null, kind: "tick", done: !!r.water, remind: T.water.remind });
    if (wd === P.conditioning.day) {
      var c = conditioningThisWeek(store, date);
      dayItems.push({ key: "conditioning", label: "Conditioning: " + P.conditioning.what, time: null, kind: "activity", done: c.length > 0, detail: c.length ? "Logged: " + c.map(function (a) { return a.kind + " " + a.minutes + " min, " + label(a.date); }).join("; ") : null });
    }
    if (wd === 0) dayItems.push({ key: "waist", label: "Waist, measured at the navel", time: null, kind: "number", done: row.waist != null, value: row.waist, detail: "Weekly, next to the 7-day weight average" });

    var rules = T.evening.rulesOn.indexOf(wd) !== -1, E = T.evening;
    if (rules) evening.push({ key: "kitchen", label: "Last plate, kitchen closed", time: E.kitchen, kind: "tick", done: !!r.kitchen });
    var mag = T.supplements.filter(function (s) { return s.when === "evening"; });
    mag.forEach(function (s) { evening.push({ key: s.id, label: s.name + " " + s.dose, time: rules ? E.magnesium : null, kind: "supp", done: !!sup[s.id], remind: E.magnesium }); });
    if (P.mobility && P.mobility.days.indexOf(wd) !== -1 && date >= P.mobility.from) {
      evening.push({ key: "mobility", label: "Mobility, about " + Math.round(coreSteps(P, P.mobilitySession).total / 60) + " min, timed", time: null, kind: "mobility", done: !!r.mobility, detail: "Hips, ankles, upper back, serving shoulder" });
    }
    // The Core Session is a must every day (David, 10/13), so it is on the card, not behind a menu.
    var cs = coreForDate(date, P), cdone = r.core;
    evening.push({ key: "core", label: "Core Session: " + (cdone && coreById(P, cdone) ? coreById(P, cdone).name : cs.name) + ", about " + Math.round(coreSteps(P, cdone && coreById(P, cdone) ? coreById(P, cdone) : cs).total / 60) + " min", time: null, kind: "core", done: !!cdone, remind: T.core && T.core.remind, detail: cdone ? "Done" : "On the floor, no equipment. Morning or before bed" });
    evening.push({ key: "firstLine", label: "Tomorrow's first line: one physical action", time: rules ? E.firstLine : null, kind: "text", done: !!(r.firstLine && r.firstLine.trim()), value: r.firstLine || "", remind: E.firstLine });
    evening.push({ key: "read", label: "Read " + T.readWhat, time: rules ? E.read : null, kind: "tick", done: !!r.read });
    if (rules) evening.push({ key: "lightsOutNote", label: "Lights out " + hm(E.lightsOut) + ". Tick it tomorrow morning", time: E.lightsOut, kind: "note", done: false });
    evening.push({ key: "reward", label: "Took it: " + T.reward, time: null, kind: "tick", done: !!r.reward, detail: "Earned when the spine and the day's work are done" });

    return {
      morning: morning, day: dayItems, evening: evening, weekend: weekend,
      lastFirstLine: (yrow.routine && yrow.routine.firstLine) || null
    };
  }

  // ---------- Core Sessions: rotation by date, a timeline built from the data ----------
  function coreById(P, id) {
    if (P.mobilitySession && id === P.mobilitySession.id) return P.mobilitySession;
    return P.core.sessions.filter(function (x) { return x.id === id; })[0] || null;
  }
  function moveOf(P, id) { return P.core.moves[id] || (P.mobilityMoves || {})[id]; }
  function coreForDate(date, P) { var n = P.core.sessions.length, i = ((daysBetween("2026-01-04", date) % n) + n) % n; return P.core.sessions[i]; }
  // Steps: a lead-in, then each move and its rest. Durations in seconds; the clock is derived from
  // a start stamp by the page, so a backgrounded phone never drifts the session.
  function coreSteps(P, cs) {
    var steps = [{ kind: "lead", secs: P.core.leadIn, move: cs.moves[0][0] }], total = P.core.leadIn;
    cs.moves.forEach(function (m, i) {
      steps.push({ kind: "work", secs: m[1], move: m[0] }); total += m[1];
      var next = cs.moves[i + 1];
      if (next && m[2] > 0) { steps.push({ kind: "rest", secs: m[2], move: next[0] }); total += m[2]; }
    });
    var at = 0; steps.forEach(function (s) { s.from = at; at += s.secs; });
    return { steps: steps, total: total };
  }
  function coreAt(P, cs, elapsed) {
    var T = coreSteps(P, cs);
    if (elapsed >= T.total) return { done: true, total: T.total };
    for (var i = 0; i < T.steps.length; i++) {
      var s = T.steps[i];
      if (elapsed < s.from + s.secs) return { i: i, step: s, left: Math.ceil(s.from + s.secs - elapsed), next: T.steps[i + 1] || null, total: T.total, steps: T.steps };
    }
  }

  // Which items a reminder may fire for right now: due, unrecorded, today only (P15).
  // Read from the record at the moment of asking, so a recorded item can never fire.
  function dueNow(store, today, nowHM, prof, P) {
    var R = routine(store, today, prof, P), out = [];
    [].concat(R.morning, R.day, R.evening).forEach(function (it) {
      // only the items decision 0004 names carry a reminder: check-in, supplements, the session,
      // water and the evening routine. The wake line is the Watch's job, not a notification's.
      var at = it.remind;
      if (!at || it.done || it.kind === "note") return;
      if (minutesOf(nowHM) >= minutesOf(at)) out.push(it);
    });
    // supplements share one reminder per group
    var seen = {}, merged = [];
    out.forEach(function (it) {
      var k = it.group || it.key;
      if (seen[k]) { seen[k].names.push(it.label); return; }
      seen[k] = { key: k, label: it.group ? it.group : it.label, names: [it.label], kind: it.kind };
      merged.push(seen[k]);
    });
    return merged;
  }

  // ---------- the phone-reminder server's copy of today (decision 0004 via ntfy) ----------
  // The server cannot read the record, so the page hands it today's reminder items with their
  // recorded state every time the record changes. It fires only for what is still open.
  // atMs(date, "HH:MM") turns a profile time into an instant on this device's clock.
  function pushDay(store, date, prof, P, atMs) {
    var R = routine(store, date, prof, P), items = [];
    [].concat(R.morning, R.day, R.evening).forEach(function (it) {
      if (!it.remind || it.kind === "note") return;
      items.push({ key: it.key, label: it.label, group: it.group || null, at: atMs(date, it.remind), done: !!it.done });
    });
    var rem = prof.training.reminders;
    return { date: date, on: !!rem.on, every: rem.repeatMinutes * 60000, from: atMs(date, "00:00"), until: atMs(addDays(date, 1), "00:00"), items: items };
  }

  // ---------- filing a session: id is the merge key (decision 0007); partial counts (decision 0009) ----------
  function fileSession(store, draft, P) {
    var logged = {};
    Object.keys(draft.lifts || {}).forEach(function (lid) {
      var t = draft.lifts[lid];
      if (t.logged || (t.note && t.note.trim())) logged[lid] = { key: t.key, w: t.logged ? t.w : null, r: t.logged ? t.r : null, note: t.note || undefined };
    });
    var all = sessions(store);
    var seq = all.length ? Math.max.apply(null, all.map(function (s) { return s.seq || 0; })) + 1 : 1;
    var rec = { id: draft.id, programme: P.id, template: draft.template, date: draft.date, lifts: logged, seq: seq };
    var i = all.findIndex(function (s) { return s.id === rec.id; });
    if (i >= 0) all[i] = rec; else all.push(rec);
    store.set("sessions", all);
    store.del("draft");
    return rec;
  }

  // A draft left from an earlier day: what was logged then was recorded then, so it is filed under
  // its own date and nothing is lost. Returns the filed record (the caller must queue it for sync,
  // or the next pull drops it: Tribunal 10/17), or null when the draft held nothing.
  function fileStaleDraft(store, today, P) {
    var old = store.get("draft", null);
    if (!old || old.date === today) return null;
    var kept = Object.keys(old.lifts || {}).some(function (k) { return old.lifts[k].logged || old.lifts[k].note; });
    if (!kept) { store.del("draft"); return null; }
    return fileSession(store, old, P);
  }

  // Secrets never leave the phone in an export, and an import never replaces them: the GitHub
  // token, and the reminder server's pairing (its url and bearer key, Tribunal 10/17).
  var SECRET = ["anvil.pat", "anvil.v2.push"];
  function portableKey(k) {
    return k.indexOf("anvil.") === 0 && !SECRET.some(function (p) { return k.indexOf(p) === 0; });
  }

  var api = {
    dateKey: dateKey, parseKey: parseKey, addDays: addDays, weekday: weekday, weekStart: weekStart, daysBetween: daysBetween,
    label: label, longLabel: longLabel, hm: hm, minutesOf: minutesOf, addMinutes: addMinutes, DAYS: DAYS,
    makeStore: makeStore, upsertDay: upsertDay, day: day, uid: uid,
    profile: profile, saveTraining: saveTraining,
    planCheck: planCheck, nextInQueue: nextInQueue, filedFor: filedFor, sessions: sessions,
    pkey: pkey, history: history, prescribe: prescribe,
    estimateMinutes: estimateMinutes, liveSets: liveSets, effort: effort, restLabel: restLabel,
    inDeload: inDeload, blockWeek: blockWeek, sessionsUntil: sessionsUntil,
    avg7: avg7, lastValue: lastValue, activities: activities, conditioningThisWeek: conditioningThisWeek,
    wallSquatsThisWeek: wallSquatsThisWeek, sessionFiledOn: sessionFiledOn,
    routine: routine, dueNow: dueNow, fileSession: fileSession, fileStaleDraft: fileStaleDraft, portableKey: portableKey, lastNote: lastNote, moveOf: moveOf,
    coreById: coreById, coreForDate: coreForDate, coreSteps: coreSteps, coreAt: coreAt, pushDay: pushDay
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.AnvilCore = api;
})(this);
