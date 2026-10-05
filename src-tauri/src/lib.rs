//! Productivity Timer desktop shell (Tauri v2).
//!
//! The timer itself is the existing React/Vite web app, loaded unchanged into
//! the main window. This Rust layer only adds the desktop shell and a
//! transparent, always-on-top, fullscreen celebration overlay shown when the
//! timer completes.
//!
//! The overlay is a *separate* WebviewWindow that loads `overlay.html`. It is:
//! - transparent (so the desktop/other apps show through),
//! - always-on-top,
//! - fullscreen & borderless,
//! - click-through (ignores cursor events) so it never blocks the user,
//! - skipped in the taskbar and not focused when shown.

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

/// Logical label of the celebration overlay window.
const OVERLAY_LABEL: &str = "celebration";

/// Shows the celebration overlay window, creating it if necessary.
///
/// If the overlay already exists (e.g. two completions in quick succession) it
/// is simply re-shown and the existing webview restarts its own animation on
/// the `celebrate` event emitted below.
#[tauri::command]
async fn show_celebration(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(OVERLAY_LABEL) {
        // Already created: make sure it is visible and on top, then re-trigger.
        let _ = window.show();
        let _ = window.set_always_on_top(true);
        let _ = app.emit_to(OVERLAY_LABEL, "celebrate", ());
        return Ok(());
    }

    let window = WebviewWindowBuilder::new(
        &app,
        OVERLAY_LABEL,
        WebviewUrl::App("overlay.html".into()),
    )
    .title("Celebration")
    .transparent(true)
    .decorations(false)
    .always_on_top(true)
    .fullscreen(true)
    .skip_taskbar(true)
    .focused(false)
    .shadow(false)
    .visible(true)
    .build()
    .map_err(|e| e.to_string())?;

    // Let the cursor pass through the overlay so it never blocks interaction.
    let _ = window.set_ignore_cursor_events(true);

    // Tell the freshly loaded overlay to start its animation.
    let _ = app.emit_to(OVERLAY_LABEL, "celebrate", ());

    Ok(())
}

/// Hides/closes the celebration overlay. The overlay also self-dismisses after
/// its animation; this command exists for an explicit close path.
#[tauri::command]
async fn close_celebration(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(OVERLAY_LABEL) {
        window.close().map_err(|e| e.to_string())?;
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
