use crate::tracker::SemanticRegion;
use compositor::FrameRect;

#[cfg(target_os = "windows")]
use windows::core::Result;

#[cfg(target_os = "windows")]
pub fn detect_visible_text_regions(max_regions: usize) -> Result<Vec<SemanticRegion>> {
    use windows::Win32::Foundation::{HWND, RPC_E_CHANGED_MODE};
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED};
    use windows::Win32::UI::Accessibility::{
        CUIAutomation, IUIAutomation, IUIAutomationValuePattern, TreeScope_Subtree,
        UIA_EditControlTypeId, UIA_HyperlinkControlTypeId, UIA_TextControlTypeId, UIA_ValuePatternId,
    };
    use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

    let coinit = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
    if coinit != RPC_E_CHANGED_MODE {
        coinit.ok()?;
    }

    let uia: IUIAutomation = unsafe { CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER)? };

    let hwnd: HWND = unsafe { GetForegroundWindow() };
    if hwnd.is_invalid() || hwnd == HWND::default() {
        return Ok(Vec::new());
    }

    let root = unsafe { uia.ElementFromHandle(hwnd)? };
    let condition = unsafe { uia.CreateTrueCondition()? };
    let all = unsafe { root.FindAll(TreeScope_Subtree, &condition)? };
    let count = unsafe { all.Length().unwrap_or(0) };

    let mut regions = Vec::new();
    let mut seen = std::collections::HashSet::<(i32, i32, String)>::new();

    for i in 0..count {
        if regions.len() >= max_regions {
            break;
        }

        let element = match unsafe { all.GetElement(i) } {
            Ok(element) => element,
            Err(_) => continue,
        };

        let control_type = match unsafe { element.CurrentControlType() } {
            Ok(control_type) => control_type.0,
            Err(_) => continue,
        };

        if control_type != UIA_TextControlTypeId.0
            && control_type != UIA_HyperlinkControlTypeId.0
            && control_type != UIA_EditControlTypeId.0
        {
            continue;
        }

        let mut text = unsafe { element.CurrentName() }
            .map(|name| name.to_string())
            .unwrap_or_default()
            .trim()
            .to_string();

        if text.is_empty() && control_type == UIA_EditControlTypeId.0 {
            if let Ok(pattern) =
                unsafe { element.GetCurrentPatternAs::<IUIAutomationValuePattern>(UIA_ValuePatternId) }
            {
                text = unsafe { pattern.CurrentValue() }
                    .map(|value| value.to_string())
                    .unwrap_or_default()
                    .trim()
                    .to_string();
            }
        }

        text = normalize_text(&text);
        if !looks_like_readable_text(&text) {
            continue;
        }

        let rect = match unsafe { element.CurrentBoundingRectangle() } {
            Ok(rect) => rect,
            Err(_) => continue,
        };

        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;
        if width < 28 || height < 10 || width > 3200 || height > 600 {
            continue;
        }

        // Common browser/app chrome areas near the top tend to introduce noisy anchors.
        if rect.top < 80 && height <= 48 {
            continue;
        }

        // Dedupe near-identical items to keep overlay stable.
        let dedupe_key = (rect.left / 8, rect.top / 8, text.clone());
        if !seen.insert(dedupe_key) {
            continue;
        }

        regions.push(SemanticRegion {
            text,
            rect: FrameRect {
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
            },
        });
    }

    Ok(post_process_regions(regions, max_regions))
}

#[cfg(not(target_os = "windows"))]
pub fn detect_visible_text_regions(_max_regions: usize) -> Result<Vec<SemanticRegion>, String> {
    Ok(Vec::new())
}

fn post_process_regions(mut regions: Vec<SemanticRegion>, max_regions: usize) -> Vec<SemanticRegion> {
    if regions.len() <= 1 {
        return regions;
    }

    regions.sort_by_key(|region| (region.rect.top, region.rect.left));
    let merged = merge_same_line(regions);
    let deduped = dedup_overlapping(merged);

    let mut ranked = deduped;
    ranked.sort_by(|a, b| score_region(b).total_cmp(&score_region(a)));
    ranked.truncate(max_regions.min(120));
    ranked.sort_by_key(|region| (region.rect.top, region.rect.left));
    ranked
}

fn merge_same_line(regions: Vec<SemanticRegion>) -> Vec<SemanticRegion> {
    let mut merged: Vec<SemanticRegion> = Vec::with_capacity(regions.len());

    for region in regions {
        if let Some(last) = merged.last_mut() {
            let same_line = (region.rect.top - last.rect.top).abs() <= 9
                && (region.rect.bottom - last.rect.bottom).abs() <= 14;
            let gap = region.rect.left - last.rect.right;
            let adjacent = (-6..=26).contains(&gap);
            let merged_text_len = last.text.chars().count() + region.text.chars().count();

            if same_line && adjacent && merged_text_len <= 260 {
                if !last.text.ends_with(' ') {
                    last.text.push(' ');
                }
                last.text.push_str(region.text.trim());
                last.rect.right = last.rect.right.max(region.rect.right);
                last.rect.bottom = last.rect.bottom.max(region.rect.bottom);
                continue;
            }
        }

        merged.push(region);
    }

    merged
}

fn dedup_overlapping(mut regions: Vec<SemanticRegion>) -> Vec<SemanticRegion> {
    regions.sort_by(|a, b| {
        let a_len = a.text.chars().count();
        let b_len = b.text.chars().count();
        b_len.cmp(&a_len)
    });

    let mut kept: Vec<SemanticRegion> = Vec::with_capacity(regions.len());
    for region in regions {
        let overlaps_existing = kept.iter().any(|existing| {
            if existing.text == region.text {
                return true;
            }

            overlap_ratio(&existing.rect, &region.rect) > 0.55
        });

        if !overlaps_existing {
            kept.push(region);
        }
    }

    kept
}

fn overlap_ratio(a: &FrameRect, b: &FrameRect) -> f32 {
    let left = a.left.max(b.left);
    let top = a.top.max(b.top);
    let right = a.right.min(b.right);
    let bottom = a.bottom.min(b.bottom);

    let overlap_w = (right - left).max(0) as f32;
    let overlap_h = (bottom - top).max(0) as f32;
    if overlap_w <= 0.0 || overlap_h <= 0.0 {
        return 0.0;
    }

    let overlap = overlap_w * overlap_h;
    let area = area_of_rect(a).min(area_of_rect(b)).max(1) as f32;
    overlap / area
}

fn score_region(region: &SemanticRegion) -> f32 {
    let area = area_of_rect(&region.rect) as f32;
    let chars = region.text.chars().count() as f32;
    (area.sqrt() * 0.6) + (chars * 1.8)
}

fn area_of_rect(rect: &FrameRect) -> i32 {
    let width = (rect.right - rect.left).max(0);
    let height = (rect.bottom - rect.top).max(0);
    width * height
}

fn looks_like_readable_text(text: &str) -> bool {
    let len = text.chars().count();
    if !(4..=260).contains(&len) {
        return false;
    }

    let has_alpha = text.chars().any(|c| c.is_alphabetic());
    if !has_alpha {
        return false;
    }

    let punctuation_only = text
        .chars()
        .all(|c| c.is_whitespace() || c.is_ascii_punctuation());
    if punctuation_only {
        return false;
    }

    true
}

fn normalize_text(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut prev_space = false;

    for ch in input.chars() {
        let is_space = ch.is_whitespace();
        if is_space {
            if !prev_space {
                out.push(' ');
            }
        } else {
            out.push(ch);
        }
        prev_space = is_space;
    }

    out.trim().to_string()
}
