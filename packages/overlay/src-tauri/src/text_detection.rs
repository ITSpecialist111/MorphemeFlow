// MorphemeFlow — Text Detection Module
// Uses Windows UI Automation API to read text + bounding rects from any application.

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct TextRegion {
    pub text: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub font_size: f64,
    pub source: TextSource,
    pub control_type: i32,
}

#[derive(Debug, Clone, Serialize)]
#[allow(dead_code)]
pub enum TextSource {
    Accessibility,
    Ocr,
}

const MAX_REGIONS: usize = 500;
const MAX_DEPTH: u32 = 15;

/// Control types we want to capture text from (content elements)
const TEXT_CONTROL_TYPES: &[i32] = &[
    50020, // Text (static text labels, paragraphs)
    50005, // Hyperlink
    50007, // ListItem (cards with headlines)
];

/// Control types to SKIP entirely (browser chrome, images, toolbars)
const SKIP_CONTROL_TYPES: &[i32] = &[
    50000, // Button (Close, Back, etc.)
    50004, // Edit (address bar)
    50006, // Image (alt text — we don't render images)
    50019, // TabItem (browser tabs)
    50026, // Toolbar (nav bars)
];

#[cfg(target_os = "windows")]
pub fn detect_text_in_active_window() -> Vec<TextRegion> {
    match detect_via_uia() {
        Ok(mut regions) => {
            // Post-process: deduplicate overlapping regions, then merge adjacent fragments
            dedup_overlapping(&mut regions);
            merge_same_line_regions(&mut regions);
            regions
        }
        Err(e) => {
            eprintln!("[MorphemeFlow] UIA error: {}", e);
            Vec::new()
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn detect_text_in_active_window() -> Vec<TextRegion> {
    Vec::new()
}

/// Remove regions that substantially overlap with smaller (more specific) ones.
fn dedup_overlapping(regions: &mut Vec<TextRegion>) {
    // Sort smallest first — prefer specific text over containers
    regions.sort_by(|a, b| {
        let area_a = a.width * a.height;
        let area_b = b.width * b.height;
        area_a.partial_cmp(&area_b).unwrap()
    });

    let mut keep = Vec::with_capacity(regions.len());
    for r in regions.iter() {
        let dominated = keep.iter().any(|k: &TextRegion| {
            let overlap_x = (r.x + r.width).min(k.x + k.width) - r.x.max(k.x);
            let overlap_y = (r.y + r.height).min(k.y + k.height) - r.y.max(k.y);
            if overlap_x <= 0.0 || overlap_y <= 0.0 {
                return false;
            }
            let overlap_area = overlap_x * overlap_y;
            let smaller_area = (r.width * r.height).min(k.width * k.height);
            overlap_area > smaller_area * 0.5
        });
        if !dominated {
            keep.push(r.clone());
        }
    }
    *regions = keep;
}

/// Merge adjacent text fragments on the same line into single regions.
/// Wikipedia (and many apps) fragments text around hyperlinks, producing
/// many tiny runs like: "The school owes its existence to " + "Godfrey Morgan" + ", who ...".
/// This pass combines them into full-line regions for cleaner overlay rendering.
fn merge_same_line_regions(regions: &mut Vec<TextRegion>) {
    if regions.len() < 2 {
        return;
    }

    // Sort by y (top→bottom), then x (left→right)
    regions.sort_by(|a, b| {
        let y_cmp = a.y.partial_cmp(&b.y).unwrap();
        if y_cmp == std::cmp::Ordering::Equal {
            a.x.partial_cmp(&b.x).unwrap()
        } else {
            y_cmp
        }
    });

    let mut merged: Vec<TextRegion> = Vec::with_capacity(regions.len());

    for region in regions.drain(..) {
        let should_merge = if let Some(last) = merged.last() {
            // Same line: y values within 5px of each other
            let same_line = (region.y - last.y).abs() < 5.0;
            // Adjacent: gap between end of last region and start of this one < 20px
            let last_end_x = last.x + last.width;
            let gap = region.x - last_end_x;
            let adjacent = gap < 20.0 && gap > -5.0; // allow slight overlap
            // Similar font size (within 3px)
            let similar_font = (region.font_size - last.font_size).abs() < 3.0;
            same_line && adjacent && similar_font
        } else {
            false
        };

        if should_merge {
            let last = merged.last_mut().unwrap();
            // Extend the bounding box
            let new_right = (last.x + last.width).max(region.x + region.width);
            let new_bottom = (last.y + last.height).max(region.y + region.height);
            last.width = new_right - last.x;
            last.height = new_bottom - last.y;
            // Concatenate text
            last.text.push_str(&region.text);
            // Use the larger font size (headings win over body text fragments)
            if region.font_size > last.font_size {
                last.font_size = region.font_size;
            }
        } else {
            merged.push(region);
        }
    }

    *regions = merged;
}

/// Check if a window handle is suitable for text scanning.
#[cfg(target_os = "windows")]
unsafe fn is_suitable_window(hwnd: windows::Win32::Foundation::HWND, our_pid: u32) -> bool {
    use windows::Win32::UI::WindowsAndMessaging::*;
    use windows::Win32::Foundation::*;

    if hwnd.is_invalid() || hwnd == HWND::default() {
        return false;
    }

    if !IsWindowVisible(hwnd).as_bool() {
        return false;
    }

    // Skip our own process
    let mut win_pid = 0u32;
    let _ = GetWindowThreadProcessId(hwnd, Some(&mut win_pid));
    if win_pid == our_pid {
        return false;
    }

    // Must have a title
    let mut title_buf = [0u16; 256];
    let title_len = GetWindowTextW(hwnd, &mut title_buf);
    if title_len == 0 {
        return false;
    }

    // Must be reasonably sized
    let mut wr = RECT::default();
    let _ = GetWindowRect(hwnd, &mut wr);
    let w = wr.right - wr.left;
    let h = wr.bottom - wr.top;
    if w < 200 || h < 200 {
        return false;
    }

    // Skip system windows
    let mut class_buf = [0u16; 128];
    let class_len = GetClassNameW(hwnd, &mut class_buf);
    let class_name = String::from_utf16_lossy(&class_buf[..class_len as usize]);
    if class_name.contains("IME")
        || class_name == "Shell_TrayWnd"
        || class_name == "WorkerW"
        || class_name == "Progman"
        || class_name == "tooltips_class32"
    {
        return false;
    }

    true
}

/// Walk Z-order to find the first suitable window.
#[cfg(target_os = "windows")]
unsafe fn find_suitable_window(our_pid: u32) -> windows::Win32::Foundation::HWND {
    use windows::Win32::UI::WindowsAndMessaging::*;
    use windows::Win32::Foundation::*;

    // EnumWindows approach: walk from top window in Z-order
    let mut hwnd = GetTopWindow(HWND::default()).unwrap_or(HWND::default());
    let mut attempts = 0;

    while !hwnd.is_invalid() && hwnd != HWND::default() && attempts < 50 {
        if IsWindowVisible(hwnd).as_bool() {
            let mut win_pid = 0u32;
            let _ = GetWindowThreadProcessId(hwnd, Some(&mut win_pid));

            if win_pid != our_pid {
                // Get title
                let mut title_buf = [0u16; 256];
                let title_len = GetWindowTextW(hwnd, &mut title_buf);
                let title = String::from_utf16_lossy(&title_buf[..title_len as usize]);

                // Get size
                let mut wr = RECT::default();
                let _ = GetWindowRect(hwnd, &mut wr);
                let w = wr.right - wr.left;
                let h = wr.bottom - wr.top;

                // Get class
                let mut class_buf = [0u16; 128];
                let class_len = GetClassNameW(hwnd, &mut class_buf);
                let class_name = String::from_utf16_lossy(&class_buf[..class_len as usize]);

                let is_system = class_name.contains("IME")
                    || class_name == "Shell_TrayWnd"
                    || class_name == "WorkerW"
                    || class_name == "Progman"
                    || class_name == "tooltips_class32";

                if title_len > 0 && w > 200 && h > 200 && !is_system {
                    eprintln!("[MorphemeFlow] Selected window: \"{}\" (class: {}, {}x{})", title, class_name, w, h);
                    return hwnd;
                }
            }
        }

        hwnd = match GetWindow(hwnd, GW_HWNDNEXT) {
            Ok(h) => h,
            Err(_) => break,
        };
        attempts += 1;
    }

    HWND::default()
}

#[cfg(target_os = "windows")]
fn detect_via_uia() -> Result<Vec<TextRegion>, Box<dyn std::error::Error>> {
    use windows::Win32::UI::Accessibility::*;
    use windows::Win32::UI::WindowsAndMessaging::*;
    use windows::Win32::Foundation::*;
    use windows::Win32::System::Com::*;

    let mut regions = Vec::new();

    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED).ok();

        let uia: IUIAutomation = CoCreateInstance(
            &CUIAutomation,
            None,
            CLSCTX_INPROC_SERVER,
        )?;

        let our_pid = std::process::id();

        // Try foreground window first
        let fg_hwnd = GetForegroundWindow();
        let target_hwnd = if is_suitable_window(fg_hwnd, our_pid) {
            fg_hwnd
        } else {
            // Walk the Z-order to find the first suitable window
            find_suitable_window(our_pid)
        };

        if target_hwnd.is_invalid() || target_hwnd == HWND::default() {
            eprintln!("[MorphemeFlow] No suitable window found");
            return Ok(regions);
        }

        let mut title_buf = [0u16; 256];
        let title_len = GetWindowTextW(target_hwnd, &mut title_buf);
        let title = String::from_utf16_lossy(&title_buf[..title_len as usize]);
        eprintln!("[MorphemeFlow] Scanning: \"{}\"", title);

        let root_element = uia.ElementFromHandle(target_hwnd)?;
        collect_text(&root_element, &uia, &mut regions, 0, target_hwnd)?;

        eprintln!("[MorphemeFlow] Found {} text regions", regions.len());
    }

    Ok(regions)
}

#[cfg(target_os = "windows")]
unsafe fn collect_text(
    element: &windows::Win32::UI::Accessibility::IUIAutomationElement,
    uia: &windows::Win32::UI::Accessibility::IUIAutomation,
    regions: &mut Vec<TextRegion>,
    depth: u32,
    hwnd: windows::Win32::Foundation::HWND,
) -> Result<(), Box<dyn std::error::Error>> {
    if depth > MAX_DEPTH || regions.len() >= MAX_REGIONS {
        return Ok(());
    }

    use windows::Win32::UI::Accessibility::*;

    let control_type = element.CurrentControlType().map(|c| c.0).unwrap_or(0);

    // For Document (50030) and Edit (50004) controls that support TextPattern,
    // extract visible text ranges directly — this is the only reliable way
    // to get text from Word, rich text editors, etc.
    if (control_type == 50030 || control_type == 50004) && regions.len() < MAX_REGIONS {
        if let Ok(pattern) = element.GetCurrentPatternAs::<IUIAutomationTextPattern>(UIA_TextPatternId) {
            if let Ok(visible_ranges) = pattern.GetVisibleRanges() {
                let range_count = visible_ranges.Length().unwrap_or(0);
                if range_count > 0 {
                    // Word returns document-internal (negative) coords from TextPattern.
                    // We need to map these to screen coords using the element's internal rect
                    // and the actual screen position (via ClientToScreen).
                    let mut screen_origin = windows::Win32::Foundation::POINT { x: 0, y: 0 };
                    let _ = windows::Win32::Graphics::Gdi::ClientToScreen(hwnd, &mut screen_origin);
                    // The element's bounding rect (in same internal coord space as text ranges)
                    let elem_rect = element.CurrentBoundingRectangle().ok();

                    let mut offset_x = 0.0_f64;
                    let mut offset_y = 0.0_f64;
                    let mut offset_found = false;

                    for i in 0..range_count {
                        if regions.len() >= MAX_REGIONS { break; }
                        if let Ok(range) = visible_ranges.GetElement(i) {
                            if let Ok(txt) = range.GetText(500) {
                                let text = txt.to_string().trim().to_string();
                                if text.len() > 1 && text.len() < 500 {
                                    if let Some((x, y, w, h)) = get_first_rect_from_safearray(&range) {
                                        // Calculate offset on first valid rect
                                        if !offset_found {
                                            if x < -1000.0 || y < -1000.0 {
                                                if let Some(ref er) = elem_rect {
                                                    offset_x = screen_origin.x as f64 - er.left as f64;
                                                    offset_y = screen_origin.y as f64 - er.top as f64;
                                                }
                                            }
                                            offset_found = true;
                                        }

                                        let sx = x + offset_x;
                                        let sy = y + offset_y;

                                        if w > 20.0 && h >= 10.0 && sx >= 0.0 && sy >= 0.0 {
                                            let font_size = estimate_font_size(50020, &text, w, h);
                                            regions.push(TextRegion {
                                                text,
                                                x: sx, y: sy,
                                                width: w,
                                                height: h,
                                                font_size,
                                                source: TextSource::Accessibility,
                                                control_type: 50020,
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if !regions.is_empty() {
                        return Ok(());
                    }
                }
            }
        }
    }

    // For skip types: don't add text, but still recurse into children
    // (containers like toolbars may have text children we want, or
    //  we need to pass through them to reach page content)
    let should_skip_text = SKIP_CONTROL_TYPES.contains(&control_type);

    if !should_skip_text {
        // Try multiple strategies to get text content
        let mut text = String::new();

        // Strategy 1: CurrentName (works for most UI elements)
        if let Ok(name) = element.CurrentName() {
            let s = name.to_string();
            if s.len() > 1 {
                text = s;
            }
        }

        // Strategy 2: ValuePattern (works for edit controls and some rich text)
        if text.is_empty() {
            if let Ok(pattern) = element.GetCurrentPatternAs::<IUIAutomationValuePattern>(UIA_ValuePatternId) {
                if let Ok(val) = pattern.CurrentValue() {
                    let s = val.to_string();
                    if s.len() > 1 && s.len() < 500 {
                        text = s;
                    }
                }
            }
        }

        // Strategy 3: LegacyIAccessible (works for Word document lines, many apps)
        if text.is_empty() {
            if let Ok(pattern) = element.GetCurrentPatternAs::<IUIAutomationLegacyIAccessiblePattern>(UIA_LegacyIAccessiblePatternId) {
                // Try Name first
                if let Ok(val) = pattern.CurrentName() {
                    let s = val.to_string();
                    if s.len() > 1 && s.len() < 500 {
                        text = s;
                    }
                }
                // Try Value if Name was empty
                if text.is_empty() {
                    if let Ok(val) = pattern.CurrentValue() {
                        let s = val.to_string();
                        if s.len() > 1 && s.len() < 500 {
                            text = s;
                        }
                    }
                }
            }
        }

        if text.len() > 1 && text.len() < 500 {
            if let Ok(rect) = element.CurrentBoundingRectangle() {
                let x = rect.left as f64;
                let y = rect.top as f64;
                let w = (rect.right - rect.left) as f64;
                let h = (rect.bottom - rect.top) as f64;

                if w > 20.0 && h >= 10.0 && w < 3000.0
                    && x >= -20.0 && y >= -20.0
                    && x < 4000.0 && y < 3000.0
                {
                    let font_size = estimate_font_size(control_type, &text, w, h);

                    if control_type == 50007 {
                        text = clean_card_text(&text);
                    }

                    let is_text_ct = TEXT_CONTROL_TYPES.contains(&control_type);

                    if is_text_ct && !text.is_empty() {
                        regions.push(TextRegion {
                            text,
                            x, y,
                            width: w,
                            height: h,
                            font_size,
                            source: TextSource::Accessibility,
                            control_type,
                        });

                        // Leaf text: don't recurse into children
                        if control_type == 50020 {
                            return Ok(());
                        }
                    }
                }
            }
        }
    }

    // Recurse into children (always — even for skip types)
    let condition = uia.CreateTrueCondition()?;
    if let Ok(children) = element.FindAll(TreeScope_Children, &condition) {
        let count = children.Length().unwrap_or(0);
        for i in 0..count {
            if regions.len() >= MAX_REGIONS {
                break;
            }
            if let Ok(child) = children.GetElement(i) {
                collect_text(&child, uia, regions, depth + 1, hwnd)?;
            }
        }
    }

    Ok(())
}

/// Estimate the actual font size from bounding box and control type.
/// Different control types need different estimation strategies.
#[cfg(target_os = "windows")]
fn estimate_font_size(control_type: i32, text: &str, w: f64, h: f64) -> f64 {
    match control_type {
        // Text/Hyperlink: check if multi-line by comparing text length vs width
        50020 | 50005 => {
            // If text fits on one line at a reasonable size, use height-based
            let single_line_fs = (h / 1.4).clamp(11.0, 32.0);
            let est_text_width = text.len() as f64 * single_line_fs * 0.55;

            if est_text_width <= w * 1.3 {
                // Single line: height-based estimation
                // But cross-check: if the height seems way too big for the text,
                // the bounding box is likely padded (common with hyperlinks).
                // A visible font > 28px is rare outside of main headings.
                // If text is short (<50 chars) and height > 30, likely padded.
                if h > 30.0 && single_line_fs > 20.0 && text.len() < 60 {
                    // Padded bounding box — estimate from width instead
                    let fs_from_width = (w / (text.len() as f64 * 0.55)).clamp(11.0, 28.0);
                    // Use the smaller (more conservative) estimate
                    fs_from_width.min(single_line_fs)
                } else {
                    single_line_fs
                }
            } else {
                // Multi-line: estimate from lines needed
                // Try common font sizes and pick the one that best fits
                for try_fs in &[18.0, 16.0, 15.0, 14.0, 13.0, 20.0, 22.0] {
                    let chars_per_line = w / (try_fs * 0.55);
                    let est_lines = (text.len() as f64 / chars_per_line).ceil();
                    let est_height = est_lines * try_fs * 1.35;
                    // Accept if estimated height is within 30% of actual
                    if (est_height - h).abs() < h * 0.35 {
                        return *try_fs;
                    }
                }
                // Fallback: derive from height and estimated line count
                let est_lines = (text.len() as f64 * 14.0 * 0.55 / w).ceil().max(1.0);
                let est_fs = h / (est_lines * 1.35);
                est_fs.clamp(12.0, 24.0)
            }
        }
        // ListItem: card containers — text occupies only part of the height
        50007 => {
            let chars_per_line = w / (15.0 * 0.55);
            let est_lines = (text.len() as f64 / chars_per_line).ceil().max(1.0);
            let est_line_height = h / est_lines;
            let est_font = est_line_height / 1.4;
            est_font.clamp(13.0, 20.0)
        }
        // Default
        _ => (h / 1.4).clamp(11.0, 28.0),
    }
}

/// Clean up card text by removing UIA artifacts like "AttributionCulture" suffixes.
#[cfg(target_os = "windows")]
fn clean_card_text(text: &str) -> String {
    let mut s = text.to_string();

    // Remove "Attribution..." suffixes
    if let Some(idx) = s.find("Attribution") {
        s.truncate(idx);
    }

    // Remove trailing "Comments\d+"
    if let Some(idx) = s.rfind("Comments") {
        let after = &s[idx + 8..];
        if after.chars().all(|c| c.is_ascii_digit()) {
            s.truncate(idx);
        }
    }

    // Remove trailing ". Video, HH:MM:SS"
    if let Some(idx) = s.rfind(". Video, ") {
        s.truncate(idx);
    }

    s.trim().to_string()
}

/// Extract the first bounding rectangle from a TextRange's SAFEARRAY.
#[cfg(target_os = "windows")]
unsafe fn get_first_rect_from_safearray(
    range: &windows::Win32::UI::Accessibility::IUIAutomationTextRange,
) -> Option<(f64, f64, f64, f64)> {
    use windows::Win32::System::Ole::{SafeArrayGetLBound, SafeArrayGetUBound, SafeArrayAccessData, SafeArrayUnaccessData};

    let rects_sa = range.GetBoundingRectangles().ok()?;
    let lbound = SafeArrayGetLBound(rects_sa, 1).unwrap_or(0);
    let ubound = SafeArrayGetUBound(rects_sa, 1).unwrap_or(-1);
    let count = (ubound - lbound + 1) as usize;
    if count < 4 { return None; }

    let mut data_ptr: *mut std::ffi::c_void = std::ptr::null_mut();
    SafeArrayAccessData(rects_sa, &mut data_ptr).ok()?;
    let doubles = std::slice::from_raw_parts(data_ptr as *const f64, count);
    let result = (doubles[0], doubles[1], doubles[2], doubles[3]);
    let _ = SafeArrayUnaccessData(rects_sa);
    Some(result)
}

/// Public API: collect text regions from a given UIA element (used by capture binary).
#[cfg(target_os = "windows")]
pub fn collect_from_element(
    element: &windows::Win32::UI::Accessibility::IUIAutomationElement,
    uia: &windows::Win32::UI::Accessibility::IUIAutomation,
    hwnd: windows::Win32::Foundation::HWND,
) -> Vec<TextRegion> {
    let mut regions = Vec::new();
    unsafe {
        let _ = collect_text(element, uia, &mut regions, 0, hwnd);
    }
    dedup_overlapping(&mut regions);
    merge_same_line_regions(&mut regions);
    regions
}

#[cfg(not(target_os = "windows"))]
pub fn collect_from_element() -> Vec<TextRegion> {
    Vec::new()
}
