// MorphemeFlow Reader — Tauri application

mod capture;
mod ocr;

use engine::{MorphemeAnalyzer, Tokenizer, WordCache};
use serde::Serialize;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    Emitter, Manager, PhysicalPosition, PhysicalSize, State, WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

const DEFAULT_CAPTURE_HOTKEY: &str = "ctrl+shift+m";
const DEFAULT_OCR_HOTKEY: &str = "ctrl+shift+r";

fn init_crash_log() {
    let log_dir = app_data_dir().map(|directory| directory.join("logs"));
    if let Some(directory) = log_dir {
        let _ = std::fs::create_dir_all(&directory);
        let log_path = directory.join("reader.log");
        std::panic::set_hook(Box::new(move |info| {
            let message = format!("[{}] PANIC: {}\n", timestamp(), info);
            let _ = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_path)
                .and_then(|mut file| {
                    use std::io::Write;
                    file.write_all(message.as_bytes())
                });
            eprintln!("{message}");
        }));
    }
}

fn app_data_dir() -> Option<std::path::PathBuf> {
    std::env::var_os("APPDATA").map(|path| std::path::PathBuf::from(path).join("MorphemeFlow"))
}

fn timestamp() -> String {
    let duration = std::time::SystemTime::now()
        .duration_since(std::time::SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}s", duration.as_secs())
}

fn log_info(message: &str) {
    if let Some(directory) = app_data_dir().map(|path| path.join("logs")) {
        let _ = std::fs::create_dir_all(&directory);
        let entry = format!("[{}] INFO: {}\n", timestamp(), message);
        let _ = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(directory.join("reader.log"))
            .and_then(|mut file| {
                use std::io::Write;
                file.write_all(entry.as_bytes())
            });
    }
}

struct AppState {
    analyzer: MorphemeAnalyzer,
    tokenizer: Tokenizer,
    cache: Mutex<WordCache>,
    hotkeys: Mutex<HotkeyConfig>,
    ocr_selection: Mutex<Option<OcrSelectionState>>,
    capture_busy: AtomicBool,
}

#[derive(Clone)]
struct HotkeyConfig {
    capture: String,
    ocr: String,
}

#[derive(Clone, Copy)]
struct OcrSelectionState {
    origin_x: i32,
    origin_y: i32,
    scale_factor: f64,
    reader_was_visible: bool,
}

#[derive(Serialize)]
struct AnalyzedToken {
    text: String,
    token_type: String,
    morphemes: Option<Vec<MorphemeInfo>>,
    syllables: Option<Vec<String>>,
    tier: Option<String>,
}

#[derive(Serialize)]
struct MorphemeInfo {
    text: String,
    m_type: String,
    meaning: Option<String>,
}

#[derive(Serialize)]
struct AnalysisResult {
    tokens: Vec<AnalyzedToken>,
    word_count: usize,
    analysis_ms: f64,
}

#[derive(Clone, Serialize)]
struct SelectionCaptured {
    text: String,
}

#[derive(Clone, Serialize)]
struct ReaderStatus {
    kind: String,
    message: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OcrSelectionStarted {
    max_image_dimension: u32,
    scale_factor: f64,
}

#[tauri::command]
fn analyze_text(text: String, state: State<'_, AppState>) -> AnalysisResult {
    let start = std::time::Instant::now();
    let tokens = state.tokenizer.tokenize(&text);
    let mut analyzed_tokens = Vec::with_capacity(tokens.len());
    let mut word_count = 0;
    let mut cache = state
        .cache
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());

