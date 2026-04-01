// MorphemeFlow — Main Tauri Application
// Desktop overlay app that provides universal dyslexia reading support.
//
// SAFETY: Overlay starts HIDDEN. Ctrl+Shift+M toggles it. Escape hides it.
// The system tray always remains accessible for quit/toggle.

mod overlay_window;
pub mod text_detection;

use text_detection::{detect_text_in_active_window, TextRegion};

/// Tauri command: detect text on screen and return text regions
#[tauri::command]
fn scan_screen_text() -> Vec<TextRegion> {
    detect_text_in_active_window()
}

/// Tauri command: dump current UIA scan data to a JSON file for offline testing
#[tauri::command]
fn dump_regions() -> Result<String, String> {
    let regions = detect_text_in_active_window();
    let json = serde_json::to_string_pretty(&regions).map_err(|e| e.to_string())?;
    let path = std::env::current_dir()
        .unwrap_or_default()
        .join("../../test/fixtures/captured-regions.json");
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&path, &json).map_err(|e| e.to_string())?;
    let abs = std::fs::canonicalize(&path).unwrap_or(path);
    eprintln!("[MorphemeFlow] Dumped {} regions to {:?}", regions.len(), abs);
    Ok(format!("Saved {} regions to {:?}", regions.len(), abs))
}

/// Tauri command: toggle the overlay on/off
#[tauri::command]
fn toggle_overlay(app: tauri::AppHandle) -> Result<bool, String> {
    overlay_window::toggle_overlay(&app).map_err(|e| e.to_string())
}

/// Tauri command: show settings window
#[tauri::command]
fn show_settings(app: tauri::AppHandle) -> Result<(), String> {
    overlay_window::show_settings(&app).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin({
            use tauri_plugin_global_shortcut::ShortcutState;
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        let shortcut_str = shortcut.to_string();
                        if shortcut_str.contains("M") {
                            // Ctrl+Shift+M: toggle overlay
                            let _ = overlay_window::toggle_overlay(app);
                        } else if shortcut_str.contains("Q") {
                            // Ctrl+Shift+Q: emergency hide overlay
                            let _ = overlay_window::hide_overlay(app);
                            eprintln!("[MorphemeFlow] Emergency: overlay hidden via Ctrl+Shift+Q");
                        }
                    }
                })
                .build()
        })
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            scan_screen_text,
            dump_regions,
            toggle_overlay,
            show_settings,
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // Set up overlay window properties (click-through, etc.)
            // NOTE: Overlay starts HIDDEN (set in tauri.conf.json visible:false)
            if let Err(e) = overlay_window::setup_overlay_window(&handle) {
                eprintln!("Failed to setup overlay: {}", e);
            }

            // Register global hotkeys
            use tauri_plugin_global_shortcut::GlobalShortcutExt;
            app.global_shortcut().register("CmdOrCtrl+Shift+M")?;
            app.global_shortcut().register("CmdOrCtrl+Shift+Q")?;

            // Set up system tray
            #[cfg(desktop)]
            {
                use tauri::menu::{MenuBuilder, MenuItemBuilder};
                use tauri::tray::TrayIconBuilder;

                let toggle_item = MenuItemBuilder::with_id("toggle", "Toggle Overlay (Ctrl+Shift+M)").build(app)?;
                let settings_item = MenuItemBuilder::with_id("settings", "Settings...").build(app)?;
                let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
                let quit_item = MenuItemBuilder::with_id("quit", "Quit MorphemeFlow").build(app)?;

                let menu = MenuBuilder::new(app)
                    .items(&[&toggle_item, &settings_item, &separator, &quit_item])
                    .build()?;

                let app_handle = app.handle().clone();
                TrayIconBuilder::new()
                    .tooltip("MorphemeFlow — Ctrl+Shift+M to toggle")
                    .menu(&menu)
                    .on_menu_event(move |_tray, event| {
                        match event.id().as_ref() {
                            "toggle" => { let _ = overlay_window::toggle_overlay(&app_handle); }
                            "settings" => { let _ = overlay_window::show_settings(&app_handle); }
                            "quit" => { std::process::exit(0); }
                            _ => {}
                        }
                    })
                    .build(app)?;
            }

            eprintln!("[MorphemeFlow] Started. Overlay is HIDDEN.");
            eprintln!("[MorphemeFlow] Press Ctrl+Shift+M to toggle overlay.");
            eprintln!("[MorphemeFlow] Press Ctrl+Shift+Q to emergency hide.");
            eprintln!("[MorphemeFlow] Right-click tray icon to quit.");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running MorphemeFlow");
}
