// Anvil, the one page. Everything below renders from the record; every tap writes the record
// synchronously before the page redraws (nothing logged lives only in memory).
(function () {
  "use strict";
  var C = window.AnvilCore, P = window.ANVIL_PROGRAM, SEED = window.ANVIL_PROFILE;
  var app = document.getElementById("app"), sheet = document.getElementById("sheet"), dock = document.getElementById("dock");

  var storageOK = true, mem = {};
  var backing;
  try { localStorage.setItem("anvil.probe", "1"); localStorage.removeItem("anvil.probe"); backing = localStorage; }
  catch (e) { storageOK = false; backing = { getItem: function (k) { return k in mem ? mem[k] : null; }, setItem: function (k, v) { mem[k] = String(v); }, removeItem: function (k) { delete mem[k]; } }; }
  var store = C.makeStore(backing);

  // Sync to the two data repos with the token this phone already holds (sync.js). Every write to
  // the shared daily row also goes to the outbox; a filed session is queued by id.
  var S = window.AnvilSync.make(store, P, function () { if (!sheet.open && !typing()) render(); });
  function typing() { return document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName); }
  var rawUpsert = C.upsertDay;
  C.upsertDay = function (st, date, patch) { var row = rawUpsert(st, date, patch); S.queueDay(date, patch); return row; };

  function today() { return C.dateKey(new Date()); }
  function nowHM() { var d = new Date(); return (d.getHours() < 10 ? "0" : "") + d.getHours() + ":" + (d.getMinutes() < 10 ? "0" : "") + d.getMinutes(); }
  var state = { sel: today(), extra: false, tab: "day" };
  try { if (sessionStorage.getItem("anvil.v2.tab") === "gym") state.tab = "gym"; } catch (e) {}
  function setTab(t) { state.tab = t; try { sessionStorage.setItem("anvil.v2.tab", t); } catch (e) {} render(); window.scrollTo(0, 0); }
  function prof() { return C.profile(store, SEED); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(n) { return n == null ? "" : (Math.round(n * 100) / 100).toString(); }

  // ---------------------------------------------------------------- render
  function render() {
    // Always today. "If I missed a day, I missed a day, it's gone" (David, 10/13): no day picker,
    // nothing is recorded against a past day. The date written is still data, taken at the tap.
    state.sel = today();
    var pr = prof(), sel = state.sel, isToday = true;
    var R = C.routine(store, sel, pr, P), h = [];
    var bw = C.blockWeek(sel, P);
    var sub = bw === null ? "before Block 1" : bw === "deload" ? "Block 1, deload week" : bw === "after" ? "after Block 1" : "Block 1, week " + bw;
    h.push('<header class="band"><h1>' + esc(C.longLabel(sel)) + '<small>' + esc(sub) + '</small></h1></header>');
    if (!storageOK) h.push('<div class="note pipe">This browser will not let Anvil save. Nothing entered here will survive a reload.</div>');

    // Two tabs (David, 10/16): the day's checklist, and the workout on its own tab.
    if (state.tab === "gym") {
      h.push(sessionPlate(pr, sel));
    } else {
      if (pr.template) h.push(templateNote());
      h.push(plate("Morning", R.weekend ? "weekend times" : "", R.morning, sel, isToday, R.lastFirstLine));
      h.push(plate("Day", "", R.day, sel, isToday).replace("</section>", activitiesHTML(sel) + '<button class="knob" style="width:100%;margin:8px 0 4px" data-act="activity">Something else today: tennis, run, walk</button></section>'));
      h.push(plate("Evening", R.weekend ? "no clock rule tonight" : "", R.evening, sel, isToday));
      h.push('<div class="actions"><button class="knob" data-act="week">The week</button><button class="knob" data-act="settings">Settings</button></div>');
    }
    h.push(syncLine());
    h.push('<nav class="tabs"><button class="' + (state.tab === "day" ? "on" : "") + '" data-act="tab" data-tab="day">Day</button><button class="' + (state.tab === "gym" ? "on" : "") + '" data-act="tab" data-tab="gym">Gym</button></nav>');
    var focused = document.activeElement && document.activeElement.id;
    var caret = focused && document.activeElement.selectionStart;
    app.innerHTML = h.join("");
    if (focused) { var el = document.getElementById(focused); if (el) { el.focus(); try { el.setSelectionRange(caret, caret); } catch (e) {} } }
    renderDock();
    pushSync(false);
  }

  // The profile is private: it lives in the data repo and arrives with sync. Until a copy has
  // arrived on this phone the Day tab runs on the blank template, and says so plainly.
  function templateNote() {
    return '<div class="note caution">' + (S.has()
      ? "Your profile has not arrived from anvil-data yet, so this is the blank routine. It loads on the next sync."
      : "This is the blank routine. Your profile is private and comes with sync: add your GitHub token in Settings.") + "</div>";
  }

  function syncLine() {
    if (!S.has()) return '<p class="small dim syncline">Saved on this phone only. Add your GitHub token in Settings to sync.</p>';
    var l = store.get("sync.last", null), pend = S.pending();
    if (l && l.ok === false) return '<p class="small syncline caution">Not synced yet (' + esc(l.msg) + '). Saved here; it retries on its own.</p>';
    return '<p class="small dim syncline">' + (pend ? "Syncing " + pend + " change" + (pend === 1 ? "" : "s") : l && l.at ? "Synced " + esc(C.hm(new Date(l.at).toTimeString().slice(0, 5))) : "Syncing") + "</p>";
  }

  function plate(title, sub, items, sel, isToday, carry) {
    var h = '<section class="plate"><h2>' + esc(title) + (sub ? ' <b>' + esc(sub) + '</b>' : "") + '</h2>';
    if (carry) h += '<p class="carry"><span>Last night you wrote:</span> ' + esc(carry) + '</p>';
    var now = nowHM();
    items.forEach(function (it) {
      var at = it.remind || it.time;
      var isNow = isToday && at && !it.done && it.kind !== "note" && C.minutesOf(now) >= C.minutesOf(at);
      var cls = "row" + (it.done ? " done" : "") + (isNow ? " now" : "");
      var when = it.time ? C.hm(it.time) : "";
      var detail = it.detail ? "<small>" + esc(it.detail) + "</small>" : "";
      if (it.kind === "text") {
        h += '<div class="' + cls + ' plain"><span class="tick">&#10003;</span><span class="what">' + esc(it.label) +
          '<textarea id="firstline" class="firstline" rows="2" data-act="firstline" placeholder="e.g. shoes by the door, bag packed">' + esc(it.value) + '</textarea>' +
          '<small>Writing it is the tick.</small></span><span class="when">' + when + '</span></div>';
      } else if (it.kind === "number") {
        h += '<div class="' + cls + ' plain"><span class="tick">&#10003;</span><span class="what">' + esc(it.label) + detail +
          '<input id="waist" class="firstline" type="number" inputmode="decimal" step="0.25" data-act="waist" placeholder="inches" value="' + fmt(it.value) + '"></span></div>';
      } else if (it.kind === "note") {
        h += '<div class="row plain"><span class="tick" style="opacity:.4"></span><span class="what dim">' + esc(it.label) + '</span><span class="when">' + when + '</span></div>';
      } else {
        var act = { tick: "tick", supp: "supp", checkin: "checkin", session: "gotosession", activity: "activity", mobility: "mobility", core: "core" }[it.kind];
        h += '<button class="' + cls + '" data-act="' + act + '" data-key="' + esc(it.key) + '"' + '>' +
          '<span class="tick">&#10003;</span><span class="what">' + esc(it.label) + detail + (isNow ? "<small>now</small>" : "") + '</span><span class="when">' + when + '</span></button>';
      }
    });
    return h + "</section>";
  }

  function activitiesHTML(sel) {
    var xs = C.activities(store).filter(function (a) { return a.date === sel; });
    if (!xs.length) return "";
    return '<div class="small dim" style="padding:6px 0">' + xs.map(function (a) {
      return esc(a.kind) + ", " + a.minutes + " min" + (a.conditioning ? " (conditioning)" : "") + ' <button class="knob" style="min-height:32px" data-act="unactivity" data-id="' + a.id + '">remove</button>';
    }).join("<br>") + "</div>";
  }

  // ---------------------------------------------------------------- the session plate
  function sessionPlate(pr, sel) {
    var check = C.planCheck(P, pr.training.sessionsIntent);
    if (!check.ok) {
      return '<section class="plate" id="session"><h2>Session</h2><div class="note pipe">This plan has a gap, so it is not issued (tenet 1):<br>' + check.gaps.map(esc).join("<br>") + "</div></section>";
    }
    var draft = store.get("draft", null);
    if (draft && draft.date !== sel) {
      var dt = P.sessions[draft.template];
      return '<section class="plate" id="session"><h2>Session</h2><div class="note caution">' + esc(dt ? dt.name : draft.template) + ' from ' + esc(C.longLabel(draft.date)) +
        ' was never filed. It is saved under its own date.</div><div class="actions"><button class="knob arc" data-act="file">File it as it is</button></div></section>';
    }
    var filed = C.sessionFiledOn(store, sel);
    var h = '<section class="plate" id="session">';
    if (filed.length && !draft && !state.extra) {
      h += "<h2>Session <b>filed</b></h2>";
      filed.forEach(function (s) {
        var t = P.sessions[s.template];
        h += '<div class="note">' + esc(t ? t.name : s.template) + ": " + Object.keys(s.lifts).map(function (lid) {
          var l = t && t.lifts.filter(function (x) { return x.id === lid; })[0], v = s.lifts[lid];
          return esc(l ? l.name : lid) + (v.w != null ? " " + v.w + " x " + v.r : "");
        }).join(" · ") + "</div>";
      });
      h += '<button class="knob" style="width:100%" data-act="extra">Another session today (the next in the queue)</button></section>';
      return h;
    }
    var tid = draft ? draft.template : C.nextInQueue(store, P), s = P.sessions[tid];
    var mins = C.estimateMinutes(s, sel, P), budget = pr.training.sessionMinutes;
    h += "<h2>Next in the queue <b>about " + mins + " min" + (mins <= budget ? ", inside your " + budget : ", over your " + budget + ": the first cut goes") + "</b></h2>";
    h += '<h3 style="margin:0 0 4px;font-size:22px">' + esc(s.name) + ' <span class="dim" style="font-size:15px;font-weight:400">' + esc(s.focus) + "</span></h3>";
    if (C.inDeload(sel, P)) h += '<div class="note">Deload week: same lifts, same weights, half the sets, 3 to 4 RIR.</div>';
    h += '<p class="small dim">' + esc(P.warmup) + " " + esc(P.tempo) + "</p>";
    var startLoads = pr.training.startLoads || {}, anyLogged = false;
    s.blocks.forEach(function (b) {
      h += '<div class="block"><h3 class="bhead">Block ' + b.name + ' <b>' + (b.superset ? "superset" + (b.where ? ", " + esc(b.where) : "") : "alone") + "</b></h3>";
      if (b.superset) h += '<p class="small">One set of ' + esc(b.lifts[0].name) + ", straight into " + esc(b.lifts[1].name) + ", rest " + C.restLabel(b.lifts[1]).split(" ")[0] + ", repeat." +
        (C.liveSets(b.lifts[0], sel, P) !== C.liveSets(b.lifts[1], sel, P) ? " The extra sets of the one with more are done alone at the end." : "") + "</p>";
      if (b.note) h += '<p class="small dim">' + esc(b.note) + "</p>";
      if (b.filler) h += '<p class="small filler"><b>In the rest:</b> ' + esc(b.filler) + "</p>";
      b.lifts.forEach(liftCard);
      h += "</div>";
    });
    function liftCard(l) {
      var key = C.pkey(l), rx = C.prescribe(l, C.history(store, key), startLoads);
      var d = draft && draft.lifts[l.id] || {};
      var w = d.w !== undefined ? d.w : rx.w, r = d.r !== undefined ? d.r : rx.r;
      if (d.logged) anyLogged = true;
      var unit = l.load === "per hand" ? "lb each" : l.load === "added" ? "lb added" : l.load === "bodyweight" ? "bodyweight" : "lb";
      h += '<div class="lift" id="lift-' + l.id + '"><h3>' + esc(l.name) +
        (l.main ? ' <span class="tag main">main lift</span>' : "") + (l.cut ? ' <span class="tag cut">first cut</span>' : "") +
        "</h3>";
      h += '<div class="rx">' + C.liveSets(l, sel, P) + " x " + l.lo + (l.hi !== l.lo ? "-" + l.hi : "") + (l.side ? " each side" : "") + " · " + esc(C.effort(l, sel, P)) + " · rest " + C.restLabel(l) + "</div>";
      h += '<div class="setpad">';
      if (l.load === "bodyweight") h += '<span></span><div class="val">BW<small>bodyweight</small></div><span></span>';
      else if (w == null) h += '<span></span><input id="w-' + l.id + '" type="number" inputmode="decimal" placeholder="lb" data-act="setw" data-id="' + l.id + '"><span></span>';
      else h += '<button class="knob" data-act="adj" data-id="' + l.id + '" data-f="w" data-d="-5" aria-label="5 lb less">&#8722;</button><div class="val">' + fmt(w) + '<small>' + unit + '</small></div><button class="knob" data-act="adj" data-id="' + l.id + '" data-f="w" data-d="5" aria-label="5 lb more">+</button>';
      h += '<button class="knob" data-act="adj" data-id="' + l.id + '" data-f="r" data-d="-1" aria-label="one rep less">&#8722;</button><div class="val">' + r + '<small>reps, top set</small></div><button class="knob" data-act="adj" data-id="' + l.id + '" data-f="r" data-d="1" aria-label="one rep more">+</button></div>';
      h += '<div class="move">' + esc(rx.move) + "</div>";
      if (rx.stall) h += '<div class="note caution">' + esc(rx.stallNote) + "</div>";
      h += '<div class="strike"><button class="knob ' + (d.logged ? "logged" : "arc") + '" data-act="log" data-id="' + l.id + '"' + (w == null && l.load !== "bodyweight" ? " disabled" : "") + ">" +
        (d.logged ? "Logged " + (l.load === "bodyweight" ? "" : fmt(d.w) + " x ") + d.r + " · tap to undo" : "Log top set") + '</button><button class="knob" data-act="rest" data-id="' + l.id + '">Rest ' + C.restLabel(l).split(" ")[0] + "</button></div>";
      h += '<p class="cue"><b>Cue:</b> ' + esc(l.cue) + "</p>";
      if (l.why) h += '<p class="why">' + esc(l.why) + "</p>";
      h += '<details class="src"><summary>Source</summary>' + esc(l.source.who) + "</details>";
      var ln = C.lastNote(store, C.pkey(l));
      if (ln) h += '<p class="lastnote"><span>Your note, ' + esc(C.label(ln.date)) + ":</span> " + esc(ln.note) + "</p>";
      h += '<textarea id="note-' + l.id + '" data-act="note" data-id="' + l.id + '" placeholder="Note: a form question, a concern, keep or swap. It shows here next time.">' + esc(d.note || "") + "</textarea>";
      h += "</div>";
    }
    var kind = tid.split("-")[0];
    if (P.wallSquat.after.indexOf(kind) !== -1) {
      var row = C.day(store, sel), done = !!(row.routine && row.routine.wallsquat);
      if (done || C.wallSquatsThisWeek(store, sel) < P.wallSquat.perWeek) {
        h += '<button class="row' + (done ? " done" : "") + '" data-act="tick" data-key="wallsquat"><span class="tick">&#10003;</span><span class="what">Isometric wall squats<small>' + esc(P.wallSquat.dose) + ". " + esc(P.wallSquat.why) + "</small></span></button>";
      }
    }
    h += '<div class="actions"><button class="knob arc" data-act="file"' + (anyLogged ? "" : " disabled") + ">File session</button></div>";
    h += '<p class="small dim">A short session counts. Filing with only the main lift logged moves the queue on exactly as a full one does.</p>';
    return h + "</section>";
  }

  // ---------------------------------------------------------------- draft door: synchronous, every change
  function draftFor(sel) {
    var d = store.get("draft", null);
    if (d && d.date === sel) return d;
    return { id: C.uid(), date: sel, template: C.nextInQueue(store, P), lifts: {} };
  }
  function liftById(tid, id) { return P.sessions[tid].lifts.filter(function (l) { return l.id === id; })[0]; }
  function touchLift(id, fn) {
    var d = draftFor(state.sel), l = liftById(d.template, id);
    var cur = d.lifts[id];
    if (!cur) {
      var rx = C.prescribe(l, C.history(store, C.pkey(l)), prof().training.startLoads || {});
      cur = { key: C.pkey(l), w: rx.w, r: rx.r };
    }
    fn(cur, l);
    d.lifts[id] = cur;
    store.set("draft", d);
  }

  // ---------------------------------------------------------------- events
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    var a = b.dataset.act, sel = state.sel;
    if (a === "tick") {
      var date = sel, cur = (C.day(store, date).routine || {})[b.dataset.key];
      var p = {}; p[b.dataset.key] = cur ? null : true;
      C.upsertDay(store, date, { routine: p }); render(); return;
    }
    if (a === "supp") {
      var s = (C.day(store, sel).supplements || {})[b.dataset.key], q = {}; q[b.dataset.key] = s ? null : true;
      C.upsertDay(store, sel, { supplements: q }); render(); return;
    }
    if (a === "checkin") { openCheckin(sel); return; }
    if (a === "gotosession") { setTab("gym"); return; }
    if (a === "tab") { setTab(b.dataset.tab); return; }
    if (a === "activity") { openActivity(sel, b.dataset.key === "conditioning"); return; }
    if (a === "unactivity") { store.set("activities", C.activities(store).filter(function (x) { return x.id !== b.dataset.id; })); S.queueActivity(b.dataset.id, true); render(); return; }
    if (a === "mobility") { openCore(sel, "mobility"); return; }
    if (a === "core") { openCore(sel); return; }
    if (a === "extra") { state.extra = true; render(); return; }
    if (a === "adj") {
      touchLift(b.dataset.id, function (cur) {
        var dlt = +b.dataset.d;
        if (b.dataset.f === "w") cur.w = Math.max(0, (cur.w || 0) + dlt); else cur.r = Math.max(0, (cur.r || 0) + dlt);
        cur.logged = false;
      });
      render(); return;
    }
    if (a === "log") {
      touchLift(b.dataset.id, function (cur, l) { if (l.load === "bodyweight" && cur.w == null) cur.w = 0; cur.logged = !cur.logged; });
      render(); return;
    }
    if (a === "rest") {
      var d0 = store.get("draft", null), tid = d0 && d0.date === sel ? d0.template : C.nextInQueue(store, P), l = liftById(tid, b.dataset.id);
      store.set("timer", { name: l.name, start: Date.now(), secs: l.rest, pair: !!l.pair }); renderDock(); return;
    }
    if (a === "file") {
      var dd = store.get("draft", null);
      if (!dd) return;
      var rec = C.fileSession(store, dd, P); S.queueSession(rec.id); state.extra = false; render(); return;
    }
    if (a === "week") { openWeek(); return; }
    if (a === "settings") { openSettings(); return; }
  });
  app.addEventListener("input", function (e) {
    var t = e.target, a = t.dataset && t.dataset.act;
    if (a === "firstline") { C.upsertDay(store, state.sel, { routine: { firstLine: t.value || null } }); pushSync(false); var row = t.closest(".row"); if (row) row.classList.toggle("done", !!t.value.trim()); }
    if (a === "note") touchLift(t.dataset.id, function (cur) { cur.note = t.value; });
  });
  app.addEventListener("change", function (e) {
    var t = e.target, a = t.dataset && t.dataset.act;
    if (a === "waist") { C.upsertDay(store, state.sel, { waist: t.value === "" ? null : +t.value }); render(); }
    if (a === "setw" && t.value !== "") { touchLift(t.dataset.id, function (cur) { cur.w = +t.value; }); render(); }
  });

  // ---------------------------------------------------------------- the check-in: three fields, once a day (P6)
  function openCheckin(date) {
    var row = C.day(store, date), F = [
      { f: "weight", label: "Weight", unit: "lb", step: 0.2 },
      { f: "sleep", label: "Sleep", unit: "hours, off the Watch", step: 0.25 },
      { f: "pushups", label: "Push-ups", unit: "", step: 1 }
    ];
    var vals = {};
    var h = "<h2>Check-in</h2><p class='dim small'>" + esc(C.longLabel(date)) + ". Three numbers, then you are done.</p>";
    F.forEach(function (x) {
      var last = C.lastValue(store, date, x.f);
      var v = row[x.f] != null ? row[x.f] : last ? last.v : (x.f === "pushups" ? prof().training.pushups : null);
      vals[x.f] = v;
      h += '<div class="field"><label for="ci-' + x.f + '">' + x.label + "<small>" + (last ? "Last: " + fmt(last.v) + " on " + C.label(last.date) : "No earlier entry") + (x.unit ? " · " + x.unit : "") + "</small></label>" +
        '<button class="knob" type="button" data-step="' + x.f + '" data-d="' + -x.step + '">&#8722;</button>' +
        '<input id="ci-' + x.f + '" type="number" inputmode="decimal" step="' + x.step + '" value="' + fmt(v) + '">' +
        '<button class="knob" type="button" data-step="' + x.f + '" data-d="' + x.step + '">+</button></div>';
    });
    h += '<div class="actions"><button class="knob" type="button" data-x="skip">Not now</button><button class="knob arc" type="button" data-x="save">Save</button></div>';
    sheet.innerHTML = h;
    sheet.onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.step) { var inp = document.getElementById("ci-" + b.dataset.step); inp.value = fmt(Math.max(0, (+inp.value || 0) + +b.dataset.d)); return; }
      if (b.dataset.x === "save") {
        var p = {};
        F.forEach(function (x) { var v = document.getElementById("ci-" + x.f).value; if (v !== "") p[x.f] = +v; });
        C.upsertDay(store, date, p);
      }
      sheet.close(); render();
    };
    sheet.showModal();
  }

  // ---------------------------------------------------------------- activity: every modality from this page (P5)
  function openActivity(date, cond) {
    var kinds = ["Tennis", "Run", "Walk", "Other"], pick = cond ? "Tennis" : "Walk", mins = cond ? 30 : 25;
    function draw() {
      sheet.innerHTML = "<h2>" + (cond ? "Conditioning" : "Something else") + "</h2><p class='dim small'>" + esc(C.longLabel(date)) + (cond ? ". " + esc(P.conditioning.what) : "") + "</p>" +
        '<div class="actions">' + kinds.map(function (k) { return '<button class="knob' + (k === pick ? " arc" : "") + '" data-k="' + k + '">' + k + "</button>"; }).join("") + "</div>" +
        '<div class="field"><label>Minutes</label><button class="knob" data-m="-5">&#8722;</button><input id="act-m" type="number" inputmode="numeric" value="' + mins + '"><button class="knob" data-m="5">+</button></div>' +
        '<p class="small dim">Tennis and a run count as the week\'s conditioning session. A walk is in the record but is not conditioning.</p>' +
        '<div class="actions"><button class="knob" data-x="close">Cancel</button><button class="knob arc" data-x="log">Log it</button></div>';
    }
    draw();
    sheet.onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return;
      mins = +document.getElementById("act-m").value || mins;
      if (b.dataset.k) { pick = b.dataset.k; draw(); return; }
      if (b.dataset.m) { mins = Math.max(0, mins + +b.dataset.m); draw(); return; }
      if (b.dataset.x === "log") {
        var xs = C.activities(store);
        var act = { id: C.uid(), date: date, kind: pick.toLowerCase(), minutes: mins, conditioning: pick === "Tennis" || pick === "Run" };
        xs.push(act);
        store.set("activities", xs);
        S.queueActivity(act.id);
      }
      sheet.close(); render();
    };
    sheet.showModal();
  }

  // ---------------------------------------------------------------- Core Sessions (Crystal Life/Core-Sessions)
  // The clock is derived from a start stamp (P8): elapsed = now - start - time paused + time skipped.
  // It calls each move, counts it down, beeps and buzzes on every change, and files itself at the end.
  var coreLoop = null, audio = null, wake = null, lastStep = -1, lastLeft = -1;
  function beep(freq, ms, vol) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      var o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = freq; g.gain.value = vol || 0.2; o.connect(g); g.connect(audio.destination);
      o.start(); o.stop(audio.currentTime + ms / 1000);
    } catch (e) {}
  }
  function buzz(p) { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(p); }
  function holdScreen(on) {
    try {
      if (on && !wake && navigator.wakeLock) navigator.wakeLock.request("screen").then(function (w) { wake = w; }, function () {});
      if (!on && wake) { wake.release(); wake = null; }
    } catch (e) {}
  }
  function coreElapsed(run) { return ((run.paused || Date.now()) - run.start - run.held) / 1000 + run.skip; }
  function openCore(date, pick) {
    var run = store.get("core.run", null);
    if (run && run.date !== date) { store.del("core.run"); run = null; }
    if (run) return drawCoreRun();
    var isMob = pick === "mobility", field = isMob ? "mobility" : "core";
    var today0 = C.coreForDate(date, P), done = (C.day(store, date).routine || {})[field];
    var cs = C.coreById(P, pick) || today0;
    var T = C.coreSteps(P, cs);
    var h = isMob ? "<h2>Mobility</h2><p class='dim small'>Mon, Wed, Fri, after the push-ups. Breathe out into every end range; nothing is pushed into pain.</p><div class='chips' hidden>" :
      "<h2>Core Session</h2><p class='dim small'>A must every day. On the floor, no equipment. Pick one or take today's.</p><div class='chips'>" +
      P.core.sessions.map(function (x) { return '<button class="knob' + (x.id === cs.id ? " arc" : "") + '" data-pick="' + x.id + '">' + esc(x.name) + (x.id === today0.id ? "<small>today</small>" : "") + "</button>"; }).join("") + "</div>";
    h += "<p class='small'><b>" + esc(cs.name) + "</b>, " + esc(cs.focus) + ", " + Math.floor(T.total / 60) + ":" + String(T.total % 60).padStart(2, "0") + "</p><ol class='moves'>" +
      cs.moves.map(function (m, i) { var mv = C.moveOf(P, m[0]), last = i === cs.moves.length - 1; return "<li><b>" + esc(mv.name) + "</b>, " + m[1] + " s" + (last ? "" : m[2] ? ", then " + m[2] + " s rest" : ", straight in") + "<br><span class='dim'>" + esc(mv.cue) + "</span></li>"; }).join("") + "</ol>";
    h += "<p class='src'>" + esc(isMob ? "Training Recipe, section 7" : P.core.source) + "</p>";
    if (done) h += "<div class='note'>Done today" + (isMob ? "" : ": " + esc((C.coreById(P, done) || {}).name || done)) + ".</div>";
    h += '<div class="actions"><button class="knob" data-x="close">Close</button>' + (done ? '<button class="knob" data-x="undo">Un-tick</button>' : '<button class="knob" data-x="did">Done it, no timer</button>') + '<button class="knob arc" data-x="start">Start</button></div>';
    sheet.innerHTML = h;
    sheet.onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.pick) { openCore(date, b.dataset.pick); return; }
      var x = b.dataset.x;
      if (x === "start") { beep(660, 80, 0.05); store.set("core.run", { sid: cs.id, date: date, start: Date.now(), held: 0, skip: 0, paused: null }); lastStep = -1; drawCoreRun(); return; }
      var pt = {};
      if (x === "did") { pt[field] = isMob ? true : cs.id; C.upsertDay(store, date, { routine: pt }); }
      if (x === "undo") { pt[field] = null; C.upsertDay(store, date, { routine: pt }); }
      sheet.close(); render();
    };
    if (!sheet.open) sheet.showModal();
  }
  function drawCoreRun() {
    var run = store.get("core.run", null);
    if (!run) { stopCoreLoop(); return; }
    var cs = C.coreById(P, run.sid), el = coreElapsed(run), at = C.coreAt(P, cs, el);
    if (at.done) {
      var fin = {};
      if (run.sid === "mobility") fin.mobility = true; else fin.core = run.sid;
      C.upsertDay(store, run.date, { routine: fin });
      store.del("core.run"); stopCoreLoop(); beep(880, 600); buzz([300, 120, 300]);
      sheet.innerHTML = "<h2>Core Session done</h2><p class='small'>" + esc(cs.name) + ", recorded for today.</p><div class='actions'><button class='knob arc' data-x='close'>Close</button></div>";
      sheet.onclick = function (e) { if (e.target.closest("[data-x]")) { sheet.close(); render(); } };
      if (!sheet.open) sheet.showModal();
      return;
    }
    var s = at.step, mv = C.moveOf(P, s.move);
    if (at.i !== lastStep) { if (lastStep !== -1) { beep(s.kind === "work" ? 880 : 520, 180); buzz(150); } lastStep = at.i; }
    else if (s.kind === "work" && at.left <= 3 && at.left !== lastLeft && !run.paused) beep(1200, 40, 0.06);
    lastLeft = at.left;
    var title = s.kind === "lead" ? "Get ready" : s.kind === "rest" ? "Rest" : mv.name;
    var nextMv = at.next && at.next.kind === "work" ? C.moveOf(P, at.next.move) : null;
    var sub = s.kind === "work" ? mv.cue : "Next: " + mv.name + ". " + mv.cue;
    if (s.kind === "work" && at.next && at.next.kind === "work") sub += " Then straight into " + nextMv.name + ", no rest.";
    var frac = 1 - at.left / s.secs, r = 70, circ = 2 * Math.PI * r;
    var h = "<h2>" + esc(cs.name) + " <span class='dim small'>" + (at.i + 1) + " / " + at.steps.length + "</span></h2>" +
      "<div style='text-align:center'><svg width='170' height='170' viewBox='0 0 170 170' aria-hidden='true'><circle cx='85' cy='85' r='" + r + "' fill='none' stroke='#1f2a40' stroke-width='10'/>" +
      "<circle cx='85' cy='85' r='" + r + "' fill='none' stroke='" + (s.kind === "work" ? "#22d3ee" : "#2f6bff") + "' stroke-width='10' stroke-dasharray='" + circ + "' stroke-dashoffset='" + (circ * (1 - frac)) + "' transform='rotate(-90 85 85)'/>" +
      "<text x='85' y='98' text-anchor='middle' fill='#e9edf6' font-size='44' font-weight='600'>" + at.left + "</text></svg>" +
      "<p id='core-now' style='font-size:26px;font-weight:600;margin:6px 0'>" + esc(title) + "</p><p style='font-size:19px;margin:0 0 8px'>" + esc(sub) + "</p></div>";
    h += '<div class="actions"><button class="knob" data-x="stop">Stop</button><button class="knob" data-x="pause">' + (run.paused ? "Resume" : "Pause") + '</button><button class="knob arc" data-x="skip">Skip</button></div>';
    sheet.innerHTML = h;
    sheet.onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var x = b.dataset.x, cur = store.get("core.run", null); if (!cur) return;
      if (x === "stop") { store.del("core.run"); stopCoreLoop(); openCore(cur.date, cur.sid); return; }
      if (x === "pause") { if (cur.paused) { cur.held += Date.now() - cur.paused; cur.paused = null; } else cur.paused = Date.now(); }
      if (x === "skip") { var a2 = C.coreAt(P, cs, coreElapsed(cur)); if (!a2.done) cur.skip += a2.left; }   // to the start of the next step
      store.set("core.run", cur); drawCoreRun();
    };
    if (!sheet.open) sheet.showModal();
    holdScreen(!run.paused);
    if (!coreLoop) coreLoop = setInterval(function () { if (!sheet.open) { stopCoreLoop(); return; } drawCoreRun(); }, 250);
  }
  function stopCoreLoop() { if (coreLoop) { clearInterval(coreLoop); coreLoop = null; } holdScreen(false); }

  // ---------------------------------------------------------------- the week: queue, plan check, the dated goal
  function openWeek() {
    var pr = prof(), sel = state.sel, t = today(), ws = C.weekStart(sel), we = C.addDays(ws, 6);
    var next = C.nextInQueue(store, P), filed = C.filedFor(store, P);
    var thisWeek = filed.filter(function (s) { return s.date >= ws && s.date <= we; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var check = C.planCheck(P, pr.training.sessionsIntent);
    var g = pr.base.goal, a7 = C.avg7(store, sel), a7p = C.avg7(store, C.addDays(sel, -7));
    var h = "<h2>The week</h2><p class='dim small'>" + esc(C.label(ws)) + " to " + esc(C.label(we)) + "</p>";
    h += "<h3>The queue</h3><table>" + P.queue.map(function (q) {
      return "<tr><td>" + esc(P.sessions[q].name) + "</td><td class='dim'>" + esc(P.sessions[q].focus) + "</td><td>" + (q === next ? "<b style='color:var(--arc)'>next</b>" : "") + "</td></tr>";
    }).join("") + "</table>";
    h += "<p class='small'>Filed this week: " + (thisWeek.length ? thisWeek.map(function (s) { return esc(C.label(s.date) + " " + P.sessions[s.template].name); }).join(", ") : "none yet") + ". The queue moves on completion; a missed day only makes the next session later.</p>";
    var c = C.conditioningThisWeek(store, sel);
    h += "<p class='small'>Conditioning: " + (c.length ? esc(c.map(function (x) { return x.kind + " " + x.minutes + " min, " + C.label(x.date); }).join("; ")) : "Saturday, " + esc(P.conditioning.what.toLowerCase())) + ".</p>";
    h += "<h3>Plan check</h3><p class='small dim'>Hard sets a week per muscle group at " + pr.training.sessionsIntent + " sessions, against " + check.range.lo + " to " + check.range.hi + ". Run before the session is shown.</p><table><tr><th>Group</th><th>Hard sets a week</th></tr>" +
      check.groups.map(function (gr) { return "<tr><td>" + esc(gr) + "</td><td>" + check.sets[gr] + "</td></tr>"; }).join("") + "</table>";
    h += "<p class='small'>The week is " + pr.training.sessionsIntent + " sessions. No set is dropped for a shorter week: a missed day is gone, and the next session is the next in the queue, in full.</p>";
    h += "<p class='small'>Plus one conditioning session, a Core Session every day, and mobility on " + P.mobility.days.map(function (d) { return C.DAYS[d]; }).join(", ") + ".</p>";
    h += "<h3>The goal</h3>" + (g && g.what && g.date
      ? "<p class='small'>" + esc(g.what) + ", by " + esc(C.longLabel(g.date)) + ". Between today and then: about " + C.sessionsUntil(t, g.date, pr.training.sessionsIntent) + " sessions at " + pr.training.sessionsIntent + " a week.</p>"
      : "<p class='small dim'>No goal on this phone yet. It comes with your profile from anvil-data.</p>");
    h += "<p class='small'>7-day average weight: " + (a7 != null ? "<b>" + a7 + " lb</b>" + (a7p != null ? ", the week before " + a7p : "") : "no weigh-ins yet") + ". Waist: " + (function () { var w = C.lastValue(store, C.addDays(sel, 1), "waist"); return w ? w.v + " in on " + C.label(w.date) : "measured on Sundays"; })() + ".</p>";
    if ((pr.training.strengthGoals || []).length) h += "<table>" + pr.training.strengthGoals.map(function (x) { return "<tr><td>" + esc(x.lift) + "</td><td class='dim'>now " + esc(x.now) + "</td><td>" + esc(x.goal) + "</td></tr>"; }).join("") + "</table>";
    h += "<h3>Dates</h3><table>" + P.reviews.filter(function (r) { return r.date >= C.addDays(t, -1); }).map(function (r) { return "<tr><td>" + esc(C.label(r.date)) + "</td><td>" + esc(r.what) + "</td></tr>"; }).join("") + "</table>";
    h += '<div class="actions"><button class="knob arc" data-x="close">Close</button></div>';
    sheet.innerHTML = h;
    sheet.onclick = function (e) { if (e.target.closest("[data-x]")) sheet.close(); };
    sheet.showModal();
  }

  // ---------------------------------------------------------------- settings: the training section only (decision 0002)
  function openSettings() {
    var T = prof().training, perm = typeof Notification === "undefined" ? "unsupported" : Notification.permission;
    // The routine is fixed and comes from the profile: nothing here builds it or asks for a time
    // ("Just tell me the routine. Don't make me create it on the spot", David, 10/13).
    var h = "<h2>Settings</h2>" + (prof().template ? "<p class='dim small'>This phone has only the blank routine; your own arrives from anvil-data with sync.</p>" : "<p class='dim small'>Your routine is set: wake " + C.hm(T.days.weekday.wake) + " weekdays, " + C.hm(T.days.weekend.wake) + " weekends, lights out " + C.hm(T.evening.lightsOut) + " Sun to Thu, sessions about " + T.sessionMinutes + " min. There is nothing to set up.</p>");
    var tok = S.has(), sl = store.get("sync.last", null);
    h += '<div class="set-row"><label>GitHub sync<small class="dim" style="display:block">' +
      (tok ? "Token saved on this phone" + (sl && sl.ok ? ", last synced " + esc(C.hm(new Date(sl.at).toTimeString().slice(0, 5))) : sl ? ", not reaching GitHub: " + esc(sl.msg) : "") + ". Check-ins go to mise-data, sessions to anvil-data." : "No token on this phone, so nothing leaves it. Paste the token the old Anvil used.") +
      '</small></label><button class="knob' + (tok ? "" : " arc") + '" data-x="token">' + (tok ? "Replace" : "Add token") + "</button></div>";
    h += '<div class="set-row"><label>Reminders until recorded<small class="dim" style="display:block">Every ' + T.reminders.repeatMinutes + ' min, normal priority, so Do Not Disturb holds. While Anvil is open or in the background.</small></label><button class="knob' + (T.reminders.on ? " arc" : "") + '" data-x="rem">' + (T.reminders.on ? "On" : "Off") + "</button></div>";
    if (perm !== "granted" && perm !== "unsupported") h += '<div class="set-row"><label>Notifications are ' + esc(perm) + '</label><button class="knob arc" data-x="perm">Allow</button></div>';
    if (perm === "unsupported") h += '<p class="small dim">This browser has no notifications. On an iPhone, add Anvil to the home screen first.</p>';
    var push = store.get("push", null), ps = store.get("push.state", null);
    h += '<div class="set-row"><label>Reminders on the phone, app closed<small class="dim" style="display:block">' +
      (push ? "Connected" + (ps && ps.ok ? ", last sent " + esc(new Date(ps.at).toTimeString().slice(0, 5)) : ps ? ", not reaching the server yet" : "") + ". Through the ntfy app; Do Not Disturb holds." : "Paste the pairing link once. Until then, reminders come only while Anvil is open.") +
      '</small></label>' + (push ? '<button class="knob" data-x="unpair">Disconnect</button>' : '<button class="knob arc" data-x="pair">Connect</button>') + "</div>";
    h += '<div class="set-row"><label>The whole record, as one file</label><button class="knob" data-x="export">Export</button><button class="knob" data-x="import">Import</button></div><input id="st-file" type="file" accept="application/json" hidden>';
    h += '<div class="actions"><button class="knob arc" data-x="close">Close</button></div>';
    sheet.innerHTML = h;
    sheet.onclick = function (e) {
      var b = e.target.closest("[data-x]"); if (!b) return;
      var x = b.dataset.x;
      if (x === "rem") { C.saveTraining(store, { reminders: { on: !T.reminders.on } }); openSettings(); return; }
      if (x === "perm") { Notification.requestPermission().then(openSettings); return; }
      if (x === "export") { exportRecord(); return; }
      if (x === "token") {
        var tv = prompt("Paste your GitHub token (fine-grained, scoped to anvil-data and mise-data)");
        if (tv && tv.trim()) { localStorage.setItem("anvil.pat", tv.trim()); localStorage.setItem("anvil.pat.savedAt", new Date().toISOString()); S.pull(); }
        openSettings(); return;
      }
      if (x === "pair") {
        var link = prompt("Paste the pairing link (it looks like https://.../#key)");
        var m = link && /^(https:\/\/[^#\s]+?|http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?)\/?#([A-Za-z0-9_-]{16,})$/.exec(link.trim());
        if (link && !m) alert("That is not a pairing link.");
        if (m) { store.set("push", { url: m[1], key: m[2] }); store.del("push.sig"); pushSync(true); }
        openSettings(); return;
      }
      if (x === "unpair") { store.del("push"); store.del("push.state"); store.del("push.sig"); openSettings(); return; }
      if (x === "import") { document.getElementById("st-file").click(); return; }
      sheet.close(); render();
    };
    document.getElementById("st-file").onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      f.text().then(function (txt) {
        var data = JSON.parse(txt), keys = Object.keys(data).filter(C.portableKey);
        if (!keys.length) { alert("That file holds no Anvil record."); return; }
        if (!confirm("Replace this device's record with the " + keys.length + " parts in the file?")) return;
        keys.forEach(function (k) { backing.setItem(k, data[k]); });
        sheet.close(); render();
      });
    };
    sheet.showModal();
  }
  function exportRecord() {
    var out = {};
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (C.portableKey(k)) out[k] = localStorage.getItem(k); }
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: "application/json" }));
    a.download = "anvil-record-" + today() + ".json"; a.click();
  }

  // ---------------------------------------------------------------- rest timer: derived from a start stamp, never counted ticks (P8)
  function renderDock() {
    var t = store.get("timer", null);
    if (!t) { dock.hidden = true; return; }
    var left = Math.round(t.secs - (Date.now() - t.start) / 1000), over = left < 0;
    if (left < -300) { store.del("timer"); dock.hidden = true; return; }   // a rest five minutes past its floor is over
    var frac = over ? 1 : 1 - left / t.secs, r = 24, circ = 2 * Math.PI * r;
    var abs = Math.abs(left), mm = Math.floor(abs / 60), ss = abs % 60;
    dock.hidden = false;
    dock.innerHTML = '<div class="inner"><svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="' + r + '" fill="none" stroke="#1f2a40" stroke-width="5"/>' +
      '<circle cx="28" cy="28" r="' + r + '" fill="none" stroke="' + (over ? "#2f6bff" : "#22d3ee") + '" stroke-width="5" stroke-dasharray="' + circ + '" stroke-dashoffset="' + (circ * (1 - frac)) + '" transform="rotate(-90 28 28)"/></svg>' +
      '<div class="t' + (over ? " over" : "") + '">' + (over ? "+" : "") + mm + ":" + (ss < 10 ? "0" : "") + ss + '</div><div class="what">' + esc(t.name) + (t.pair ? ", after the pair" : "") +
      "<br>" + (over ? "Floor reached. Go when ready." : "Rest floor. No heart-rate source, so the floor is the whole answer.") + '</div><button class="knob" id="dock-x" aria-label="Close timer">&#10005;</button></div>';
    if (over && !t.buzzed) { t.buzzed = true; store.set("timer", t); if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate([200, 100, 200]); }
    document.getElementById("dock-x").onclick = function () { store.del("timer"); renderDock(); };
  }

  // ---------------------------------------------------------------- phone reminders: today's items to the server
  // Sent whenever the record changes what is open, so the server never reminds about a recorded item.
  // A failed send is retried every minute; the server stops at midnight on its own (no past days).
  function atMs(date, hhmm) { var p = hhmm.split(":"); var d = C.parseKey(date); d.setHours(+p[0], +p[1], 0, 0); return d.getTime(); }
  function pushSync(force) {
    var push = store.get("push", null); if (!push) return;
    // today and tomorrow, so tomorrow's morning reminders come even if Anvil is not opened first
    var t = today(), body = JSON.stringify({ days: [C.pushDay(store, t, prof(), P, atMs), C.pushDay(store, C.addDays(t, 1), prof(), P, atMs)] });
    if (!force && store.get("push.sig", null) === body && (store.get("push.state", {}) || {}).ok) return;
    fetch(push.url + "/day", { method: "POST", headers: { "Authorization": "Bearer " + push.key, "Content-Type": "application/json" }, body: body })
      .then(function (r) { store.set("push.state", { ok: r.ok, at: Date.now(), status: r.status }); if (r.ok) store.set("push.sig", body); })
      .catch(function () { store.set("push.state", { ok: false, at: Date.now() }); });
  }
  function pushLive() { var ps = store.get("push.state", null); return !!(store.get("push", null) && ps && ps.ok); }

  // ---------------------------------------------------------------- reminders until recorded (P15, decision 0004)
  function remind() {
    var pr = prof();
    if (pushLive()) return;   // the phone server has today: one reminder, not two
    if (!pr.training.reminders.on || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    var t = today(), due = C.dueNow(store, t, nowHM(), pr, P), sent = store.get("reminded", {}), now = Date.now(), every = pr.training.reminders.repeatMinutes * 60000;
    Object.keys(sent).forEach(function (k) { if (k.slice(0, 10) !== t) delete sent[k]; });
    due.forEach(function (it) {
      var k = t + "|" + it.key;
      if (sent[k] && now - sent[k] < every) return;
      sent[k] = now;
      var body = it.names.join(", ") + ". One tap in Anvil records it.";
      var opts = { body: body, tag: "anvil-" + it.key, renotify: true, icon: "icon.svg" }; // default priority: Do Not Disturb holds
      if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(function (r) { r.showNotification(cap(it.label), opts); });
      else try { new Notification(cap(it.label), opts); } catch (e) {}
    });
    store.set("reminded", sent);
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ---------------------------------------------------------------- boot
  var lastMinute = nowHM();
  setInterval(function () {
    renderDock();
    if (nowHM() !== lastMinute) {
      lastMinute = nowHM();
      remind();
      var typing = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
      if (!typing && !sheet.open) render();
    }
  }, 1000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) boot(); });

  function boot() {
    var t = today();
    state.sel = t;
    // what was logged then was recorded then: filed under its own date AND queued for sync, so the
    // pull below cannot drop it (Tribunal 10/17: it used to file locally and then lose it)
    var stale = C.fileStaleDraft(store, t, P);
    if (stale) S.queueSession(stale.id);
    render();
    S.pull();
    // the check-in opens itself on the first open of each calendar day, on every device (P6)
    if (store.get("checkin.seen", null) !== t) {
      store.set("checkin.seen", t);
      state.sel = t; render();
      var row = C.day(store, t);
      if (row.weight == null && row.sleep == null && row.pushups == null) openCheckin(t);
    }
    remind();
  }
  if ("serviceWorker" in navigator && /^https?:/.test(location.protocol)) {
    // a new deploy takes over once and reloads, so a phone never keeps running the old page
    var hadController = !!navigator.serviceWorker.controller, reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(function () {});
  }
  boot();
})();
