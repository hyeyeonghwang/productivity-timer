//! Productivity Timer desktop shell (Tauri v2).
//!
//! The timer itself is the existing React/Vite web app, loaded unchanged into
//! the main window. This Rust layer only adds the desktop shell and a
//! transparent, always-on-top celebration popup shown when the timer completes.
//!
//! The celebration is rendered as a *small* popup (not fullscreen) on **every**
//! connected monitor. Each popup is a separate `WebviewWindow` that loads
//! `overlay.html`, with a unique label `celebration-0`, `celebration-1`, …
//! Each popup is:
//! - transparent (so the desktop/other apps show through),
//! - always-on-top,
//! - small (~420x180), borderless, positioned near the monitor's bottom-right
//!   corner with a ~24px margin (NOT fullscreen),
//! - click-through (ignores cursor events) so it never blocks the user,
//! - skipped in the taskbar and not focused when shown.
//!
//! ## Window lifecycle (why repeated completions used to break)
//!
//! `WebviewWindow::destroy()` and `WebviewWindowBuilder::build()` must be
//! sequenced carefully. `run_on_main_thread` only *enqueues* a closure onto the
//! event loop and returns immediately — it does **not** wait for the closure to
//! run. The previous implementation destroyed the old popups via
//! `run_on_main_thread` and then, still on the async command thread, built new
//! windows with the same labels (`celebration-0`, …). Because destruction had
//! not actually happened yet, the builder frequently failed with a
//! "label already in use" error, `show_celebration` returned `Err`, and no
//! popups appeared — until an app restart cleared the stale windows. This
//! matched the intermittent "focus popups stop appearing" report.
//!
//! The fix: run the entire teardown-then-recreate sequence **inside a single
//! closure on the main thread**. On the main thread `destroy()` runs to
//! completion and removes the window from the webview registry before the
//! builder for the same label executes, so labels are reliably free for reuse.

use std::{
    sync::atomic::{AtomicU64, Ordering},
    time::Duration,
};

use tauri::{
    Emitter, LogicalSize, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder,
};

/// Label prefix for every per-monitor celebration popup window.
const OVERLAY_LABEL_PREFIX: &str = "celebration-";

/// Popup size, in logical pixels.
const POPUP_WIDTH: f64 = 420.0;
const POPUP_HEIGHT: f64 = 180.0;

/// Margin from the monitor's bottom-right corner, in logical pixels.
const POPUP_MARGIN: f64 = 24.0;

/// How long the celebration stays up before auto-dismissing.
const AUTO_DISMISS: Duration = Duration::from_secs(4);

static CELEBRATION_GENERATION: AtomicU64 = AtomicU64::new(0);

/// Builds the unique window label for the popup on monitor `index`.
fn overlay_label(index: usize) -> String {
    format!("{OVERLAY_LABEL_PREFIX}{index}")
}

/// Returns true when `label` belongs to a celebration popup window.
fn is_overlay_label(label: &str) -> bool {
    label.starts_with(OVERLAY_LABEL_PREFIX)
}

/// Synchronously destroys every existing celebration popup window.
///
/// **Must be called on the main thread.** `WebviewWindow::destroy()` removes
/// the window from the app's webview registry when run on the main thread, so
/// after this returns the celebration labels are free to be reused by a fresh
/// `WebviewWindowBuilder`. Failures are logged, never propagated — cleanup must
/// never break timer completion.
fn destroy_all_overlays_on_main(app: &tauri::AppHandle) {
    let existing: Vec<String> = app
        .webview_windows()
        .into_keys()
        .filter(|label| is_overlay_label(label))
        .collect();

    if existing.is_empty() {
        println!("[celebration] no existing celebration windows to destroy");
        return;
    }

    println!(
        "[celebration] destroying {} existing celebration window(s): {:?}",
        existing.len(),
        existing
    );

    for label in existing {
        match app.get_webview_window(&label) {
            Some(window) => match window.destroy() {
                Ok(_) => println!("[celebration] destroyed window: {label}"),
                Err(e) => eprintln!("[celebration] failed to destroy window {label}: {e}"),
            },
            None => println!("[celebration] window already gone: {label}"),
        }
    }
}

