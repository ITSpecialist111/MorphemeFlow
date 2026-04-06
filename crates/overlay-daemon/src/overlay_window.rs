use crate::tracker::{OverlayItem, OverlaySnapshot};
use engine::{MorphemeAnalyzer, MorphemeType};
use once_cell::sync::OnceCell;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use windows::core::{w, Error, Result};
use windows::Win32::Foundation::{BOOL, COLORREF, HWND, LPARAM, LRESULT, RECT, SIZE, WPARAM};
use windows::Win32::Graphics::Gdi::{
    BeginPaint, BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, CreateFontW, CreateSolidBrush, DeleteDC,
    DeleteObject, EndPaint, FillRect, FrameRect, GetTextExtentPoint32W, InvalidateRect, SelectObject, SetBkMode,
    SetTextColor, TextOutW, CLEARTYPE_QUALITY, CLIP_DEFAULT_PRECIS, DEFAULT_CHARSET, DEFAULT_PITCH, FF_DONTCARE,
    FW_NORMAL, HGDIOBJ, OUT_DEFAULT_PRECIS, PAINTSTRUCT, SRCCOPY, TRANSPARENT,
};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DispatchMessageW, GetMessageW, GetSystemMetrics, RegisterClassW,
    PostQuitMessage, SetLayeredWindowAttributes, SetTimer, SetWindowPos, ShowWindow, TranslateMessage,
    CS_HREDRAW, CS_VREDRAW, CW_USEDEFAULT, HMENU, HWND_TOPMOST, LAYERED_WINDOW_ATTRIBUTES_FLAGS, MSG, SM_CXSCREEN,
    SM_CYSCREEN, SW_SHOWNA, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, WINDOW_EX_STYLE, WINDOW_STYLE, WM_DESTROY,
    WM_ERASEBKGND, WM_NCHITTEST, WM_PAINT, WM_TIMER, WNDCLASSW, WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
    WS_EX_TOPMOST, WS_EX_TRANSPARENT, WS_POPUP,
};

static SHARED_SNAPSHOT: OnceCell<Arc<Mutex<OverlaySnapshot>>> = OnceCell::new();
static MORPHEME_ANALYZER: OnceCell<MorphemeAnalyzer> = OnceCell::new();
static OVERLAY_CONFIG: OnceCell<OverlayConfig> = OnceCell::new();
static LAST_INVALIDATED_FRAME: AtomicU64 = AtomicU64::new(u64::MAX);

#[derive(Clone, Copy)]
struct OverlayConfig {
    show_debug_boxes: bool,
    show_telemetry: bool,
}

pub fn run_overlay_window(shared_snapshot: Arc<Mutex<OverlaySnapshot>>) -> Result<()> {
    SHARED_SNAPSHOT
        .set(shared_snapshot)
        .map_err(|_| Error::new(windows::Win32::Foundation::E_FAIL, "Overlay shared state already initialized"))?;
    OVERLAY_CONFIG
        .set(OverlayConfig {
            show_debug_boxes: env_flag_enabled("PERIPHERY_DEBUG_BOXES"),
            show_telemetry: env_flag_enabled("PERIPHERY_DEBUG_OVERLAY"),
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
            color_rgb(0, 0, 0),
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
                if current_frame != previous_frame {
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

    let transparent_brush = CreateSolidBrush(color_rgb(0, 0, 0));
    let _ = FillRect(hdc, &background, transparent_brush);
    let _ = DeleteObject(transparent_brush);

    let analyzer = MORPHEME_ANALYZER.get_or_init(MorphemeAnalyzer::new);
    let config = OVERLAY_CONFIG.get().copied().unwrap_or(OverlayConfig {
        show_debug_boxes: false,
        show_telemetry: false,
    });

    let reading_font = CreateFontW(
        -18,
        0,
        0,
        0,
        FW_NORMAL.0 as i32,
        0,
        0,
        0,
        DEFAULT_CHARSET.0 as u32,
        OUT_DEFAULT_PRECIS.0 as u32,
        CLIP_DEFAULT_PRECIS.0 as u32,
        CLEARTYPE_QUALITY.0 as u32,
        (DEFAULT_PITCH.0 | FF_DONTCARE.0) as u32,
        w!("Segoe UI Variable Text"),
    );
    let old_font = if !reading_font.0.is_null() {
        SelectObject(hdc, HGDIOBJ(reading_font.0))
    } else {
        HGDIOBJ::default()
    };

    for item in snapshot
        .items
        .iter()
        .filter(|item| item.confidence >= 0.28)
        .take(72)
    {
        draw_item(hdc, item, analyzer, config.show_debug_boxes);
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
    if width < 54 || height < 14 {
        return;
    }

    let rect = RECT {
        left: item.rect.left,
        top: item.rect.top,
        right: item.rect.right,
        bottom: item.rect.bottom,
    };

    if show_debug_boxes {
        let alpha = (item.confidence.clamp(0.0, 1.0) * 255.0) as u8;
        let border_brush = CreateSolidBrush(color_rgb(alpha / 4, alpha, alpha / 3));
        let _ = FrameRect(hdc, &rect, border_brush);
        let _ = DeleteObject(border_brush);
    }

    let mut x = item.rect.left + 3;
    let max_x = item.rect.right - 3;
    let baseline_y = item.rect.top + ((height - 18).max(0) / 2);

    let _ = SetBkMode(hdc, TRANSPARENT);
    for token in item.text.split_whitespace().take(30) {
        if x >= max_x {
            break;
        }

        let analyzed = analyzer.analyze(token);
        for morpheme in analyzed.morphemes {
            if morpheme.text.is_empty() {
                continue;
            }

            let segment_utf16: Vec<u16> = morpheme.text.encode_utf16().collect();
            if segment_utf16.is_empty() {
                continue;
            }

            let segment_width = measure_text_width(hdc, &segment_utf16);
            if segment_width <= 0 {
                continue;
            }

            if x + segment_width > max_x {
                return;
            }

            let color = morpheme_color(&morpheme.m_type, item.confidence);
            let _ = SetTextColor(hdc, color);
            let _ = TextOutW(hdc, x, baseline_y, &segment_utf16);
            x += segment_width;
        }

        let space_utf16: Vec<u16> = " ".encode_utf16().collect();
        x += measure_text_width(hdc, &space_utf16).max(4);
    }
}

fn color_rgb(r: u8, g: u8, b: u8) -> COLORREF {
    COLORREF((r as u32) | ((g as u32) << 8) | ((b as u32) << 16))
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
unsafe fn measure_text_width(
    hdc: windows::Win32::Graphics::Gdi::HDC,
    utf16: &[u16],
) -> i32 {
    let mut size = SIZE::default();
    if GetTextExtentPoint32W(hdc, utf16, &mut size).as_bool() {
        size.cx.max(1)
    } else {
        (utf16.len() as i32 * 8).max(1)
    }
}

fn morpheme_color(morpheme_type: &MorphemeType, confidence: f32) -> COLORREF {
    let intensity = confidence.clamp(0.35, 1.0);
    let scale = |base: u8| -> u8 { ((base as f32) * intensity).round().clamp(0.0, 255.0) as u8 };

    match morpheme_type {
        MorphemeType::Prefix => color_rgb(scale(255), scale(201), scale(83)),
        MorphemeType::Root => color_rgb(scale(180), scale(255), scale(210)),
        MorphemeType::Suffix => color_rgb(scale(154), scale(204), scale(255)),
        MorphemeType::Unknown => color_rgb(scale(228), scale(235), scale(238)),
    }
}