    for token in &tokens {
        match token.token_type {
            engine::TokenType::Word => {
                word_count += 1;
                let analyzed = if let Some(cached) = cache.get(&token.text) {
                    cached.clone()
                } else {
                    let result = state.analyzer.analyze(&token.text);
                    cache.put(&token.text, result.clone());
                    result
                };

                let morphemes = analyzed
                    .morphemes
                    .iter()
                    .map(|morpheme| MorphemeInfo {
                        text: morpheme.text.clone(),
                        m_type: match morpheme.m_type {
                            engine::MorphemeType::Prefix => "prefix".to_string(),
                            engine::MorphemeType::Root => "root".to_string(),
                            engine::MorphemeType::Suffix => "suffix".to_string(),
                            engine::MorphemeType::Inflection => "inflection".to_string(),
                        },
                        meaning: morpheme.meaning.clone(),
                    })
                    .collect();

                let tier = match analyzed.tier {
                    engine::Tier::Dictionary => "dictionary",
                    engine::Tier::Rule => "rule",
                    engine::Tier::Syllable => "syllable",
                };

                analyzed_tokens.push(AnalyzedToken {
                    text: token.text.clone(),
                    token_type: "word".to_string(),
                    morphemes: Some(morphemes),
                    syllables: Some(analyzed.syllables),
                    tier: Some(tier.to_string()),
                });
            }
            _ => {
                let token_type = match token.token_type {
                    engine::TokenType::Whitespace => "whitespace",
                    engine::TokenType::Punctuation => "punctuation",
                    engine::TokenType::Number => "number",
                    _ => "other",
                };
                analyzed_tokens.push(AnalyzedToken {
                    text: token.text.clone(),
                    token_type: token_type.to_string(),
                    morphemes: None,
                    syllables: None,
                    tier: None,
                });
            }
        }
    }

    AnalysisResult {
        tokens: analyzed_tokens,
        word_count,
        analysis_ms: start.elapsed().as_secs_f64() * 1000.0,
    }
}

#[tauri::command]
fn get_dictionary_size(state: State<'_, AppState>) -> usize {
    state.analyzer.dictionary_size()
}

#[tauri::command]
fn get_cache_stats(state: State<'_, AppState>) -> (usize, f64) {
    let cache = state
        .cache
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    (cache.len(), cache.hit_rate())
}

#[tauri::command]
fn window_role(window: tauri::WebviewWindow) -> String {
    window.label().to_string()
}

#[tauri::command]
fn capture_selection_cmd(app: tauri::AppHandle) -> Result<(), String> {
    trigger_selection_capture(app);
    Ok(())
}

#[tauri::command]
fn start_ocr_selection(app: tauri::AppHandle) -> Result<(), String> {
    begin_ocr_selection(&app)
}

#[tauri::command]
fn cancel_ocr_selection(app: tauri::AppHandle) -> Result<(), String> {
    let selection = {
        let state = app.state::<AppState>();
        let selection = state
            .ocr_selection
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .take();
        selection
    };
    if let Some(window) = app.get_webview_window("ocr") {
        window
            .hide()
            .map_err(|error| format!("Failed to close OCR selector: {error}"))?;
    }
    if selection.is_some_and(|state| state.reader_was_visible) {
        show_reader(&app);
    }
    Ok(())
}

#[tauri::command]
fn complete_ocr_selection(
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    app: tauri::AppHandle,
) -> Result<Option<String>, String> {
    if !x.is_finite()
        || !y.is_finite()
        || !width.is_finite()
        || !height.is_finite()
        || width < 8.0
        || height < 8.0
    {
        return Err("Drag a rectangle at least 8 pixels wide and high".to_string());
    }

    let selection = app
        .state::<AppState>()
        .ocr_selection
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .take()
        .ok_or_else(|| "OCR selection is no longer active".to_string())?;

    if let Some(window) = app.get_webview_window("ocr") {
        let _ = window.hide();
    }
    std::thread::sleep(std::time::Duration::from_millis(120));

    let physical_x = selection.origin_x + (x * selection.scale_factor).round() as i32;
    let physical_y = selection.origin_y + (y * selection.scale_factor).round() as i32;
    let physical_width = (width * selection.scale_factor).round() as i32;
    let physical_height = (height * selection.scale_factor).round() as i32;
    let result = ocr::ocr_region(physical_x, physical_y, physical_width, physical_height);

    show_reader(&app);
    match result {
        Ok(text) if !text.trim().is_empty() => {
            let text = text.trim().to_string();
            let _ = app.emit(
                "selection-captured",
                SelectionCaptured { text: text.clone() },
            );
            emit_status(&app, "success", "Text recognized from screen region");
            Ok(Some(text))
        }
        Ok(_) => {
            emit_status(
                &app,
                "warning",
                "No text was recognized. Try a tighter, higher-contrast region.",
            );
            Ok(None)
        }
        Err(error) => {
            emit_status(&app, "error", &error);
            Err(error)
        }
    }
}

