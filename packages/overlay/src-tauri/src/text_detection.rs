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
}

#[derive(Debug, Clone, Serialize)]
#[allow(dead_code)]
pub enum TextSource {
    Accessibility,
    Ocr,
}

const MAX_REGIONS: usize = 300;
const MAX_DEPTH: u32 = 12;

#[cfg(target_os = "windows")]
pub fn detect_text_in_active_window() -> Vec<TextRegion> {
    match detect_via_uia() {
        Ok(regions) => regions,
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

#[cfg(target_os = "windows")]
fn detect_via_uia() -> Result<Vec<TextRegion>, Box<dyn std::error::Error>> {
    use windows::Win32::UI::Accessibility::*;
    use windows::Win32::System::Com::*;

    let mut regions = Vec::new();

    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED).ok();

        let uia: IUIAutomation = CoCreateInstance(
            &CUIAutomation,
            None,
            CLSCTX_INPROC_SERVER,
        )?;

        // Use the focused element — it's in the app BENEATH our click-through overlay
        let focused = uia.GetFocusedElement()?;

        // Walk up to the top-level window
        let walker = uia.CreateTreeWalker(&uia.CreateTrueCondition()?)?;
        let desktop = uia.GetRootElement()?;
        let desktop_rt = desktop.GetRuntimeId()?;

        let mut root = focused;
        loop {
            match walker.GetParentElement(&root) {
                Ok(parent) => {
                    // Stop if parent is the desktop root
                    if let Ok(pid) = parent.GetRuntimeId() {
                        if pid == desktop_rt {
                            break;
                        }
                    }
                    root = parent;
                }
                Err(_) => break,
            }
        }

        // Walk DOWN from the top-level window, collecting text
        collect_text(&root, &walker, &mut regions, 0)?;

        eprintln!("[MorphemeFlow] Found {} text regions", regions.len());
    }

    Ok(regions)
}

/// Search for a Document element (web page content area) within the tree.
/// Returns None if no document found (e.g. Notepad, non-browser apps).
#[cfg(target_os = "windows")]
unsafe fn find_document_element(
    element: &windows::Win32::UI::Accessibility::IUIAutomationElement,
    walker: &windows::Win32::UI::Accessibility::IUIAutomationTreeWalker,
    depth: u32,
) -> Option<windows::Win32::UI::Accessibility::IUIAutomationElement> {
    if depth > 8 { return None; }

    let ct = element.CurrentControlType().map(|c| c.0).unwrap_or(0);
    // 50030 = Document, 50025 could also be used
    if ct == 50030 {
        return Some(element.clone());
    }

    if let Ok(child) = walker.GetFirstChildElement(element) {
        if let Some(doc) = find_document_element(&child, walker, depth + 1) {
            return Some(doc);
        }
        let mut sib = child;
        while let Ok(next) = walker.GetNextSiblingElement(&sib) {
            if let Some(doc) = find_document_element(&next, walker, depth + 1) {
                return Some(doc);
            }
            sib = next;
        }
    }
    None
}

#[cfg(target_os = "windows")]
unsafe fn collect_text(
    element: &windows::Win32::UI::Accessibility::IUIAutomationElement,
    walker: &windows::Win32::UI::Accessibility::IUIAutomationTreeWalker,
    regions: &mut Vec<TextRegion>,
    depth: u32,
) -> Result<(), Box<dyn std::error::Error>> {
    if depth > MAX_DEPTH || regions.len() >= MAX_REGIONS {
        return Ok(());
    }

    // Try to get text and bounds from this element
    let has_children = walker.GetFirstChildElement(element).is_ok();

    if let Ok(name) = element.CurrentName() {
        let text = name.to_string();

        // Only process elements with meaningful text
        if text.len() > 1 && text.len() < 500 {
            if let Ok(rect) = element.CurrentBoundingRectangle() {
                let w = (rect.right - rect.left) as f64;
                let h = (rect.bottom - rect.top) as f64;

                // Skip off-screen, tiny, or huge container elements
                if w > 20.0 && h >= 12.0 && h < 200.0
                    && rect.left >= -10 && rect.top >= -10
                    && rect.left < 3000 && rect.top < 2000
                {
                    // Estimate font size from element height
                    // Single-line text: height ≈ lineHeight ≈ fontSize * 1.3-1.5
                    let font_size = (h / 1.4).clamp(11.0, 42.0);

                    // Skip if text is way too long for the width (multi-line container)
                    let approx_chars = w / (font_size * 0.55);
                    let is_multiline = text.len() as f64 > approx_chars * 1.8;

                    if !is_multiline {
                        regions.push(TextRegion {
                            text,
                            x: rect.left as f64,
                            y: rect.top as f64,
                            width: w,
                            height: h,
                            font_size,
                            source: TextSource::Accessibility,
                        });

                        // If this element had text AND no children, don't recurse
                        if !has_children {
                            return Ok(());
                        }
                    }
                }
            }
        }
    }

    // Recurse into children
    if let Ok(child) = walker.GetFirstChildElement(element) {
        collect_text(&child, walker, regions, depth + 1)?;

        let mut sibling = child;
        while regions.len() < MAX_REGIONS {
            match walker.GetNextSiblingElement(&sibling) {
                Ok(next) => {
                    collect_text(&next, walker, regions, depth + 1)?;
                    sibling = next;
                }
                Err(_) => break,
            }
        }
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn _detect_via_ocr() -> Result<Vec<TextRegion>, Box<dyn std::error::Error>> {
    Ok(Vec::new())
}
