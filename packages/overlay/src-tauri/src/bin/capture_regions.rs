// MorphemeFlow — Standalone UIA capture tool
// Captures text regions from a window matching the given title filter.
// Usage:
//   cargo run --bin capture_regions              (scans first visible non-self window)
//   cargo run --bin capture_regions -- "BBC"     (scans window with "BBC" in title)
//
// The core detection logic mirrors text_detection.rs exactly.

use std::fs;
use std::path::PathBuf;

// Re-use the library's types and logic
use morphemeflow_overlay_lib::text_detection::TextRegion;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let title_filter = args.get(1).cloned();

    if let Some(ref f) = title_filter {
        eprintln!("[Capture] Looking for window with '{}' in title...", f);
    } else {
        eprintln!("[Capture] Scanning all visible top-level windows...");
    }

    let regions = capture_from_window(title_filter.as_deref());

    let json = serde_json::to_string_pretty(&regions).expect("JSON serialize failed");

    let out_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../../test/fixtures/captured-regions.json");
    if let Some(parent) = out_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&out_path, &json).expect("Failed to write JSON");

    let abs = fs::canonicalize(&out_path).unwrap_or(out_path);
    eprintln!("[Capture] Saved {} regions to {:?}", regions.len(), abs);

    if !regions.is_empty() {
        let min_x = regions.iter().map(|r| r.x as i32).min().unwrap();
        let min_y = regions.iter().map(|r| r.y as i32).min().unwrap();
        let max_x = regions.iter().map(|r| (r.x + r.width) as i32).max().unwrap();
        let max_y = regions.iter().map(|r| (r.y + r.height) as i32).max().unwrap();
        let avg_font = regions.iter().map(|r| r.font_size).sum::<f64>() / regions.len() as f64;
        let avg_text_len = regions.iter().map(|r| r.text.len()).sum::<usize>() / regions.len();
        eprintln!("[Capture] Bounds: ({},{}) to ({},{})", min_x, min_y, max_x, max_y);
        eprintln!("[Capture] Avg font: {:.1}px, avg text len: {} chars", avg_font, avg_text_len);
    }
}

#[cfg(target_os = "windows")]
fn capture_from_window(title_filter: Option<&str>) -> Vec<TextRegion> {
    use windows::Win32::UI::Accessibility::*;
    use windows::Win32::UI::WindowsAndMessaging::*;
    use windows::Win32::Foundation::*;
    use windows::Win32::System::Com::*;

    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED).ok();

        let uia: IUIAutomation = CoCreateInstance(
            &CUIAutomation, None, CLSCTX_INPROC_SERVER,
        ).expect("Failed to create UIA");

        let target_hwnd = find_window(title_filter);
        if target_hwnd.is_invalid() || target_hwnd == HWND::default() {
            eprintln!("[Capture] No matching window found");
            return Vec::new();
        }

        let mut title_buf = [0u16; 512];
        let title_len = GetWindowTextW(target_hwnd, &mut title_buf);
        let title = String::from_utf16_lossy(&title_buf[..title_len as usize]);
        eprintln!("[Capture] Scanning: \"{}\"", title);

        let root = uia.ElementFromHandle(target_hwnd).expect("ElementFromHandle failed");

        // Use the same detection logic as the main app
        let regions = morphemeflow_overlay_lib::text_detection::collect_from_element(&root, &uia, target_hwnd);
        eprintln!("[Capture] Found {} regions (after filtering + dedup)", regions.len());
        regions
    }
}

#[cfg(target_os = "windows")]
unsafe fn find_window(title_filter: Option<&str>) -> windows::Win32::Foundation::HWND {
    use windows::Win32::UI::WindowsAndMessaging::*;
    use windows::Win32::Foundation::*;

    let mut hwnd = GetTopWindow(None).unwrap_or(HWND::default());
    let our_pid = std::process::id();

    while !hwnd.is_invalid() && hwnd != HWND::default() {
        if IsWindowVisible(hwnd).as_bool() {
            let mut pid = 0u32;
            let _ = GetWindowThreadProcessId(hwnd, Some(&mut pid));
            if pid != our_pid {
                let mut buf = [0u16; 512];
                let len = GetWindowTextW(hwnd, &mut buf);
                let title = String::from_utf16_lossy(&buf[..len as usize]);
                if !title.is_empty() {
                    if let Some(f) = title_filter {
                        if title.to_lowercase().contains(&f.to_lowercase()) {
                            return hwnd;
                        }
                    } else {
                        return hwnd;
                    }
                }
            }
        }
        hwnd = match GetWindow(hwnd, GW_HWNDNEXT) {
            Ok(h) => h,
            Err(_) => break,
        };
    }
    HWND::default()
}

#[cfg(not(target_os = "windows"))]
fn capture_from_window(_title_filter: Option<&str>) -> Vec<TextRegion> {
    Vec::new()
}
