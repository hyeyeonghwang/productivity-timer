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

/// Destroys every existing celebration popup window. Safe to call at any time;
/// each destroy is dispatched to the main thread and failures are logged, never
/// propagated (cleanup must never break timer completion).
fn destroy_all_overlays(app: &tauri::AppHandle) {
    for (label, window) in app.webview_windows() {
        if !is_overlay_label(&label) {
            continue;
        }
        let window_to_destroy = window.clone();
        let label_for_log = label.clone();
        let dispatch = window.run_on_main_thread(move || {
            match window_to_destroy.destroy() {
                Ok(_) => println!("Celebration popup destroyed: {label_for_log}"),
                Err(e) => eprintln!("Failed to destroy celebration popup {label_for_log}: {e}"),
            }
        });
        if let Err(e) = dispatch {
            eprintln!("Failed to schedule destruction for {label}: {e}");
        }
    }
}

/// Schedules destruction of all celebration popups after the auto-dismiss
/// timeout, but only if this generation is still the current one. An older
/// timer must never tear down a newer celebration.
fn schedule_overlays_close(app: tauri::AppHandle, generation: u64) {
    std::thread::spawn(move || {
        std::thread::sleep(AUTO_DISMISS);

        // Do not let an older timer close a newer celebration.
        if CELEBRATION_GENERATION.load(Ordering::SeqCst) != generation {
            return;
        }

        destroy_all_overlays(&app);
    });
}

/// Shows the celebration popups, creating one per connected monitor.
///
/// Duplicate-prevention / generation logic is preserved: each call bumps a
/// global generation counter and only the latest generation is allowed to tear
/// the popups down. Back-to-back completions reuse the current generation's
/// behaviour by first clearing any stale popups, then recreating fresh ones and
/// emitting `celebrate` so the webview (re)starts its animation.
#[tauri::command]
async fn show_celebration(app: tauri::AppHandle) -> Result<(), String> {
    println!("show_celebration called");

    let generation = CELEBRATION_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;

    // Clean up any popups left over from a previous (possibly interrupted)
    // celebration before creating a fresh set. This keeps labels deterministic
    // (celebration-0, celebration-1, …) and avoids orphaned windows.
    destroy_all_overlays(&app);

    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    if monitors.is_empty() {
        eprintln!("No monitors detected; skipping celebration");
        return Ok(());
    }

    for (index, monitor) in monitors.iter().enumerate() {
        let label = overlay_label(index);

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

        let window = WebviewWindowBuilder::new(
            &app,
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
        .build()
        .map_err(|e| e.to_string())?;

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
    }

    // Also broadcast to any popup that may already be listening.
    let _ = app.emit("celebrate", ());

    schedule_overlays_close(app.clone(), generation);

    Ok(())
}

/// Closes all celebration popups. They also self-dismiss after the animation;
/// this command exists for an explicit close path.
#[tauri::command]
async fn close_celebration(app: tauri::AppHandle) -> Result<(), String> {
    destroy_all_overlays(&app);
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
