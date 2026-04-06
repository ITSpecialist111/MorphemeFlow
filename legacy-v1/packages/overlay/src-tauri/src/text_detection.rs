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

const MAX_REGIONS: usize = 200;
const MAX_DEPTH: u32 = 18;  // Chrome wraps Document at depth 8, content at 13-17

/// Control types we want to capture text from (used for leaf-node optimization)
#[allow(dead_code)]
const TEXT_CONTROL_TYPES: &[i32] = &[
    50020, // Text (static text labels, paragraphs)
    50005, // Hyperlink
    50007, // ListItem (cards with headlines)
    50026, // Group — Chrome uses this for many DOM elements with text
    50010, // DataItem
    50014, // Header
    50017, // HeaderItem
    50015, // Custom — Chrome maps some DOM elements to Custom
];

/// Control types to SKIP entirely — don't extract text AND don't recurse children
const SKIP_CONTROL_TYPES: &[i32] = &[
    50000, // Button
    50006, // Image
    50019, // TabItem
    50021, // ToolBar
    50013, // ScrollBar
    50025, // TitleBar
    50011, // Menu
    50012, // MenuItem
];

/// Container types: recurse into children but DON'T extract their CurrentName as text.
const CONTAINER_CONTROL_TYPES: &[i32] = &[
    50032, // Window — name is the window title
    50030, // Document — handled via TextPattern above
    50004, // Edit — handled via TextPattern above
    50033, // MenuBar
    50035, // Separator
    50008, // Tree
    50023, // Tab
    50016, // Pane — structural container
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

/// Remove regions that substantially overlap with smaller (more specific) ones,
/// or that have identical text content (common: section heading + sidebar link).
fn dedup_overlapping(regions: &mut Vec<TextRegion>) {
    // Sort by text length descending — prefer longer, more informative text
    regions.sort_by(|a, b| b.text.len().cmp(&a.text.len()));

    let mut keep = Vec::with_capacity(regions.len());
    for r in regions.iter() {
        let dominated = keep.iter().any(|k: &TextRegion| {
            // Text-content dedup: if the text is identical, keep the first (longer bbox)
            if k.text == r.text {
                return true;
            }
            // If one text contains the other, prefer the longer
            if k.text.contains(&r.text) || r.text.contains(&k.text) {
                return true;
            }
            // Spatial overlap dedup
            let overlap_x = (r.x + r.width).min(k.x + k.width) - r.x.max(k.x);
            let overlap_y = (r.y + r.height).min(k.y + k.height) - r.y.max(k.y);
            if overlap_x <= 0.0 || overlap_y <= 0.0 {
                return false;
            }
            let overlap_area = overlap_x * overlap_y;
            let smaller_area = (r.width * r.height).min(k.width * k.height);
            overlap_area > smaller_area * 0.5 && k.text.len() >= r.text.len()
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
            // Same line: y values within half the font height of each other
            let y_tolerance = last.font_size.max(region.font_size) * 0.5;
            let same_line = (region.y - last.y).abs() < y_tolerance;
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
            // Concatenate text with space between fragments
            if !last.text.ends_with(' ') && !region.text.starts_with(' ') {
                last.text.push(' ');
            }
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

fn is_list_marker_or_item(text: &str) -> bool {
    let t = text.trim();
    if t.is_empty() {
        return false;
    }

    // Common standalone bullet markers
    if matches!(t, "•" | "◦" | "▪" | "●" | "·" | "‣" | "*") {
        return true;
    }

    // Marker + content on one line, e.g. "• Item", "- Item", "1. Item", "a) Item"
    let mut chars = t.chars();
    let first = match chars.next() {
        Some(c) => c,
        None => return false,
    };
    let second = chars.next();

    let single_symbol_marker = matches!(first, '•' | '◦' | '▪' | '●' | '·' | '‣' | '*' | '-');
    if single_symbol_marker && second == Some(' ') {
        return true;
    }

    // Numbered / lettered lists: "1. ", "1) ", "a. ", "a) "
    if first.is_ascii_digit() || first.is_ascii_alphabetic() {
        if matches!(second, Some('.') | Some(')')) && chars.next() == Some(' ') {
            return true;
        }
    }

    false
}

fn should_keep_extracted_text(text: &str) -> bool {
    let len = text.chars().count();
    (len > 1 || is_list_marker_or_item(text)) && len < 2000
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
    use std::sync::OnceLock;

    // Cache COM init
    static UIA_INIT: OnceLock<bool> = OnceLock::new();
    UIA_INIT.get_or_init(|| {
        unsafe { let _ = CoInitializeEx(None, COINIT_MULTITHREADED).ok(); }
        true
    });

    // Cache the UIA COM object in thread-local storage (COM objects aren't Send)
    thread_local! {
        static CACHED_UIA: std::cell::RefCell<Option<IUIAutomation>> = const { std::cell::RefCell::new(None) };
    }

    let uia = CACHED_UIA.with(|cell| {
        let mut borrow = cell.borrow_mut();
        if borrow.is_none() {
            let new_uia: IUIAutomation = unsafe {
                CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER).unwrap()
            };
            *borrow = Some(new_uia);
        }
        borrow.as_ref().unwrap().clone()
    });

    let mut regions = Vec::new();

    unsafe {
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

        let mut class_buf = [0u16; 256];
        let class_len = windows::Win32::UI::WindowsAndMessaging::GetClassNameW(target_hwnd, &mut class_buf);
        let class_name = String::from_utf16_lossy(&class_buf[..class_len as usize]);

        eprintln!("[MorphemeFlow] Scanning: \"{}\" (class: {})", title, class_name);

        let scan_start = std::time::Instant::now();
        let root_element = uia.ElementFromHandle(target_hwnd)?;
        collect_text(&root_element, &uia, &mut regions, 0, target_hwnd)?;

        eprintln!("[MorphemeFlow] Found {} text regions in {:?}", regions.len(), scan_start.elapsed());
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
                eprintln!("[MorphemeFlow] TextPattern: {} visible ranges for control type {}", range_count, control_type);
                // Cap ranges to keep scan fast — 30 covers viewport content
                let max_ranges = range_count.min(30);
                if max_ranges > 0 {
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

                    for i in 0..max_ranges {
                        if regions.len() >= MAX_REGIONS { break; }
                        if let Ok(range) = visible_ranges.GetElement(i) {
                            if let Ok(txt) = range.GetText(2000) {
                                let text = txt.to_string()
                                    .replace('\u{FFFC}', "")  // strip object replacement chars
                                    .trim().to_string();
                                if should_keep_extracted_text(&text) {
                                    let rects = get_all_rects_from_safearray(&range);
                                        if !rects.is_empty() {
                                        // Calculate offset on first valid rect
                                        if !offset_found {
                                            let (rx, ry, _, _) = rects[0];
                                            if rx < -1000.0 || ry < -1000.0 {
                                                // Word uses document-internal coordinates (large negative values).
                                                // The elem_rect is also internal (-32000 range).
                                                // We need to convert to screen coordinates.
                                                // Strategy: walk up to find an ancestor with screen coordinates.
                                                let mut ancestor_rect: Option<windows::Win32::Foundation::RECT> = None;
                                                if let Ok(walker) = uia.CreateTreeWalker(&uia.CreateTrueCondition().unwrap()) {
                                                    let mut parent = element.clone();
                                                    for _ in 0..5 {
                                                        if let Ok(p) = walker.GetParentElement(&parent) {
                                                            if let Ok(pr) = p.CurrentBoundingRectangle() {
                                                                // If this parent has screen-space coords (positive or near 0)
                                                                if pr.left > -1000 && pr.top > -1000 {
                                                                    ancestor_rect = Some(pr);
                                                                    break;
                                                                }
                                                            }
                                                            parent = p;
                                                        } else {
                                                            break;
                                                        }
                                                    }
                                                }
                                                if let Some(ar) = ancestor_rect {
                                                    if let Some(ref er) = elem_rect {
                                                        // ancestor_rect is in screen coords, elem_rect is in internal coords
                                                        // The document area is positioned within the ancestor
                                                        // Estimate the offset between internal and screen coordinates
                                                        offset_x = ar.left as f64 - er.left as f64;
                                                        offset_y = ar.top as f64 - er.top as f64;
                                                    }
                                                } else {
                                                    // Fallback: use window client area
                                                    let mut client_rect = windows::Win32::Foundation::RECT::default();
                                                    let _ = windows::Win32::UI::WindowsAndMessaging::GetClientRect(hwnd, &mut client_rect);
                                                    let mut pt = windows::Win32::Foundation::POINT { x: 0, y: 0 };
                                                    let _ = windows::Win32::Graphics::Gdi::ClientToScreen(hwnd, &mut pt);
                                                    offset_x = pt.x as f64 - rx;
                                                    offset_y = pt.y as f64 - ry;
                                                }
                                            }
                                            offset_found = true;
                                        }

                                        if rects.len() == 1 {
                                            // Single-line range — use text as-is
                                            let (x, y, w, h) = rects[0];
                                            let sx = x + offset_x;
                                            let sy = y + offset_y;
                                            if w > 20.0 && h >= 10.0 && sx >= 0.0 && sy >= 0.0 {
                                                let font_size = estimate_font_size(50020, &text, w, h);
                                                regions.push(TextRegion {
                                                    text,
                                                    x: sx, y: sy,
                                                    width: w, height: h,
                                                    font_size,
                                                    source: TextSource::Accessibility,
                                                    control_type: 50020,
                                                });
                                            }
                                        } else {
                                            // Multi-line range — split text across lines
                                            let total_width: f64 = rects.iter().map(|(_, _, w, _)| w).sum();
                                            let chars: Vec<char> = text.chars().collect();
                                            let total_chars = chars.len();
                                            // Use median rect height (not first — first rect
                                            // often includes document padding)
                                            let mut heights: Vec<f64> = rects.iter().map(|(_, _, _, h)| *h).collect();
                                            heights.sort_by(|a, b| a.partial_cmp(b).unwrap());
                                            let median_h = heights[heights.len() / 2];
                                            let font_size = (median_h / 1.4).clamp(11.0, 28.0);

                                            let mut char_offset = 0usize;
                                            for (x, y, w, h) in &rects {
                                                if regions.len() >= MAX_REGIONS { break; }
                                                let sx = x + offset_x;
                                                let sy = y + offset_y;
                                                if *w < 20.0 || *h < 10.0 || sx < 0.0 || sy < 0.0 {
                                                    continue;
                                                }
                                                // Estimate how many chars fit on this line
                                                let line_chars = ((w / total_width) * total_chars as f64).round() as usize;
                                                let end = (char_offset + line_chars).min(total_chars);
                                                let line_text: String = if char_offset < total_chars {
                                                    chars[char_offset..end].iter().collect::<String>().trim().to_string()
                                                } else {
                                                    String::new()
                                                };
                                                char_offset = end;

                                                if should_keep_extracted_text(&line_text) {
                                                    regions.push(TextRegion {
                                                        text: line_text,
                                                        x: sx, y: sy,
                                                        width: *w, height: *h,
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
                        }
                    }
                    // Continue to tree walk — TextPattern returns text fragments
                    // but tree walk finds complete Text/Hyperlink elements with
                    // proper bounding boxes. Dedup handles overlaps.
                }
            }
        }
    }

    // For skip types: don't extract text and don't recurse.
    if SKIP_CONTROL_TYPES.contains(&control_type) {
        return Ok(());
    }

    // Container types: DON'T extract their name as text (it's a window title or
    // structural label), but DO recurse into children to find actual content.
    if !CONTAINER_CONTROL_TYPES.contains(&control_type) {
        // Try multiple strategies to get text content
        let mut text = String::new();

        // Strategy 1: CurrentName (works for most UI elements)
        if let Ok(name) = element.CurrentName() {
            let s = name.to_string();
            if should_keep_extracted_text(&s) {
                text = s;
            }
        }

        // Strategy 2: ValuePattern (works for edit controls and some rich text)
        if text.is_empty() {
            if let Ok(pattern) = element.GetCurrentPatternAs::<IUIAutomationValuePattern>(UIA_ValuePatternId) {
                if let Ok(val) = pattern.CurrentValue() {
                    let s = val.to_string();
                    if should_keep_extracted_text(&s) {
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
                    if should_keep_extracted_text(&s) {
                        text = s;
                    }
                }
                // Try Value if Name was empty
                if text.is_empty() {
                    if let Ok(val) = pattern.CurrentValue() {
                        let s = val.to_string();
                        if should_keep_extracted_text(&s) {
                            text = s;
                        }
                    }
                }
            }
        }

        if should_keep_extracted_text(&text) {
            if let Ok(rect) = element.CurrentBoundingRectangle() {
                let x = rect.left as f64;
                let y = rect.top as f64;
                let w = (rect.right - rect.left) as f64;
                let h = (rect.bottom - rect.top) as f64;

                if w > 20.0 && h >= 10.0 && w < 3000.0
                    && x >= -20.0 && y >= -20.0
                    && x < 4000.0 && y < 10000.0
                {
                    let font_size = estimate_font_size(control_type, &text, w, h);

                    // Only clean UIA card artifacts for card-like control types
                    // (ListItem, Group) — not for document/text content.
                    if control_type == 50007 || control_type == 50026 {
                        text = clean_card_text(&text);
                    }

                    // Truncate at 500 chars for rendering sanity
                    if text.chars().count() > 500 {
                        text = text.chars().take(500).collect::<String>();
                    }

                    // Blacklist approach: accept text from ANY control type
                    // that isn't a container or skip type (already filtered above).
                    if !text.is_empty() {
                        regions.push(TextRegion {
                            text,
                            x, y,
                            width: w,
                            height: h,
                            font_size,
                            source: TextSource::Accessibility,
                            control_type,
                        });

                        // Leaf text elements: don't recurse into children
                        if control_type == 50020 || control_type == 50005 {
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
    let char_count = text.chars().count() as f64;
    match control_type {
        // Text/Hyperlink: check if multi-line by comparing text length vs width
        50020 | 50005 => {
            // If text fits on one line at a reasonable size, use height-based
            let single_line_fs = (h / 1.4).clamp(11.0, 32.0);
            let est_text_width = char_count * single_line_fs * 0.55;

            if est_text_width <= w * 1.3 {
                // Single line: height-based estimation
                // But cross-check: if the height seems way too big for the text,
                // the bounding box is likely padded (common with hyperlinks).
                // A visible font > 28px is rare outside of main headings.
                // If text is short (<50 chars) and height > 30, likely padded.
                if h > 30.0 && single_line_fs > 20.0 && char_count < 60.0 {
                    // Padded bounding box — estimate from width instead
                    let fs_from_width = (w / (char_count * 0.55)).clamp(11.0, 28.0);
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
                    let est_lines = (char_count / chars_per_line).ceil();
                    let est_height = est_lines * try_fs * 1.35;
                    // Accept if estimated height is within 30% of actual
                    if (est_height - h).abs() < h * 0.35 {
                        return *try_fs;
                    }
                }
                // Fallback: derive from height and estimated line count
                let est_lines = (char_count * 14.0 * 0.55 / w).ceil().max(1.0);
                let est_fs = h / (est_lines * 1.35);
                est_fs.clamp(12.0, 24.0)
            }
        }
        // ListItem: card containers — text occupies only part of the height
        50007 => {
            let chars_per_line = w / (15.0 * 0.55);
            let est_lines = (char_count / chars_per_line).ceil().max(1.0);
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

/// Extract ALL bounding rectangles from a TextRange's SAFEARRAY.
/// Returns a Vec of (x, y, w, h) — one per visual line.
#[cfg(target_os = "windows")]
unsafe fn get_all_rects_from_safearray(
    range: &windows::Win32::UI::Accessibility::IUIAutomationTextRange,
) -> Vec<(f64, f64, f64, f64)> {
    use windows::Win32::System::Ole::{SafeArrayGetLBound, SafeArrayGetUBound, SafeArrayAccessData, SafeArrayUnaccessData};

    let rects_sa = match range.GetBoundingRectangles() {
        Ok(sa) => sa,
        Err(_) => return Vec::new(),
    };
    let lbound = SafeArrayGetLBound(rects_sa, 1).unwrap_or(0);
    let ubound = SafeArrayGetUBound(rects_sa, 1).unwrap_or(-1);
    let count = (ubound - lbound + 1) as usize;
    if count < 4 { return Vec::new(); }

    let mut data_ptr: *mut std::ffi::c_void = std::ptr::null_mut();
    if SafeArrayAccessData(rects_sa, &mut data_ptr).is_err() {
        return Vec::new();
    }
    let doubles = std::slice::from_raw_parts(data_ptr as *const f64, count);
    let num_rects = count / 4;
    let mut rects = Vec::with_capacity(num_rects);
    for i in 0..num_rects {
        rects.push((doubles[i*4], doubles[i*4+1], doubles[i*4+2], doubles[i*4+3]));
    }
    let _ = SafeArrayUnaccessData(rects_sa);
    rects
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