/// Creates one celebration popup per connected monitor. Must run on the main
/// thread (called from the teardown-then-recreate closure). Returns the number
/// of popups successfully created.
fn create_overlays_on_main(app: &tauri::AppHandle) -> usize {
    let monitors = match app.available_monitors() {
        Ok(m) => m,
        Err(e) => {
            eprintln!("[celebration] failed to enumerate monitors: {e}");
            return 0;
        }
    };

    if monitors.is_empty() {
        eprintln!("[celebration] no monitors detected; skipping celebration");
        return 0;
    }

    println!("[celebration] creating popups across {} monitor(s)", monitors.len());

    let mut created = 0usize;

    for (index, monitor) in monitors.iter().enumerate() {
        let label = overlay_label(index);

        // Defensive: if a label is somehow still taken (should not happen now
        // that destruction is synchronous), skip rather than fail the whole
        // batch so the other monitors still get a popup.
        if app.get_webview_window(&label).is_some() {
            eprintln!(
                "[celebration] label {label} still in use after teardown; skipping this monitor"
            );
            continue;
        }

        // Compute the bottom-right position in *physical* pixels using the
        // monitor's work area (excludes the taskbar) so the popup is anchored
        // correctly regardless of DPI scaling or monitor layout.
        let scale = monitor.scale_factor();
        let work_area = monitor.work_area();
        let margin_px = (POPUP_MARGIN * scale).round() as i32;
        let popup_w_px = (POPUP_WIDTH * scale).round() as i32;
        let popup_h_px = (POPUP_HEIGHT * scale).round() as i32;

        let area_right = work_area.position.x + work_area.size.width as i32;
        let area_bottom = work_area.position.y + work_area.size.height as i32;
        let x = area_right - popup_w_px - margin_px;
        let y = area_bottom - popup_h_px - margin_px;

        let built = WebviewWindowBuilder::new(
            app,
            &label,
            WebviewUrl::App("overlay.html".into()),
        )
        .title("Celebration")
        .inner_size(POPUP_WIDTH, POPUP_HEIGHT)
        .position(0.0, 0.0) // placeholder; set precisely below in physical px
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(false)
        .shadow(false)
        .resizable(false)
        .visible(true)
        .build();

        let window = match built {
            Ok(w) => {
                println!("[celebration] created window: {label} (monitor {index})");
                w
            }
            Err(e) => {
                // Log and continue; one monitor failing must not abort the rest.
                eprintln!("[celebration] failed to create window {label}: {e}");
                continue;
            }
        };

        // Enforce logical size and the exact physical position. Setting the
        // physical position after creation reliably places the window on the
        // intended monitor (builder-time positioning can land on the primary
        // monitor in multi-monitor setups).
        let _ = window.set_size(LogicalSize::new(POPUP_WIDTH, POPUP_HEIGHT));
        let _ = window.set_position(PhysicalPosition::new(x, y));

        // Let the cursor pass through so the popup never blocks interaction.
        let _ = window.set_ignore_cursor_events(true);

        // Tell the freshly loaded overlay to start its animation.
        let _ = app.emit_to(label.as_str(), "celebrate", ());

        created += 1;
    }

    // Also broadcast to any popup that may already be listening.
    let _ = app.emit("celebrate", ());

    created
}

/// Schedules destruction of all celebration popups after the auto-dismiss
/// timeout, but only if this generation is still the current one. An older
/// timer must never tear down a newer celebration.
fn schedule_overlays_close(app: tauri::AppHandle, generation: u64) {
    std::thread::spawn(move || {
        std::thread::sleep(AUTO_DISMISS);

        // Do not let an older timer close a newer celebration.
        let current = CELEBRATION_GENERATION.load(Ordering::SeqCst);
        if current != generation {
            println!(
                "[celebration] auto-dismiss for generation {generation} skipped (current is {current})"
            );
            return;
        }

        println!("[celebration] auto-dismiss firing for generation {generation}");

        // Destruction must happen on the main thread. Re-check the generation
        // inside the closure to close the gap between the check above and the
        // teardown actually running.
        let dispatch = app.clone().run_on_main_thread(move || {
            let current = CELEBRATION_GENERATION.load(Ordering::SeqCst);
            if current != generation {
                println!(
                    "[celebration] auto-dismiss (main thread) for generation {generation} skipped (current is {current})"
                );
                return;
            }
            destroy_all_overlays_on_main(&app);
        });
        if let Err(e) = dispatch {
            eprintln!("[celebration] failed to schedule auto-dismiss teardown: {e}");
        }
    });
}

/// Shows the celebration popups, creating one per connected monitor.
///
/// Each call bumps a global generation counter. The teardown-then-recreate
/// sequence runs atomically on the main thread so that destroying the previous
/// popups completes before new windows reuse the same labels — this is what
/// makes repeated completions reliable indefinitely. Only the latest generation
/// is allowed to tear the popups down (see [`schedule_overlays_close`]).
#[tauri::command]
async fn show_celebration(app: tauri::AppHandle) -> Result<(), String> {
    let generation = CELEBRATION_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    println!("[celebration] show_celebration called (generation {generation})");

    // Run teardown + recreation together on the main thread. This is the heart
    // of the fix: destruction of the old popups finishes before the builder for
    // the same labels runs, so labels are never "already in use".
    let app_for_main = app.clone();
    let dispatch = app.run_on_main_thread(move || {
        // A newer completion may have arrived while we were queued; if so, let
        // it own the popups and skip this (stale) rebuild.
        let current = CELEBRATION_GENERATION.load(Ordering::SeqCst);
        if current != generation {
            println!(
                "[celebration] rebuild for generation {generation} superseded by {current}; skipping"
            );
            return;
        }

        destroy_all_overlays_on_main(&app_for_main);
        let created = create_overlays_on_main(&app_for_main);
        println!(
            "[celebration] generation {generation}: {created} popup(s) created"
        );
    });

    if let Err(e) = dispatch {
        eprintln!("[celebration] failed to dispatch show to main thread: {e}");
        return Err(e.to_string());
    }

    schedule_overlays_close(app, generation);

    Ok(())
}

/// Closes all celebration popups. They also self-dismiss after the animation;
/// this command exists for an explicit close path.
#[tauri::command]
async fn close_celebration(app: tauri::AppHandle) -> Result<(), String> {
    println!("[celebration] close_celebration called");
    let app_for_main = app.clone();
    let dispatch = app.run_on_main_thread(move || {
        destroy_all_overlays_on_main(&app_for_main);
    });
    if let Err(e) = dispatch {
        eprintln!("[celebration] failed to dispatch close to main thread: {e}");
        return Err(e.to_string());
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            show_celebration,
            close_celebration
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
