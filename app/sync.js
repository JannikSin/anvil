// Sync: the record on this phone, mirrored to the two GitHub data repos with the token the
// phone already holds (anvil.pat, saved by the old Anvil's Setup; same origin, same key).
//
//   fitness/daily.json  in mise-data: SHARED with Mise. Patched field by field at write time, on
//                       the freshest copy, so Mise's fields (water, dailyDozen) are never dropped.
//   workouts.json       in anvil-data: sessions upserted by id (the merge key); templates,
//                       schedule and programVersion are left exactly as they are.
//   profile.json        in anvil-data: the person's profile, READ only. The public app ships a blank
//                       template (profile.js); this private copy is kept on the phone as profile.mine
//                       so an offline open still has it. A 404 or a failed read keeps the last copy.
//
// Every local write goes into an outbox first (synchronously, localStorage), then flushes. A pull
// rebuilds the local mirror from the repos and re-applies whatever is still in the outbox, so an
// unsent tick is never overwritten by an older remote copy.
(function (root) {
  "use strict";
  var API = "https://api.github.com";
  var MISE = { owner: "JannikSin", repo: "mise-data" };
  var DAILY = "fitness/daily.json", WORKOUTS = "workouts.json", ACTIVITIES = "activities.json", PROFILE = "profile.json";
  // local field -> shared daily.json field
  var FIELD = { sleep: "sleepHours" };
  var BACK = { sleepHours: "sleep" };
  var MINE = ["weight", "sleep", "pushups", "supplements", "routine", "waist"];

  function anvilRepo() {
    var raw = "";
    try { raw = (localStorage.getItem("anvil.dataRepo") || "").trim(); } catch (e) {}
    var m = raw.match(/^([\w.-]+)\/([\w.-]+)$/);
    return m ? { owner: m[1], repo: m[2] } : { owner: "JannikSin", repo: "anvil-data" };
  }
  function token() { try { return localStorage.getItem("anvil.pat"); } catch (e) { return null; } }
  function b64dec(s) { return decodeURIComponent(escape(atob(s.replace(/\n/g, "")))); }
  function b64enc(s) { return btoa(unescape(encodeURIComponent(s))); }
  function headers() { return { Authorization: "Bearer " + token(), Accept: "application/vnd.github+json" }; }

  function getFile(repo, path) {
    return fetch(API + "/repos/" + repo.owner + "/" + repo.repo + "/contents/" + path + "?t=" + Date.now(), { headers: headers(), cache: "no-store" })
      .then(function (r) {
        if (r.status === 404) return { json: null, sha: null };
        if (!r.ok) throw new Error("GET " + path + " " + r.status);
        return r.json().then(function (j) { return { json: JSON.parse(b64dec(j.content)), sha: j.sha }; });
      });
  }
  function putFile(repo, path, json, sha, msg) {
    var body = { message: msg, content: b64enc(JSON.stringify(json, null, 2) + "\n") };
    if (sha) body.sha = sha;
    return fetch(API + "/repos/" + repo.owner + "/" + repo.repo + "/contents/" + path, {
      method: "PUT", headers: Object.assign({ "Content-Type": "application/json" }, headers()), body: JSON.stringify(body)
    }).then(function (r) { if (!r.ok) { var e = new Error("PUT " + path + " " + r.status); e.status = r.status; throw e; } });
  }
  // read-modify-write with a fresh sha; a conflict (another writer got in first) retries on the new copy
  function update(repo, path, fn, msg, tries) {
    tries = tries || 0;
    return getFile(repo, path).then(function (f) {
      var next = fn(f.json);
      if (!next) return;
      return putFile(repo, path, next, f.sha, msg).catch(function (e) {
        if ((e.status === 409 || e.status === 422) && tries < 3) return update(repo, path, fn, msg, tries + 1);
        throw e;
      });
    });
  }

  // ---------- shape mapping (pure, tested under node) ----------
  // one nested patch onto one shared row: a null deletes, objects merge key by key
  function patchRow(row, patch) {
    row = Object.assign({}, row);
    Object.keys(patch).forEach(function (f) {
      var rf = FIELD[f] || f, v = patch[f];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        var g = Object.assign({}, row[rf] || {});
        Object.keys(v).forEach(function (k) { if (v[k] === null) delete g[k]; else g[k] = v[k]; });
        row[rf] = g;
      } else if (v === null) delete row[rf];
      else row[rf] = v;
    });
    return row;
  }
  function applyDaily(file, outbox) {
    var doc = file && Array.isArray(file.days) ? { days: file.days.slice() } : Object.assign({}, file || {}, { days: (file && file.days) || [] });
    outbox.forEach(function (o) {
      var i = doc.days.findIndex(function (r) { return r.date === o.date; });
      var row = patchRow(i >= 0 ? doc.days[i] : { date: o.date }, o.patch);
      if (i >= 0) doc.days[i] = row; else doc.days.push(row);
    });
    doc.days.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return Object.assign({}, file || {}, { days: doc.days });
  }
  function dailyToLocal(file) {
    var out = {};
    ((file && file.days) || []).forEach(function (r) {
      var row = {};
      Object.keys(r).forEach(function (k) {
        var lk = BACK[k] || k;
        if (MINE.indexOf(lk) !== -1) row[lk] = r[k];
      });
      out[r.date] = row;
    });
    return out;
  }
  function norm(s) { return String(s || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
  function findLift(P, template, name) {
    var n = norm(name), tpl = P.sessions[template];
    var hit = tpl && tpl.lifts.filter(function (l) { return norm(l.name) === n; })[0];
    if (hit) return hit;
    for (var k in P.sessions) {
      hit = P.sessions[k].lifts.filter(function (l) { return norm(l.name) === n; })[0];
      if (hit) return hit;
    }
    return null;
  }
  function topSet(sets) {
    var best = null;
    (sets || []).forEach(function (s) {
      if (s == null || s.reps == null) return;
      var w = s.weight == null ? 0 : +s.weight;
      if (!best || w > best.w || (w === best.w && s.reps > best.r)) best = { w: w, r: +s.reps };
    });
    return best;
  }
  function sessionToLocal(s, P) {
    var tpl = P.sessions[s.templateId] ? s.templateId : null;
    var lifts = {};
    (s.exercises || []).forEach(function (ex) {
      var l = findLift(P, tpl, ex.name), top = topSet(ex.sets);
      var id = l ? l.id : norm(ex.name).replace(/ /g, "-");
      var key = l ? (l.progressKey || l.id) : id;
      if (!top && !ex.note) return;
      lifts[id] = { key: key, w: top ? top.w : null, r: top ? top.r : null, note: ex.note || undefined, why: ex.why || undefined };
    });
    var rec = { id: s.id || ("r" + s.date + (s.templateId || "")), programme: tpl && s.date >= P.start ? P.id : "earlier", template: s.templateId || null, date: s.date, lifts: lifts, remote: true };
    if (s.minutes) rec.minutes = s.minutes;
    return rec;
  }
  function sessionToRemote(rec, P) {
    var tpl = P.sessions[rec.template];
    var ex = Object.keys(rec.lifts || {}).map(function (lid) {
      var t = rec.lifts[lid], l = tpl && tpl.lifts.filter(function (x) { return x.id === lid; })[0];
      var e = { name: l ? l.name : lid, sets: t.r != null ? [{ weight: t.w == null ? 0 : t.w, reps: t.r }] : [] };
      if (t.note) e.note = t.note;
      if (t.why) e.why = t.why;
      return e;
    });
    var out = { date: rec.date, templateId: rec.template, exercises: ex, id: rec.id };
    if (rec.minutes) out.minutes = rec.minutes;
    return out;
  }
  // activities: local {id, date, kind, minutes, conditioning} <-> v1's {id, date, type, minutes}
  function activityToRemote(a) { return { id: a.id, date: a.date, type: a.kind, minutes: a.minutes }; }
  function activityToLocal(a) {
    var kind = String(a.type || a.kind || "other").toLowerCase();
    return { id: a.id, date: a.date, kind: kind, minutes: +a.minutes || 0, conditioning: kind === "tennis" || kind === "run" };
  }
  function applyActivities(file, local, ob) {
    var doc = Object.assign({}, file || {});
    var xs = (Array.isArray(doc.activities) ? doc.activities : []).filter(function (a) { return ob.del.indexOf(a.id) === -1; });
    ob.put.forEach(function (id) {
      var a = local.filter(function (x) { return x.id === id; })[0];
      if (!a) return;
      var i = xs.findIndex(function (x) { return x.id === id; });
      if (i >= 0) xs[i] = activityToRemote(a); else xs.push(activityToRemote(a));
    });
    doc.activities = xs;
    return doc;
  }

  // a profile is an object with a training section; anything else is ignored, never stored
  function isProfile(j) { return !!(j && typeof j === "object" && !Array.isArray(j) && j.training && typeof j.training === "object"); }

  function upsertSession(file, remoteRec) {
    var doc = Object.assign({}, file || {});
    var ss = Array.isArray(doc.sessions) ? doc.sessions.slice() : [];
    var i = ss.findIndex(function (s) { return s.id === remoteRec.id; });
    if (i >= 0) ss[i] = remoteRec; else ss.push(remoteRec);
    doc.sessions = ss;
    return doc;
  }

  // ---------- the runtime side: outbox, flush, pull ----------
  function make(store, P, onChange) {
    var busy = false, last = { ok: null, at: null, msg: "" };
    function has() { return !!token(); }
    // typing a note fires on every key: gather a burst into one commit
    var timer = null;
    function soon() { clearTimeout(timer); timer = setTimeout(function () { flush().then(retry); }, 2500); }
    // something still unsent: right away if the last push worked, a minute later if it failed
    function retry() {
      if (!pending()) return;
      var ok = (store.get("sync.last", {}) || {}).ok;
      clearTimeout(timer); timer = setTimeout(function () { flush().then(retry); }, ok ? 2500 : 60000);
    }
    function queueDay(date, patch) {
      var ob = store.get("outbox.daily", []);
      ob.push({ date: date, patch: patch });
      store.set("outbox.daily", ob);
      soon();
    }
    function queueSession(id) {
      var ob = store.get("outbox.sessions", []);
      if (ob.indexOf(id) === -1) ob.push(id);
      store.set("outbox.sessions", ob);
      soon();
    }
    function queueActivity(id, removed) {
      var ob = store.get("outbox.activities", { put: [], del: [] });
      ob.put = ob.put.filter(function (x) { return x !== id; });
      ob.del = ob.del.filter(function (x) { return x !== id; });
      (removed ? ob.del : ob.put).push(id);
      store.set("outbox.activities", ob);
      soon();
    }
    function pending() {
      var oa = store.get("outbox.activities", { put: [], del: [] });
      return store.get("outbox.daily", []).length + store.get("outbox.sessions", []).length + oa.put.length + oa.del.length;
    }
    function flush() {
      if (!has() || busy) return Promise.resolve();
      var od = store.get("outbox.daily", []), os = store.get("outbox.sessions", []);
      var oa = store.get("outbox.activities", { put: [], del: [] });
      if (!od.length && !os.length && !oa.put.length && !oa.del.length) return Promise.resolve();
      busy = true;
      var p = Promise.resolve();
      if (od.length) p = p.then(function () {
        return update(MISE, DAILY, function (f) { return applyDaily(f, od); }, "anvil: check-in and routine").then(function () {
          // drop only what was sent; anything queued meanwhile stays
          var now = store.get("outbox.daily", []);
          store.set("outbox.daily", now.slice(od.length));
        });
      });
      if (os.length) p = p.then(function () {
        var recs = store.get("sessions", []).filter(function (s) { return os.indexOf(s.id) !== -1; });
        return update(anvilRepo(), WORKOUTS, function (f) {
          var doc = f || { sessions: [] };
          recs.forEach(function (r) { doc = upsertSession(doc, sessionToRemote(r, P)); });
          return doc;
        }, "anvil: session").then(function () {
          store.set("outbox.sessions", store.get("outbox.sessions", []).filter(function (id) { return os.indexOf(id) === -1; }));
        });
      });
      if (oa.put.length || oa.del.length) p = p.then(function () {
        return update(anvilRepo(), ACTIVITIES, function (f) { return applyActivities(f, store.get("activities", []), oa); }, "anvil: activity").then(function () {
          var now = store.get("outbox.activities", { put: [], del: [] });
          store.set("outbox.activities", {
            put: now.put.filter(function (id) { return oa.put.indexOf(id) === -1; }),
            del: now.del.filter(function (id) { return oa.del.indexOf(id) === -1; })
          });
        });
      });
      return p.then(function () { last = { ok: true, at: Date.now(), msg: "" }; },
        function (e) { last = { ok: false, at: Date.now(), msg: String(e && e.message || e) }; })
        .then(function () { busy = false; store.set("sync.last", last); if (onChange) onChange(); });
    }
    function pull() {
      if (!has()) return Promise.resolve();
      return flush().then(function () {
        // the profile is read on its own terms: a missing file or a failed read keeps the last copy
        // and never fails the record's sync
        var prof = getFile(anvilRepo(), PROFILE).catch(function () { return { json: null, sha: null }; });
        return Promise.all([getFile(MISE, DAILY), getFile(anvilRepo(), WORKOUTS), getFile(anvilRepo(), ACTIVITIES), prof]);
      }).then(function (fs) {
        if (isProfile(fs[3].json)) store.set("profile.mine", fs[3].json);
        var daily = dailyToLocal(fs[0].json);
        // whatever is still unsent wins over the remote copy
        store.get("outbox.daily", []).forEach(function (o) {
          var row = daily[o.date] || {};
          Object.keys(o.patch).forEach(function (f) {
            var v = o.patch[f];
            if (v && typeof v === "object" && !Array.isArray(v)) {
              var g = Object.assign({}, row[f] || {});
              Object.keys(v).forEach(function (k) { if (v[k] === null) delete g[k]; else g[k] = v[k]; });
              row[f] = g;
            } else if (v === null) delete row[f]; else row[f] = v;
          });
          daily[o.date] = row;
        });
        store.set("daily", daily);
        var remote = ((fs[1].json && fs[1].json.sessions) || []).map(function (s) { return sessionToLocal(s, P); });
        var pending = store.get("outbox.sessions", []);
        var local = store.get("sessions", []).filter(function (s) { return pending.indexOf(s.id) !== -1; });
        var byId = {};
        remote.forEach(function (s) { byId[s.id] = s; });
        local.forEach(function (s) { byId[s.id] = s; });
        var all = Object.keys(byId).map(function (k) { return byId[k]; });
        all.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
        all.forEach(function (s, i) { s.seq = i + 1; });
        store.set("sessions", all);
        // activities: GitHub's list, plus anything still unsent, minus anything removed and unsent
        var oa = store.get("outbox.activities", { put: [], del: [] });
        var mine = store.get("activities", []);
        var acts = ((fs[2].json && fs[2].json.activities) || []).map(activityToLocal).filter(function (a) { return oa.del.indexOf(a.id) === -1 && oa.put.indexOf(a.id) === -1; });
        mine.forEach(function (a) { if (oa.put.indexOf(a.id) !== -1) acts.push(a); });
        store.set("activities", acts);
        last = { ok: true, at: Date.now(), msg: "" };
        store.set("sync.last", last);
        if (onChange) onChange();
      }, function (e) {
        last = { ok: false, at: Date.now(), msg: String(e && e.message || e) };
        store.set("sync.last", last);
        if (onChange) onChange();
      });
    }
    return { has: has, queueDay: queueDay, queueSession: queueSession, queueActivity: queueActivity, pending: pending, flush: flush, pull: pull };
  }

  var api = { make: make, patchRow: patchRow, applyDaily: applyDaily, dailyToLocal: dailyToLocal, sessionToLocal: sessionToLocal, sessionToRemote: sessionToRemote, upsertSession: upsertSession, topSet: topSet, norm: norm, applyActivities: applyActivities, activityToLocal: activityToLocal, isProfile: isProfile };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.AnvilSync = api;
})(this);
