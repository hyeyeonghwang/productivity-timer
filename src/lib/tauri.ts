/**
 * Thin wrapper around the Tauri desktop APIs used by the app.
 *
 * Every function degrades to a safe no-op when running outside Tauri (e.g. the
 * plain web build, Vitest, or `vite preview`), so the timer behaves identically
 * in the browser and the desktop app. Browser side effects stay out of the pure
 * core and the presentational components — this module lives in `src/lib`.
 */
import type { UnlistenFn } from '@tauri-apps/api/event';

/** True when running inside a Tauri webview. */
export function isTauri(): boolean {
  // Tauri v2 exposes this marker on the window object.
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Shows the fullscreen celebration overlay. No-op (resolves) outside Tauri.
 * Never throws into caller logic.
 */
export async function showCelebration(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('show_celebration');
  } catch {
    /* overlay is best-effort; never break timer completion */
  }
}

/** Closes the celebration overlay. No-op outside Tauri; never throws. */
export async function closeCelebration(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('close_celebration');
  } catch {
    /* ignore */
  }
}

/**
 * Subscribes to the `celebrate` event emitted by the Rust side when the overlay
 * should (re)start its animation. Returns an unlisten function (or a no-op one
 * outside Tauri).
 */
export async function onCelebrate(handler: () => void): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};
  try {
    const { listen } = await import('@tauri-apps/api/event');
    return await listen('celebrate', () => handler());
  } catch {
    return () => {};
  }
}
