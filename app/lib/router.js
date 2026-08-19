// Hash router (zero-build, Pages-subpath-safe). Ported from mise, cases
// rewritten for anvil's five screens.

/**
 * @param {string} hash
 * @returns {{ view: string }}
 */
export function parseRoute(hash) {
  const [path = ""] = hash.replace(/^#\/?/, "").split("?");
  const [head] = path.split("/").filter(Boolean);
  switch (head) {
    // #/ and #/train are permanent ALIASES for Today, not redirects. #/train
    // is what Mise's Train tab was called for a year; anyone with that
    // bookmark, and the vitals worker's ntfy deep links, must keep landing
    // somewhere sensible forever.
    case undefined:
    case "train":
    case "today":
      return { view: "today" };
    case "core":
    case "progress":
    case "vitals":
    case "system":
      return { view: head };
    default:
      return { view: "today" };
  }
}

/**
 * Subscribe to route changes; fires immediately with the current route.
 * @param {(route: { view: string }) => void} onChange
 */
export function initRouter(onChange) {
  const fire = () => onChange(parseRoute(location.hash));
  window.addEventListener("hashchange", fire);
  fire();
}