#[tauri::command]
fn set_pinned(pinned: bool, app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Reader window is unavailable".to_string())?;
    window
        .set_always_on_top(pinned)
        .map_err(|error| format!("Could not change always-on-top mode: {error}"))
}

#[tauri::command]
fn set_hotkey(
    action: String,
    shortcut: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let shortcut = shortcut.trim();
    if shortcut.is_empty() || shortcut.len() > 64 {
        return Err("Enter a valid keyboard shortcut".to_string());
    }
    if action != "capture" && action != "ocr" {
        return Err(format!("Unknown hotkey action: {action}"));
    }

    let mut hotkeys = state
        .hotkeys
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let (old_shortcut, other_shortcut) = if action == "capture" {
        (hotkeys.capture.clone(), hotkeys.ocr.clone())
    } else {
        (hotkeys.ocr.clone(), hotkeys.capture.clone())
    };

    if shortcut.eq_ignore_ascii_case(&other_shortcut) {
        return Err("Capture and OCR must use different shortcuts".to_string());
    }
    if shortcut.eq_ignore_ascii_case(&old_shortcut) {
        return Ok(());
    }

    app.global_shortcut()
        .unregister(old_shortcut.as_str())
        .map_err(|error| format!("Could not unregister {old_shortcut}: {error}"))?;

    if let Err(error) = register_action_shortcut(&app, &action, shortcut) {
        let _ = register_action_shortcut(&app, &action, &old_shortcut);
        return Err(error);
    }

    if action == "capture" {
        hotkeys.capture = shortcut.to_string();
    } else {
        hotkeys.ocr = shortcut.to_string();
    }
    log_info(&format!("Updated {action} hotkey to {shortcut}"));
    Ok(())
}

fn emit_status(app: &tauri::AppHandle, kind: &str, message: &str) {
    log_info(&format!("{kind}: {message}"));
    let _ = app.emit(
        "reader-status",
        ReaderStatus {
            kind: kind.to_string(),
            message: message.to_string(),
        },
    );
}

