// Anvil service worker.
//
// Network-first for everything on this origin, cache as the offline fallback: an online open
// always gets the current deploy, an offline open (the CoRec basement) serves the last good copy.
// The GitHub API is another origin and is never intercepted.
//
// The cache is anvil-shell-vN and activate deletes ONLY caches starting with anvil-shell-: every
// one of David's PWAs shares janniksin.github.io, and Cache Storage is per origin, not per path.
var CACHE_PREFIX = "anvil-shell-";
var CACHE = CACHE_PREFIX + "v44";
var SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "./app/app.css", "./app/profile.js", "./app/program.js", "./app/core.js", "./app/sync.js", "./app/app.js",
  "./suggest.js", "./suggest.css",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"
];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  // no-cache: revalidate with the server every time, so the browser's 10-minute HTTP cache (Pages
  // sends max-age=600) can never keep serving the previous deploy's files after an update
  var net = fetch(e.request.url, { cache: "no-cache", credentials: "same-origin" }).then(function (res) {
    if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
    return res;
  });
  var cached = function () { return caches.match(e.request).then(function (hit) { return hit || caches.match("./index.html"); }); };
  // Bars but no data at the CoRec: past 2.5 s the cached copy answers (the network still refreshes
  // the cache when it lands). No cached copy: keep waiting on the network (Tribunal 10/17).
  var slow = new Promise(function (resolve) { setTimeout(resolve, 2500); }).then(cached).then(function (hit) { return hit || net; });
  e.respondWith(Promise.race([net.catch(cached), slow]).then(function (r) { return r || net; }));
});
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) if ("focus" in cs[i]) return cs[i].focus();
    return self.clients.openWindow("./");
  }));
});
