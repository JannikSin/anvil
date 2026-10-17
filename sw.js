// Anvil service worker.
//
// Network-first for everything on this origin, cache as the offline fallback: an online open
// always gets the current deploy, an offline open (the CoRec basement) serves the last good copy.
// The GitHub API is another origin and is never intercepted.
//
// The cache is anvil-shell-vN and activate deletes ONLY caches starting with anvil-shell-: every
// one of David's PWAs shares janniksin.github.io, and Cache Storage is per origin, not per path.
var CACHE_PREFIX = "anvil-shell-";
var CACHE = CACHE_PREFIX + "v41";
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
  e.respondWith(fetch(e.request).then(function (res) {
    if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
    return res;
  }).catch(function () {
    return caches.match(e.request).then(function (hit) { return hit || caches.match("./index.html"); });
  }));
});
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) if ("focus" in cs[i]) return cs[i].focus();
    return self.clients.openWindow("./");
  }));
});
