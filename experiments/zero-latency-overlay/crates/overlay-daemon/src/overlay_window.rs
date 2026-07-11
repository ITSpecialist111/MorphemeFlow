use crate::tracker::{OverlayItem, OverlaySnapshot};
use engine::{MorphemeAnalyzer, MorphemeType};
use once_cell::sync::OnceCell;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use windows::core::{w, Error, Result};
use windows::Win32::Foundation::{BOOL, COLORREF, HWND, LPARAM, LRESULT, POINT, RECT, SIZE, WPARAM};
use windows::Win32::Graphics::Gdi::{
    BeginPaint, BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, CreateFontW, CreateSolidBrush,
    DeleteDC, DeleteObject, EndPaint, FillRect, FrameRect, GetTextExtentPoint32W, InvalidateRect,
    SelectObject, SetBkMode, SetTextColor, TextOutW, ANTIALIASED_QUALITY, CLIP_DEFAULT_PRECIS,
    DEFAULT_CHARSET, DEFAULT_PITCH, FF_DONTCARE, FW_BOLD, HGDIOBJ, OUT_DEFAULT_PRECIS,
    PAINTSTRUCT, SRCCOPY, TRANSPARENT,
};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DispatchMessageW, GetCursorPos, GetMessageW, GetSystemMetrics,
    PostQuitMessage, RegisterClassW, SetLayeredWindowAttributes, SetTimer, SetWindowPos, ShowWindow,
    TranslateMessage, CS_HREDRAW, CS_VREDRAW, CW_USEDEFAULT, HMENU, HWND_TOPMOST,
    LAYERED_WINDOW_ATTRIBUTES_FLAGS, MSG, SM_CXSCREEN, SM_CYSCREEN, SW_SHOWNA, SWP_NOACTIVATE,
    SWP_NOMOVE, SWP_NOSIZE, WINDOW_EX_STYLE, WINDOW_STYLE, WM_DESTROY, WM_ERASEBKGND, WM_NCHITTEST,
    WM_PAINT, WM_TIMER, WNDCLASSW, WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST,
    WS_EX_TRANSPARENT, WS_POPUP,
};

static SHARED_SNAPSHOT: OnceCell<Arc<Mutex<OverlaySnapshot>>> = OnceCell::new();
static MORPHEME_ANALYZER: OnceCell<MorphemeAnalyzer> = OnceCell::new();
static OVERLAY_CONFIG: OnceCell<OverlayConfig> = OnceCell::new();
static LAST_INVALIDATED_FRAME: AtomicU64 = AtomicU64::new(u64::MAX);
static LAST_INVALIDATE_AT: OnceCell<Mutex<Instant>> = OnceCell::new();
static STABLE_PRIMARY: OnceCell<Mutex<Option<StablePrimaryItem>>> = OnceCell::new();

#[derive(Clone)]
struct StablePrimaryItem {
    item: OverlayItem,
    last_seen: Instant,
    switched_at: Instant,
}

#[derive(Clone, Copy)]
struct OverlayConfig {
    show_debug_boxes: bool,
    show_telemetry: bool,
    strict_focus: bool,
    focus_lines: usize,
}

