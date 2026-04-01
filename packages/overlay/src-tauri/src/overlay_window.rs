// MorphemeFlow — Overlay Window Management
// Creates and manages the transparent, always-on-top, click-through overlay window.

use tauri::{AppHandle, Manager};

/// Set up the overlay window as transparent and click-through.
/// On Windows, this uses WS_EX_LAYERED and WS_EX_TRANSPARENT extended styles
/// so mouse events pass through to the application underneath.
pub fn setup_overlay_window(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let overlay = app.get_webview_window("overlay")
        .ok_or("Overlay window not found")?;

    // Make the overlay ignore mouse events (click-through)
    overlay.set_ignore_cursor_events(true)?;

    // Ensure it stays on top
    overlay.set_always_on_top(true)?;

    Ok(())
}

/// Toggle overlay visibility
pub fn toggle_overlay(app: &AppHandle) -> Result<bool, Box<dyn std::error::Error>> {
    let overlay = app.get_webview_window("overlay")
        .ok_or("Overlay window not found")?;

    let visible = overlay.is_visible()?;
    if visible {
        overlay.hide()?;
    } else {
        overlay.show()?;
    }

    Ok(!visible)
}

/// Emergency: force-hide the overlay (Ctrl+Shift+Escape safety valve)
pub fn hide_overlay(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let overlay = app.get_webview_window("overlay")
        .ok_or("Overlay window not found")?;

    overlay.hide()?;
    Ok(())
}

/// Show the settings window
pub fn show_settings(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let settings = app.get_webview_window("settings")
        .ok_or("Settings window not found")?;

    settings.show()?;
    settings.set_focus()?;

    Ok(())
}
