use crate::{ocr, overlay::ScreenRect};
use serde::Serialize;
use std::sync::Mutex;
use tauri::{Emitter, Manager, PhysicalPosition, PhysicalSize};

#[derive(Clone, Copy, Default, Serialize)]
pub struct LensState {
    pub enabled: bool,
    pub paused: bool,
    #[serde(skip)]
    generation: u64,
    #[serde(skip)]
    busy: bool,
}

pub struct LensSession(pub Mutex<LensState>);

#[derive(Serialize)]
pub struct LensFrame {
    pub text: Option<String>,
    pub status: String,
    #[serde(skip)]
    placement: Option<ScreenRect>,
}

impl LensFrame {
    fn empty(status: &str) -> Self {
        Self {
            text: None,
            status: status.to_string(),
            placement: None,
        }
    }
}

#[tauri::command]
pub fn get_lens_state(app: tauri::AppHandle) -> LensState {
    *app.state::<LensSession>()
        .0
        .lock()
        .unwrap_or_else(|error| error.into_inner())
}

#[tauri::command]
pub fn set_lens_enabled(enabled: bool, app: tauri::AppHandle) -> Result<(), String> {
    if enabled && crate::is_closing(&app) {
        return Err("MorphemeFlow is closing".to_string());
    }
    let session = app.state::<LensSession>();
    let mut state = session.0.lock().unwrap_or_else(|error| error.into_inner());
    state.enabled = enabled;
    state.paused = false;
    state.generation = state.generation.wrapping_add(1);
    let next = *state;
    drop(state);
    if !enabled {
        if let Some(window) = app.get_webview_window("lens") {
            #[cfg(windows)]
            {
                use windows::Win32::{
                    Foundation::HWND,
                    UI::WindowsAndMessaging::{ShowWindow, SW_HIDE},
                };
                let handle = window.hwnd().map_err(|error| error.to_string())?;
                unsafe {
                    let _ = ShowWindow(HWND(handle.0), SW_HIDE);
                }
            }
            #[cfg(not(windows))]
            window.hide().map_err(|error| error.to_string())?;
        }
    }
    app.emit("lens-state-changed", next)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_lens_paused(paused: bool, app: tauri::AppHandle) -> Result<(), String> {
    let session = app.state::<LensSession>();
    let mut state = session.0.lock().unwrap_or_else(|error| error.into_inner());
    state.paused = paused;
    state.generation = state.generation.wrapping_add(1);
    app.emit("lens-state-changed", *state)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn capture_lens(app: tauri::AppHandle) -> Result<LensFrame, String> {
    let generation = {
        let session = app.state::<LensSession>();
        let mut state = session.0.lock().unwrap_or_else(|error| error.into_inner());
        if !state.enabled || state.paused || state.busy {
            return Ok(LensFrame::empty("Paused"));
        }
        state.busy = true;
        state.generation
    };
    let worker_app = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || capture(&worker_app)).await;
    let session = app.state::<LensSession>();
    let mut state = session.0.lock().unwrap_or_else(|error| error.into_inner());
    state.busy = false;
    if !state.enabled || state.paused || state.generation != generation {
        return Ok(LensFrame::empty("Paused"));
    }
    drop(state);
    let frame = result.map_err(|error| error.to_string())??;
    if let Some(placement) = frame.placement {
        let show_app = app.clone();
        app.run_on_main_thread(move || {
            let session = show_app.state::<LensSession>();
            let state = session.0.lock().unwrap_or_else(|error| error.into_inner());
            if !state.enabled || state.paused || state.generation != generation {
                return;
            }
            if let Some(window) = show_app.get_webview_window("lens") {
                let _ = window.set_position(PhysicalPosition::new(placement.x, placement.y));
                let _ = window.set_size(PhysicalSize::new(
                    placement.width as u32,
                    placement.height as u32,
                ));
                #[cfg(windows)]
                if let Ok(handle) = window.hwnd() {
                    use windows::Win32::{Foundation::HWND, UI::WindowsAndMessaging::*};
                    unsafe {
                        let _ = SetWindowPos(
                            HWND(handle.0),
                            Some(HWND_TOPMOST),
                            0,
                            0,
                            0,
                            0,
                            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
                        );
                    }
                }
            }
        })
        .map_err(|error| error.to_string())?;
    }
    Ok(frame)
}

pub fn capture_bounds(
    bounds: ScreenRect,
    pointer_x: i32,
    pointer_y: i32,
    width: i32,
    height: i32,
) -> ScreenRect {
    let width = width.clamp(1, bounds.width.max(1));
    let height = height.clamp(1, bounds.height.max(1));
    ScreenRect {
        x: (pointer_x - width / 2).clamp(bounds.x, bounds.x + bounds.width - width),
        y: (pointer_y - height / 2).clamp(bounds.y, bounds.y + bounds.height - height),
        width,
        height,
    }
}

pub fn lens_bounds(
    monitor: ScreenRect,
    source: ScreenRect,
    width: i32,
    height: i32,
    gap: i32,
) -> Option<ScreenRect> {
    let width = width.min(monitor.width).max(1);
    let above_space = (source.y - monitor.y - gap).max(0);
    let below_space = (monitor.y + monitor.height - source.y - source.height - gap).max(0);
    let height = height.min(above_space.max(below_space));
    if height < 80 {
        return None;
    }
    let below = source.y + source.height + gap;
    let top = if below_space >= height {
        below
    } else {
        source.y - height - gap
    };
    Some(ScreenRect {
        x: source.x.clamp(monitor.x, monitor.x + monitor.width - width),
        y: top.clamp(monitor.y, monitor.y + monitor.height - height),
        width,
        height,
    })
}

#[cfg(windows)]
fn capture(app: &tauri::AppHandle) -> Result<LensFrame, String> {
    use windows::Win32::{
        Foundation::{HWND, POINT, RECT},
        UI::WindowsAndMessaging::*,
    };
    unsafe {
        let mut pointer = POINT::default();
        GetCursorPos(&mut pointer).map_err(|error| error.to_string())?;
        let source = GetAncestor(WindowFromPoint(pointer), GA_ROOT);
        let mut process = 0;
        GetWindowThreadProcessId(source, Some(&mut process));
        if source.is_invalid() || process == std::process::id() {
            return Ok(LensFrame::empty("Point at text in another app"));
        }
        let mut affinity = 0;
        if GetWindowDisplayAffinity(source, &mut affinity).is_ok() && affinity != WDA_NONE.0 {
            return Ok(LensFrame::empty(
                "This window does not allow screen capture",
            ));
        }
        let monitor = app
            .monitor_from_point(pointer.x as f64, pointer.y as f64)
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "No display is available".to_string())?;
        let monitor_bounds = ScreenRect {
            x: monitor.position().x,
            y: monitor.position().y,
            width: monitor.size().width as i32,
            height: monitor.size().height as i32,
        };
        let mut source_rect = RECT::default();
        GetWindowRect(source, &mut source_rect).map_err(|error| error.to_string())?;
        let left = source_rect.left.max(monitor_bounds.x);
        let top = source_rect.top.max(monitor_bounds.y);
        let bounds = ScreenRect {
            x: left,
            y: top,
            width: source_rect
                .right
                .min(monitor_bounds.x + monitor_bounds.width)
                - left,
            height: source_rect
                .bottom
                .min(monitor_bounds.y + monitor_bounds.height)
                - top,
        };
        if bounds.width < 8 || bounds.height < 8 {
            return Ok(LensFrame::empty("No readable region under the pointer"));
        }
        let scale = monitor.scale_factor();
        let region = capture_bounds(
            bounds,
            pointer.x,
            pointer.y,
            ((760.0 * scale) as i32).min(ocr::max_image_dimension() as i32),
            ((100.0 * scale) as i32).min(ocr::max_image_dimension() as i32),
        );
        let window = app
            .get_webview_window("lens")
            .ok_or_else(|| "Reading lens is unavailable".to_string())?;
        let handle = HWND(window.hwnd().map_err(|error| error.to_string())?.0);
        SetWindowDisplayAffinity(handle, WDA_EXCLUDEFROMCAPTURE)
            .map_err(|error| format!("Cannot exclude the reading lens from capture: {error}"))?;
        let text = ocr::ocr_stable_region(region.x, region.y, region.width, region.height)?;
        let mut after = POINT::default();
        GetCursorPos(&mut after).map_err(|error| error.to_string())?;
        if (after.x - pointer.x).abs() > 6
            || (after.y - pointer.y).abs() > 6
            || GetAncestor(WindowFromPoint(after), GA_ROOT) != source
        {
            return Ok(LensFrame::empty("Waiting for the pointer to settle"));
        }
        let placement = lens_bounds(
            monitor_bounds,
            region,
            (800.0 * scale) as i32,
            (260.0 * scale) as i32,
            (12.0 * scale) as i32,
        )
        .ok_or_else(|| {
            "Not enough display space for a lens. Use selection capture or reduce display scaling."
                .to_string()
        })?;
        let mut frame = match text {
            Some(text) if !text.trim().is_empty() => LensFrame {
                text: Some(text),
                status: "Screen OCR".to_string(),
                placement: None,
            },
            Some(_) => LensFrame::empty("No text recognized in this region"),
            None => LensFrame::empty("Screen changed during capture"),
        };
        frame.placement = Some(placement);
        Ok(frame)
    }
}