fn show_reader(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn trigger_selection_capture(app: tauri::AppHandle) {
    let source_window = capture::foreground_window_handle();
    if app
        .state::<AppState>()
        .capture_busy
        .swap(true, Ordering::AcqRel)
    {
        emit_status(&app, "warning", "A text capture is already in progress");
        return;
    }

    std::thread::spawn(move || {
        let result = capture::capture_selection(source_window);
        app.state::<AppState>()
            .capture_busy
            .store(false, Ordering::Release);
        show_reader(&app);

        match result {
            Ok(Some(text)) => {
                let _ = app.emit("selection-captured", SelectionCaptured { text });
                emit_status(&app, "success", "Selected text captured");
            }
            Ok(None) => emit_status(
                &app,
                "warning",
                "No selected text was copied. Select text first, then try again.",
            ),
            Err(error) => emit_status(&app, "error", &error),
        }
    });
}

fn begin_ocr_selection(app: &tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let mut active = state
        .ocr_selection
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if active.is_some() {
        return Ok(());
    }

    let cursor = app
        .cursor_position()
        .map_err(|error| format!("Could not locate the pointer: {error}"))?;
    let monitor = app
        .monitor_from_point(cursor.x, cursor.y)
        .map_err(|error| format!("Could not identify the current monitor: {error}"))?
        .or(app
            .primary_monitor()
            .map_err(|error| format!("Could not identify the primary monitor: {error}"))?)
        .ok_or_else(|| "No monitor is available for OCR selection".to_string())?;

    let window = app
        .get_webview_window("ocr")
        .ok_or_else(|| "OCR selector window is unavailable".to_string())?;
    let position = *monitor.position();
    let size = *monitor.size();
    let scale_factor = monitor.scale_factor();
    let reader_was_visible = app
        .get_webview_window("main")
        .and_then(|reader| reader.is_visible().ok())
        .unwrap_or(false);

    if let Some(reader) = app.get_webview_window("main") {
        let _ = reader.hide();
    }

    window
        .set_position(PhysicalPosition::new(position.x, position.y))
        .map_err(|error| format!("Could not position the OCR selector: {error}"))?;
    window
        .set_size(PhysicalSize::new(size.width, size.height))
        .map_err(|error| format!("Could not size the OCR selector: {error}"))?;
    window
        .set_always_on_top(true)
        .map_err(|error| format!("Could not raise the OCR selector: {error}"))?;

    *active = Some(OcrSelectionState {
        origin_x: position.x,
        origin_y: position.y,
        scale_factor,
        reader_was_visible,
    });
    drop(active);

    let start_result = window
        .show()
        .and_then(|_| window.set_focus())
        .map_err(|error| format!("Could not show the OCR selector: {error}"))
        .and_then(|_| {
            window
                .emit(
                    "ocr-selection-started",
                    OcrSelectionStarted {
                        max_image_dimension: ocr::max_image_dimension(),
                        scale_factor,
                    },
                )
                .map_err(|error| format!("Could not start OCR selection: {error}"))
        });

    if let Err(error) = start_result {
        state
            .ocr_selection
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .take();
        let _ = window.hide();
        if reader_was_visible {
            show_reader(app);
        }
        return Err(error);
    }

    log_info("OCR selection started");
    Ok(())
}

fn register_action_shortcut(
    app: &tauri::AppHandle,
    action: &str,
    shortcut: &str,
) -> Result<(), String> {
    let action = action.to_string();
    app.global_shortcut()
        .on_shortcut(shortcut, move |app, _shortcut, event| {
            if event.state != ShortcutState::Pressed {
                return;
            }
            if action == "capture" {
                trigger_selection_capture(app.clone());
            } else if let Err(error) = begin_ocr_selection(app) {
                show_reader(app);
                emit_status(app, "error", &error);
            }
        })
        .map_err(|error| format!("Could not register {shortcut}: {error}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_crash_log();
    log_info("MorphemeFlow Reader starting");

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(AppState {
            analyzer: MorphemeAnalyzer::new(),
            tokenizer: Tokenizer::new(),
            cache: Mutex::new(WordCache::new(5000)),
            hotkeys: Mutex::new(HotkeyConfig {
                capture: DEFAULT_CAPTURE_HOTKEY.to_string(),
                ocr: DEFAULT_OCR_HOTKEY.to_string(),
            }),
            ocr_selection: Mutex::new(None),
            capture_busy: AtomicBool::new(false),
        })
        .setup(|app| {
            let show = MenuItemBuilder::with_id("show", "Show Reader").build(app)?;
            let hide = MenuItemBuilder::with_id("hide", "Hide Reader").build(app)?;
            let separator_one = tauri::menu::PredefinedMenuItem::separator(app)?;
            let capture = MenuItemBuilder::with_id("capture", "Capture Selection").build(app)?;
            let snap = MenuItemBuilder::with_id("snap", "Snap Region (OCR)").build(app)?;
            let separator_two = tauri::menu::PredefinedMenuItem::separator(app)?;
            let settings = MenuItemBuilder::with_id("settings", "Settings").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show)
                .item(&hide)
                .item(&separator_one)
                .item(&capture)
                .item(&snap)
                .item(&separator_two)
                .item(&settings)
                .item(&quit)
                .build()?;

            TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("MorphemeFlow Reader")
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => show_reader(app),
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "capture" => trigger_selection_capture(app.clone()),
                    "snap" => {
                        if let Err(error) = begin_ocr_selection(app) {
                            show_reader(app);
                            emit_status(app, "error", &error);
                        }
                    }
                    "settings" => {
                        show_reader(app);
                        let _ = app.emit("open-settings", ());
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            register_action_shortcut(app.handle(), "capture", DEFAULT_CAPTURE_HOTKEY)
                .map_err(std::io::Error::other)?;
            register_action_shortcut(app.handle(), "ocr", DEFAULT_OCR_HOTKEY)
                .map_err(std::io::Error::other)?;

            if let Some(window) = app.get_webview_window("main") {
                let window_for_close = window.clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_for_close.hide();
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            analyze_text,
            get_dictionary_size,
            get_cache_stats,
            window_role,
            capture_selection_cmd,
            start_ocr_selection,
            cancel_ocr_selection,
            complete_ocr_selection,
            set_pinned,
            set_hotkey,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MorphemeFlow Reader");
}