pub fn run_overlay_window(shared_snapshot: Arc<Mutex<OverlaySnapshot>>) -> Result<()> {
    SHARED_SNAPSHOT
        .set(shared_snapshot)
        .map_err(|_| Error::new(windows::Win32::Foundation::E_FAIL, "Overlay shared state already initialized"))?;
    OVERLAY_CONFIG
        .set(OverlayConfig {
            show_debug_boxes: env_flag_enabled("PERIPHERY_DEBUG_BOXES"),
            show_telemetry: env_flag_enabled("PERIPHERY_DEBUG_OVERLAY"),
            strict_focus: env_flag_enabled("PERIPHERY_STRICT_FOCUS"),
            focus_lines: focus_line_count_from_env(),
        })
        .map_err(|_| Error::new(windows::Win32::Foundation::E_FAIL, "Overlay config already initialized"))?;

    unsafe {
        let instance = GetModuleHandleW(None)?;
        let class_name = w!("PeripheryOverlayWindow");

        let wnd_class = WNDCLASSW {
            style: CS_HREDRAW | CS_VREDRAW,
            lpfnWndProc: Some(window_proc),
            hInstance: instance.into(),
            lpszClassName: class_name,
            ..Default::default()
        };

        if RegisterClassW(&wnd_class) == 0 {
            return Err(Error::from_win32());
        }

        let width = GetSystemMetrics(SM_CXSCREEN);
        let height = GetSystemMetrics(SM_CYSCREEN);

        let ex_style = WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE;
        let style = WINDOW_STYLE(WS_POPUP.0);
        let hwnd = CreateWindowExW(
            WINDOW_EX_STYLE(ex_style.0),
            class_name,
            w!("Project Periphery"),
            style,
            0,
            0,
            width,
            height,
            HWND::default(),
            HMENU::default(),
            instance,
            None,
        )?;

        SetLayeredWindowAttributes(
            hwnd,
            overlay_transparent_key(),
            255,
            LAYERED_WINDOW_ATTRIBUTES_FLAGS(0x00000001), // LWA_COLORKEY
        )?;

        SetWindowPos(
            hwnd,
            HWND_TOPMOST,
            CW_USEDEFAULT,
            CW_USEDEFAULT,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
        )?;

        let _ = ShowWindow(hwnd, SW_SHOWNA);
        SetTimer(hwnd, 1, 16, None);

        let mut msg = MSG::default();
        loop {
            let status = GetMessageW(&mut msg, HWND::default(), 0, 0).0;
            if status == -1 {
                return Err(Error::from_win32());
            }
            if status == 0 {
                break;
            }

            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }

    Ok(())
}

extern "system" fn window_proc(hwnd: HWND, msg: u32, _wparam: WPARAM, _lparam: LPARAM) -> LRESULT {
    unsafe {
        match msg {
            WM_NCHITTEST => {
                // Force click-through behavior.
                return LRESULT((-1isize) as isize); // HTTRANSPARENT
            }
            WM_ERASEBKGND => return LRESULT(1),
            WM_TIMER => {
                let current_frame = snapshot_frame_index();
                let previous_frame = LAST_INVALIDATED_FRAME.load(Ordering::Relaxed);
                if current_frame != previous_frame && should_invalidate_now() {
                    LAST_INVALIDATED_FRAME.store(current_frame, Ordering::Relaxed);
                    let _ = InvalidateRect(hwnd, None, BOOL(0));
                }
                return LRESULT(0);
            }
            WM_PAINT => {
                paint_overlay(hwnd);
                return LRESULT(0);
            }
            WM_DESTROY => {
                PostQuitMessage(0);
                return LRESULT(0);
            }
            _ => {}
        }
        DefWindowProcW(hwnd, msg, _wparam, _lparam)
    }
}

#[allow(unsafe_op_in_unsafe_fn)]
unsafe fn paint_overlay(hwnd: HWND) {
    let mut paint = PAINTSTRUCT::default();
    let hdc = BeginPaint(hwnd, &mut paint);

    let width = GetSystemMetrics(SM_CXSCREEN);
    let height = GetSystemMetrics(SM_CYSCREEN);

    let snapshot = SHARED_SNAPSHOT
        .get()
        .and_then(|shared| shared.lock().ok())
        .map(|snapshot| snapshot.clone())
        .unwrap_or_default();

    let mem_dc = CreateCompatibleDC(hdc);
    let mem_bitmap = if !mem_dc.0.is_null() {
        CreateCompatibleBitmap(hdc, width, height)
    } else {
        Default::default()
    };

    if !mem_dc.0.is_null() && !mem_bitmap.0.is_null() {
        let old_obj = SelectObject(mem_dc, HGDIOBJ(mem_bitmap.0));
        render_scene(mem_dc, width, height, &snapshot);
        let _ = BitBlt(hdc, 0, 0, width, height, mem_dc, 0, 0, SRCCOPY);
        let _ = SelectObject(mem_dc, old_obj);
        let _ = DeleteObject(mem_bitmap);
        let _ = DeleteDC(mem_dc);
    } else {
        render_scene(hdc, width, height, &snapshot);
        if !mem_bitmap.0.is_null() {
            let _ = DeleteObject(mem_bitmap);
        }
        if !mem_dc.0.is_null() {
            let _ = DeleteDC(mem_dc);
        }
    }

    let _ = EndPaint(hwnd, &paint);
}

#[allow(unsafe_op_in_unsafe_fn)]
unsafe fn render_scene(
    hdc: windows::Win32::Graphics::Gdi::HDC,
    width: i32,
    height: i32,
    snapshot: &OverlaySnapshot,
) {
    let mut background = RECT::default();
    background.left = 0;
    background.top = 0;
    background.right = width;
    background.bottom = height;

    let transparent_brush = CreateSolidBrush(overlay_transparent_key());
    let _ = FillRect(hdc, &background, transparent_brush);
    let _ = DeleteObject(transparent_brush);

    let analyzer = MORPHEME_ANALYZER.get_or_init(MorphemeAnalyzer::new);
    let config = OVERLAY_CONFIG.get().copied().unwrap_or(OverlayConfig {
        show_debug_boxes: false,
        show_telemetry: false,
        strict_focus: false,
        focus_lines: 3,
    });

    let reading_font = CreateFontW(
        -23,
        0,
        0,
        0,
        FW_BOLD.0 as i32,
        0,
        0,
        0,
        DEFAULT_CHARSET.0 as u32,
        OUT_DEFAULT_PRECIS.0 as u32,
        CLIP_DEFAULT_PRECIS.0 as u32,
        ANTIALIASED_QUALITY.0 as u32,
        (DEFAULT_PITCH.0 | FF_DONTCARE.0) as u32,
        w!("Segoe UI"),
    );
    let old_font = if !reading_font.0.is_null() {
        SelectObject(hdc, HGDIOBJ(reading_font.0))
    } else {
        HGDIOBJ::default()
    };

    let mut drawn_items: Vec<OverlayItem> = Vec::new();

    let focus_top = ((height as f32) * 0.18) as i32;
    let focus_bottom = ((height as f32) * 0.88) as i32;
    let screen_center_y = height / 2;

    let mut candidates: Vec<&OverlayItem> = snapshot
        .items
        .iter()
        .filter(|item| item.confidence >= 0.34)
        .filter(|item| {
            let rect_w = (item.rect.right - item.rect.left).max(0);
            let rect_h = (item.rect.bottom - item.rect.top).max(0);
            let area = rect_w * rect_h;
            rect_h >= 14 && rect_h <= 180 && rect_w >= 120 && rect_w <= 1600 && area <= 280_000
        })
        .filter(|item| item.text.split_whitespace().count() >= 3)
        .filter(|item| item.rect.bottom > focus_top && item.rect.top < focus_bottom)
        .collect();

    candidates.sort_by(|a, b| {
        let a_center = (a.rect.top + a.rect.bottom) / 2;
        let b_center = (b.rect.top + b.rect.bottom) / 2;

        let a_distance = (a_center - screen_center_y).abs() as f32;
        let b_distance = (b_center - screen_center_y).abs() as f32;

        let a_words = a.text.split_whitespace().count().min(24) as f32;
        let b_words = b.text.split_whitespace().count().min(24) as f32;
        let a_chars = a.text.chars().count().min(160) as f32;
        let b_chars = b.text.chars().count().min(160) as f32;

        let a_richness = (a_words * 8.0) + (a_chars * 0.25);
        let b_richness = (b_words * 8.0) + (b_chars * 0.25);

        let a_score = a_distance - (a.confidence * 140.0) - a_richness;
        let b_score = b_distance - (b.confidence * 140.0) - b_richness;

        a_score.total_cmp(&b_score)
    });

    let prioritized: Vec<&OverlayItem> = if let Some(cursor) = current_cursor_pos() {
        if let Some(hovered) = candidates
            .iter()
            .copied()
            .find(|item| point_in_frame_rect(&cursor, &item.rect))
        {
            let hovered_center_y = (hovered.rect.top + hovered.rect.bottom) / 2;
            candidates
                .iter()
                .copied()
                .filter(|item| {
                    let center_y = (item.rect.top + item.rect.bottom) / 2;
                    (center_y - hovered_center_y).abs() <= 56
                })
                .collect()
        } else {
            candidates.sort_by(|a, b| {
                distance_to_rect(&cursor, &a.rect).total_cmp(&distance_to_rect(&cursor, &b.rect))
            });
            candidates.into_iter().take(6).collect()
        }
    } else {
        candidates.into_iter().take(8).collect()
    };

    if config.strict_focus {
        if let Some(primary) = choose_stable_primary(prioritized.first().copied()) {
            draw_item(hdc, &primary, analyzer, config.show_debug_boxes);
            drawn_items.push(primary);
        }
    } else {
        for item in prioritized.into_iter().take(config.focus_lines.max(1)) {
            if overlaps_drawn_item(item, &drawn_items) {
                continue;
            }

            draw_item(hdc, item, analyzer, config.show_debug_boxes);
            drawn_items.push(item.clone());
        }
    }

    if !reading_font.0.is_null() {
        let _ = SelectObject(hdc, old_font);
        let _ = DeleteObject(reading_font);
    }

    if config.show_telemetry {
        let telemetry = format!(
            "Periphery anchors: {}  frame: {}",
            snapshot.items.len(),
            snapshot.frame_index
        );
        let telemetry_utf16: Vec<u16> = telemetry.encode_utf16().collect();
        let _ = SetBkMode(hdc, TRANSPARENT);
        let _ = SetTextColor(hdc, color_rgb(140, 255, 180));
        let _ = TextOutW(hdc, 20, 16, &telemetry_utf16);
    }
}

#[allow(unsafe_op_in_unsafe_fn)]
unsafe fn draw_item(
    hdc: windows::Win32::Graphics::Gdi::HDC,
    item: &OverlayItem,
    analyzer: &MorphemeAnalyzer,
    show_debug_boxes: bool,
) {
    let width = (item.rect.right - item.rect.left).max(0);
    let height = (item.rect.bottom - item.rect.top).max(0);
    if width < 64 || height < 14 {
        return;
    }

    if show_debug_boxes {
        let rect = RECT {
            left: item.rect.left,
            top: item.rect.top,
            right: item.rect.right,
            bottom: item.rect.bottom,
        };
        let alpha = (item.confidence.clamp(0.0, 1.0) * 255.0) as u8;
        let border_brush = CreateSolidBrush(color_rgb(alpha / 4, alpha, alpha / 3));
        let _ = FrameRect(hdc, &rect, border_brush);
        let _ = DeleteObject(border_brush);
    }

    let preview_text = item
        .text
        .split_whitespace()
        .take(32)
        .collect::<Vec<_>>()
        .join(" ");
    if preview_text.is_empty() {
        return;
    }
    let preview_utf16: Vec<u16> = preview_text.encode_utf16().collect();
    let preview_width = measure_text_width(hdc, &preview_utf16).max(20).min(width - 2);

    // Anchor on top edge to avoid centering inside large container controls.
    let y = item.rect.top + 1;
    let line_height = 24;
    let panel_rect = RECT {
        left: item.rect.left.saturating_sub(3),
        top: y.saturating_sub(2),
        right: (item.rect.left + preview_width + 12).min(item.rect.right + 6),
        bottom: (y + line_height + 4).min(item.rect.bottom + 8),
    };
    let panel_brush = CreateSolidBrush(color_rgb(18, 20, 24));
    let _ = FillRect(hdc, &panel_rect, panel_brush);
    let _ = DeleteObject(panel_brush);

    let mut x = item.rect.left + 2;
    let max_x = (item.rect.left + preview_width + 8).min(item.rect.right - 2);

    let _ = SetBkMode(hdc, TRANSPARENT);

    for token in item.text.split_whitespace().take(32) {
        if x >= max_x {
            break;
        }

        let analyzed = analyzer.analyze(token);
        for segment in analyzed.morphemes {
            if segment.text.is_empty() {
                continue;
            }

            let utf16: Vec<u16> = segment.text.encode_utf16().collect();
            if utf16.is_empty() {
                continue;
            }

            let segment_width = measure_text_width(hdc, &utf16);
            if segment_width <= 0 {
                continue;
            }

            if x + segment_width > max_x {
                return;
            }

            // Draw a small dual-contrast halo first to improve readability on mixed backgrounds.
            let _ = SetTextColor(hdc, color_rgb(0, 0, 0));
            let _ = TextOutW(hdc, x + 1, y + 1, &utf16);
            let _ = TextOutW(hdc, x - 1, y + 1, &utf16);
            let _ = TextOutW(hdc, x + 1, y - 1, &utf16);
            let _ = TextOutW(hdc, x - 1, y - 1, &utf16);
            let _ = SetTextColor(hdc, color_rgb(246, 246, 246));
            let _ = TextOutW(hdc, x, y + 1, &utf16);

            let _ = SetTextColor(hdc, morpheme_color(&segment.m_type, item.confidence));
            let _ = TextOutW(hdc, x, y, &utf16);
            x += segment_width;
        }

        let space_utf16: Vec<u16> = " ".encode_utf16().collect();
        x += measure_text_width(hdc, &space_utf16).max(4);
    }
}

fn color_rgb(r: u8, g: u8, b: u8) -> COLORREF {
    COLORREF((r as u32) | ((g as u32) << 8) | ((b as u32) << 16))
}

fn overlay_transparent_key() -> COLORREF {
    // Magenta key avoids accidental transparency in black glyph strokes.
    color_rgb(255, 0, 255)
}

fn env_flag_enabled(name: &str) -> bool {
    std::env::var(name)
        .ok()
        .map(|value| matches!(value.to_lowercase().as_str(), "1" | "true" | "yes" | "on"))
        .unwrap_or(false)
}

fn snapshot_frame_index() -> u64 {
    SHARED_SNAPSHOT
        .get()
        .and_then(|shared| shared.lock().ok())
        .map(|snapshot| snapshot.frame_index)
        .unwrap_or(0)
}

#[allow(unsafe_op_in_unsafe_fn)]
unsafe fn measure_text_width(hdc: windows::Win32::Graphics::Gdi::HDC, utf16: &[u16]) -> i32 {
    let mut size = SIZE::default();
    if GetTextExtentPoint32W(hdc, utf16, &mut size).as_bool() {
        size.cx.max(1)
    } else {
        (utf16.len() as i32 * 8).max(1)
    }
}

fn morpheme_color(kind: &MorphemeType, confidence: f32) -> COLORREF {
    let intensity = confidence.clamp(0.85, 1.0);
    let apply = |r: u8, g: u8, b: u8| {
        color_rgb(
            ((r as f32) * intensity).round().clamp(0.0, 255.0) as u8,
            ((g as f32) * intensity).round().clamp(0.0, 255.0) as u8,
            ((b as f32) * intensity).round().clamp(0.0, 255.0) as u8,
        )
    };

    match kind {
        MorphemeType::Prefix => apply(255, 196, 104),
        MorphemeType::Root => apply(134, 244, 186),
        MorphemeType::Suffix => apply(150, 202, 255),
        MorphemeType::Unknown => apply(238, 240, 244),
    }
}

fn overlaps_drawn_item(candidate: &OverlayItem, drawn: &[OverlayItem]) -> bool {
    drawn.iter().any(|item| {
        let same_text = normalize_text(&item.text) == normalize_text(&candidate.text);
        if same_text && rect_iou(&item.rect, &candidate.rect) > 0.4 {
            return true;
        }

        rect_iou(&item.rect, &candidate.rect) > 0.75
    })
}

fn rect_iou(a: &compositor::FrameRect, b: &compositor::FrameRect) -> f32 {
    let left = a.left.max(b.left);
    let top = a.top.max(b.top);
    let right = a.right.min(b.right);
    let bottom = a.bottom.min(b.bottom);

    let w = (right - left).max(0) as f32;
    let h = (bottom - top).max(0) as f32;
    if w <= 0.0 || h <= 0.0 {
        return 0.0;
    }

    let intersection = w * h;
    let area_a = ((a.right - a.left).max(0) * (a.bottom - a.top).max(0)) as f32;
    let area_b = ((b.right - b.left).max(0) * (b.bottom - b.top).max(0)) as f32;
    let union = area_a + area_b - intersection;
    if union <= 0.0 {
        0.0
    } else {
        intersection / union
    }
}

fn normalize_text(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ").to_ascii_lowercase()
}

#[allow(unsafe_op_in_unsafe_fn)]
unsafe fn current_cursor_pos() -> Option<POINT> {
    let mut point = POINT::default();
    if GetCursorPos(&mut point).is_ok() {
        Some(point)
    } else {
        None
    }
}

fn point_in_frame_rect(point: &POINT, rect: &compositor::FrameRect) -> bool {
    point.x >= rect.left && point.x < rect.right && point.y >= rect.top && point.y < rect.bottom
}

fn distance_to_rect(point: &POINT, rect: &compositor::FrameRect) -> f32 {
    let cx = ((rect.left + rect.right) / 2) as f32;
    let cy = ((rect.top + rect.bottom) / 2) as f32;
    let dx = point.x as f32 - cx;
    let dy = point.y as f32 - cy;
    (dx * dx + dy * dy).sqrt()
}

fn should_invalidate_now() -> bool {
    let now = Instant::now();
    let mut guard = match LAST_INVALIDATE_AT
        .get_or_init(|| Mutex::new(now.checked_sub(Duration::from_secs(1)).unwrap_or(now)))
        .lock()
    {
        Ok(guard) => guard,
        Err(_) => return true,
    };

    // Throttle repaint cadence to reduce perceptual flicker.
    if now.duration_since(*guard) < Duration::from_millis(165) {
        return false;
    }

    *guard = now;
    true
}

fn choose_stable_primary(candidate: Option<&OverlayItem>) -> Option<OverlayItem> {
    let now = Instant::now();
    let mut guard = STABLE_PRIMARY
        .get_or_init(|| Mutex::new(None))
        .lock()
        .ok()?;

    let hold_missing_for = Duration::from_millis(2200);
    let min_switch_interval = Duration::from_millis(1800);

    match guard.as_mut() {
        Some(stable) => {
            if let Some(next) = candidate {
                if items_match(&stable.item, next) {
                    stable.item = blend_overlay_item(&stable.item, next);
                    stable.last_seen = now;
                    return Some(stable.item.clone());
                }

                if now.duration_since(stable.switched_at) < min_switch_interval
                    && now.duration_since(stable.last_seen) < hold_missing_for
                {
                    return Some(stable.item.clone());
                }

                stable.item = next.clone();
                stable.last_seen = now;
                stable.switched_at = now;
                Some(stable.item.clone())
            } else if now.duration_since(stable.last_seen) < hold_missing_for {
                Some(stable.item.clone())
            } else {
                *guard = None;
                None
            }
        }
        None => {
            if let Some(next) = candidate {
                *guard = Some(StablePrimaryItem {
                    item: next.clone(),
                    last_seen: now,
                    switched_at: now,
                });
                Some(next.clone())
            } else {
                None
            }
        }
    }
}

fn items_match(a: &OverlayItem, b: &OverlayItem) -> bool {
    let same_text = normalize_text(&a.text) == normalize_text(&b.text);
    let rect_overlap = rect_iou(&a.rect, &b.rect);
    let center_distance = {
        let ax = (a.rect.left + a.rect.right) / 2;
        let ay = (a.rect.top + a.rect.bottom) / 2;
        let bx = (b.rect.left + b.rect.right) / 2;
        let by = (b.rect.top + b.rect.bottom) / 2;
        let dx = (ax - bx) as f32;
        let dy = (ay - by) as f32;
        (dx * dx + dy * dy).sqrt()
    };

    (same_text && rect_overlap > 0.3) || rect_overlap > 0.55 || center_distance <= 24.0
}

fn blend_overlay_item(current: &OverlayItem, incoming: &OverlayItem) -> OverlayItem {
    let blend_i32 = |a: i32, b: i32| -> i32 { ((a as f32 * 0.72) + (b as f32 * 0.28)).round() as i32 };

    OverlayItem {
        text: if incoming.text.len() >= current.text.len() {
            incoming.text.clone()
        } else {
            current.text.clone()
        },
        rect: compositor::FrameRect {
            left: blend_i32(current.rect.left, incoming.rect.left),
            top: blend_i32(current.rect.top, incoming.rect.top),
            right: blend_i32(current.rect.right, incoming.rect.right),
            bottom: blend_i32(current.rect.bottom, incoming.rect.bottom),
        },
        confidence: current.confidence.max(incoming.confidence),
    }
}

fn focus_line_count_from_env() -> usize {
    std::env::var("PERIPHERY_FOCUS_LINES")
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .map(|value| value.clamp(1, 6))
        .unwrap_or(4)
}
