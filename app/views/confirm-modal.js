import { html } from "htm/preact";
import { useEffect, useRef } from "preact/hooks";

/**
 * In-app replacement for window.confirm (roadmap A2): native confirms look
 * unprofessional, block the JS thread, and can't be styled. One instance is
 * rendered at the App root, driven by main.js's askConfirm() promise state.
 * OK is focused on open; Escape or an overlay tap cancels.
 * @param {{ message: string, onResolve: (ok: boolean) => void }} props
 */
export function ConfirmModal({ message, onResolve }) {
  const okRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  // latest-callback ref: the keydown listener attaches once, but must never
  // resolve a stale promise if the parent re-renders with a new onResolve
  const resolveRef = useRef(onResolve);
  resolveRef.current = onResolve;
  useEffect(() => {
    okRef.current?.focus();
    const onKey = (/** @type {KeyboardEvent} */ e) => {
      if (e.key === "Escape") resolveRef.current(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return html`
    <div class="scrim" onClick=${() => onResolve(false)}>
      <div
        class="sheet"
        role="alertdialog"
        aria-modal="true"
        aria-label=${message}
        onClick=${(/** @type {Event} */ e) => e.stopPropagation()}
      >
        <p class="sheet__msg">${message}</p>
        <div class="act">
          <button class="ghost" onClick=${() => onResolve(false)}>CANCEL</button>
          <button class="cta" ref=${okRef} onClick=${() => onResolve(true)}>OK</button>
        </div>
      </div>
    </div>
  `;
}