#[cfg(not(windows))]
fn capture(_app: &tauri::AppHandle) -> Result<LensFrame, String> {
    Err("The live reading lens requires Windows".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    const MONITOR: ScreenRect = ScreenRect {
        x: -1920,
        y: -200,
        width: 1920,
        height: 1080,
    };

    #[test]
    fn capture_region_stays_inside_source_at_edges() {
        for pointer_x in [-4000, -1920, -500, -1, 1000] {
            for pointer_y in [-1000, -200, 300, 879, 2000] {
                let region = capture_bounds(MONITOR, pointer_x, pointer_y, 760, 100);
                assert!(region.x >= MONITOR.x && region.y >= MONITOR.y);
                assert!(region.x + region.width <= MONITOR.x + MONITOR.width);
                assert!(region.y + region.height <= MONITOR.y + MONITOR.height);
            }
        }
    }

    #[test]
    fn lens_uses_space_below_or_above_without_covering_source() {
        for source_y in [-100, 700] {
            let source = ScreenRect {
                x: -600,
                y: source_y,
                width: 600,
                height: 100,
            };
            let lens = lens_bounds(MONITOR, source, 800, 260, 12).unwrap();
            assert!(lens.y >= source.y + source.height || lens.y + lens.height <= source.y);
            assert!(lens.x >= MONITOR.x && lens.x + lens.width <= 0);
            assert!(lens.y >= MONITOR.y && lens.y + lens.height <= 880);
        }
    }

    #[test]
    fn high_dpi_lens_shrinks_to_available_space() {
        let source = ScreenRect {
            x: -1600,
            y: 220,
            width: 1520,
            height: 200,
        };
        let lens = lens_bounds(MONITOR, source, 1600, 520, 24).unwrap();
        assert!(lens.y >= source.y + source.height || lens.y + lens.height <= source.y);
        assert!(lens.height < 520);
        assert!(lens_bounds(MONITOR, MONITOR, 1600, 520, 24).is_none());
    }
}
