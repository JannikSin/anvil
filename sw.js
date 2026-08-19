// Anvil service worker. Ported from Mise's, with ONE deliberate correction —
// see the activate handler.
//
// Strategy:
//   - app code + index (unhashed filenames that change per deploy):
//     NETWORK-FIRST with cache fallback — online users always get the
//     current deploy in one load; offline serves the last good copy.
//   - vendor/, fonts, icons (version-pinned, replaced wholesale):
//     CACHE-FIRST — immutable until a deploy changes CACHE_VERSION.
//   - GitHub API: never intercepted (the data layer owns freshness).
//
// CACHE_VERSION must stay "anvil-shell-vN". Every one of David's PWAs lives
// on janniksin.github.io and the Cache Storage API is scoped per ORIGIN, not
// per path: a name that collides with a sibling app's, or a cleanup pass that
// deletes by anything looser than this prefix, evicts that sibling.
const CACHE_PREFIX = "anvil-shell-";
const CACHE_VERSION = `${CACHE_PREFIX}v12`;

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./app/styles.css",
  "./app/main.js",
  "./app/data/program.json",
  "./app/lib/awake.js",
  "./app/lib/activities.js",
  "./app/lib/core.js",
  "./app/lib/daily.js",
  "./app/lib/dates.js",
  "./app/lib/db.js",
  "./app/lib/github.js",
  "./app/lib/merge.js",
  "./app/lib/music.js",
  "./app/lib/router.js",
  "./app/lib/routines.js",
  "./app/lib/store.js",
  "./app/lib/sync.js",
  "./app/lib/vitals.js",
  "./app/lib/weight.js",
  "./app/lib/workouts.js",
  "./app/views/activity-log.js",
  "./app/views/checkin-modal.js",
  "./app/views/confirm-modal.js",
  "./app/views/core-figure.js",
  "./app/views/core-workout.js",
  "./app/views/core.js",
  "./app/views/progress.js",
  "./app/views/spark.js",
  "./app/views/system.js",
  "./app/views/today.js",
  "./app/views/vitals.js",
  "./vendor/preact/preact.module.js",
  "./vendor/preact/hooks.module.js",
  "./vendor/htm/htm.module.js",
  "./vendor/htm/preact.module.js",
  "./vendor/fonts/archivo-var.woff2",
  "./vendor/fonts/jetbrains-mono-var.woff2",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

/** version-pinned top-level dirs under the SW scope: cache-first (anchored to
 *  the scope so a future app/views/icons-*.js can never accidentally match) */
const SCOPE_PATH = new URL(
  self.registration ? self.registration.scope : self.location.href,
).pathname.replace(/[^/]*$/, "");
const IMMUTABLE = new RegExp(
  `^${SCOPE_PATH.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(vendor|icons)/`,
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // THE correction. Mise still ships
            // `keys.filter((k) => k !== CACHE_VERSION)`, which reads as "drop
            // my old caches" and actually means "drop every cache on
            // janniksin.github.io" — so every Mise deploy evicts Tally,
            // Finesse, Bonmot, Grandstand and AIMap. Those five were
            // prefix-scoped on 2026-07-27; Mise never was. Only ever delete
            // our own prefix.
            .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_VERSION)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Never intercept the GitHub API — the data layer owns freshness.
  if (url.origin !== self.location.origin) return;
  // Never intercept a sibling app's files, even on this origin.
  if (!url.pathname.startsWith(SCOPE_PATH)) return;

  if (IMMUTABLE.test(url.pathname)) {
    event.respondWith(cacheFirst(req));
  } else {
    event.respondWith(networkFirst(req));
  }
});

/** Cache a successful response without blocking its delivery.
 * @param {Request} req @param {Response} res */
function putInCache(req, res) {
  if (!res.ok) return;
  const copy = res.clone();
  void caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
}

/** @param {Request} req */
async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  putInCache(req, res);
  return res;
}

/** @param {Request} req */
async function networkFirst(req) {
  try {
    const res = await fetch(req);
    putInCache(req, res);
    return res;
  } catch (e) {
    const hit = await caches.match(req);
    if (hit) return hit;
    // a navigation that misses the cache still has to render something
    if (req.mode === "navigate") {
      const shell = await caches.match("./index.html");
      if (shell) return shell;
    }
    throw e;
  }
}
