export type Theme = "light" | "dark" | "system";

/** No value stored (key absent) means "system" — see THEME_INIT_SCRIPT below. */
export const THEME_STORAGE_KEY = "fuelizer-theme";

/**
 * Raw JS, not a TS function — this runs via next/script's `beforeInteractive`
 * strategy (components/theme/theme-init-script.tsx), injected into <head> and
 * executed before hydration, so the `dark` class lands on <html> before first
 * paint and there's no flash of the wrong theme. Keep this logic in sync with
 * applyTheme() below by hand; it can't import or call it directly since it
 * has to exist as a plain string.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var isDark = stored === "dark" || (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  } catch (e) {}
})();
`;

// Lets components/theme/theme-toggle.tsx read the current theme via
// useSyncExternalStore instead of a useEffect+setState-on-mount (which
// forces an extra render and reads localStorage during SSR where it
// doesn't exist) -- applyTheme() notifies these listeners after every
// change, and useSyncExternalStore re-reads readStoredTheme() in response.
const listeners = new Set<() => void>();

/** Client-only — call from a "use client" component. */
export function subscribeThemeChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Applies `theme` immediately (toggles the `dark` class) and persists the
 * choice, so it's still in effect on the next visit via THEME_INIT_SCRIPT.
 * "system" clears the stored key rather than writing the literal string, so
 * THEME_INIT_SCRIPT's "no value stored" branch is the single source of truth
 * for what "system" means. Client-only — call from a "use client" component.
 */
export function applyTheme(theme: Theme): void {
  try {
    if (theme === "system") {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  } catch {
    // Storage may be unavailable (private browsing, disabled) — the class
    // toggle below still applies for this tab even if it can't persist.
  }

  const isDark =
    theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
  listeners.forEach((listener) => listener());
}

/**
 * Reads the currently-stored preference, defaulting to "system" if unset
 * (including on the server, where localStorage doesn't exist — see
 * useSyncExternalStore's getServerSnapshot in theme-toggle.tsx).
 */
export function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // Storage may be unavailable, or we're on the server — fall through.
  }
  return "system";
}
