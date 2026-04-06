// MorphemeFlow — UIA tree depth diagnostic
// Dumps the control type tree with depth info to understand nesting.
// Usage: cargo run --bin dump_tree -- "Chrome"

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let title_filter = args.get(1).cloned();
    dump_tree(title_filter.as_deref());
}

#[cfg(target_os = "windows")]
fn dump_tree(title_filter: Option<&str>) {
    use windows::Win32::UI::Accessibility::*;
    use windows::Win32::UI::WindowsAndMessaging::*;
    use windows::Win32::Foundation::*;
    use windows::Win32::System::Com::*;

    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED).ok();

        let uia: IUIAutomation = CoCreateInstance(
            &CUIAutomation, None, CLSCTX_INPROC_SERVER,
        ).expect("Failed to create UIA");

        // Find window
        let mut hwnd = GetTopWindow(None).unwrap_or(HWND::default());
        let our_pid = std::process::id();
        let mut target = HWND::default();

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
                                eprintln!("Found: \"{}\"", title);
                                target = hwnd;
                                break;
                            }
                        } else {
                            target = hwnd;
                            break;
                        }
                    }
                }
            }
            hwnd = match GetWindow(hwnd, GW_HWNDNEXT) {
                Ok(h) => h,
                Err(_) => break,
            };
        }

        if target.is_invalid() || target == HWND::default() {
            eprintln!("No matching window found");
            return;
        }

        let root = uia.ElementFromHandle(target).expect("ElementFromHandle failed");
        let mut stats = TreeStats::default();
        walk_tree(&root, &uia, 0, &mut stats, 25);

        eprintln!("\n=== TREE STATS ===");
        eprintln!("Max depth reached: {}", stats.max_depth);
        eprintln!("Total nodes visited: {}", stats.total_nodes);
        eprintln!("Text nodes (50020) by depth:");
        for (depth, count) in &stats.text_by_depth {
            eprintln!("  depth {}: {} text nodes", depth, count);
        }
        eprintln!("Hyperlink nodes (50005) by depth:");
        for (depth, count) in &stats.hyperlink_by_depth {
            eprintln!("  depth {}: {} hyperlink nodes", depth, count);
        }
        eprintln!("Button nodes (50000) by depth:");
        for (depth, count) in &stats.button_by_depth {
            eprintln!("  depth {}: {} button nodes", depth, count);
        }
        eprintln!("ToolBar nodes (50021) by depth:");
        for (depth, count) in &stats.toolbar_by_depth {
            eprintln!("  depth {}: {} toolbar nodes", depth, count);
        }
        eprintln!("\nText nodes at depth > 12:");
        for entry in &stats.deep_text_samples {
            eprintln!("  {}", entry);
        }
        eprintln!("\nText nodes that are children of Button (50000):");
        for entry in &stats.text_under_button {
            eprintln!("  {}", entry);
        }
        eprintln!("\nText nodes that are children of ToolBar (50021):");
        for entry in &stats.text_under_toolbar {
            eprintln!("  {}", entry);
        }
        eprintln!("\nSkipped-type nodes with text children:");
        for entry in &stats.skip_type_with_text_children {
            eprintln!("  {}", entry);
        }
    }
}

#[derive(Default)]
struct TreeStats {
    max_depth: u32,
    total_nodes: u32,
    text_by_depth: std::collections::BTreeMap<u32, u32>,
    hyperlink_by_depth: std::collections::BTreeMap<u32, u32>,
    button_by_depth: std::collections::BTreeMap<u32, u32>,
    toolbar_by_depth: std::collections::BTreeMap<u32, u32>,
    deep_text_samples: Vec<String>,
    text_under_button: Vec<String>,
    text_under_toolbar: Vec<String>,
    skip_type_with_text_children: Vec<String>,
}

const SKIP_TYPES: &[i32] = &[50000, 50006, 50019, 50021, 50013, 50025, 50011, 50012];

#[cfg(target_os = "windows")]
unsafe fn walk_tree(
    element: &windows::Win32::UI::Accessibility::IUIAutomationElement,
    uia: &windows::Win32::UI::Accessibility::IUIAutomation,
    depth: u32,
    stats: &mut TreeStats,
    max_depth: u32,
) {
    use windows::Win32::UI::Accessibility::*;

    if depth > max_depth || stats.total_nodes > 5000 {
        return;
    }

    stats.total_nodes += 1;
    if depth > stats.max_depth {
        stats.max_depth = depth;
    }

    let control_type = element.CurrentControlType().map(|c| c.0).unwrap_or(0);
    let name = element.CurrentName()
        .map(|n| n.to_string())
        .unwrap_or_default();
    let name_preview: String = name.chars().take(60).collect();

    // Track by depth
    match control_type {
        50020 => { *stats.text_by_depth.entry(depth).or_insert(0) += 1; }
        50005 => { *stats.hyperlink_by_depth.entry(depth).or_insert(0) += 1; }
        50000 => { *stats.button_by_depth.entry(depth).or_insert(0) += 1; }
        50021 => { *stats.toolbar_by_depth.entry(depth).or_insert(0) += 1; }
        _ => {}
    }

    // Log text nodes beyond depth 12
    if (control_type == 50020 || control_type == 50005) && depth > 12 && !name.is_empty() {
        if stats.deep_text_samples.len() < 30 {
            stats.deep_text_samples.push(format!(
                "depth={} type={} text=\"{}\"", depth, control_type, name_preview
            ));
        }
    }

    // Print tree structure for first 400 nodes (with indentation)
    if stats.total_nodes <= 400 {
        let indent = "  ".repeat(depth as usize);
        let type_name = match control_type {
            50000 => "Button",
            50004 => "Edit",
            50005 => "Hyperlink",
            50006 => "Image",
            50007 => "ListItem",
            50008 => "Tree",
            50009 => "List",
            50010 => "DataItem",
            50011 => "Menu",
            50012 => "MenuItem",
            50013 => "ScrollBar",
            50014 => "Header",
            50015 => "Custom",
            50016 => "Pane",
            50017 => "HeaderItem",
            50018 => "StatusBar",
            50019 => "TabItem",
            50020 => "Text",
            50021 => "ToolBar",
            50023 => "Tab",
            50024 => "TreeItem",
            50025 => "TitleBar",
            50026 => "Group",
            50030 => "Document",
            50032 => "Window",
            50033 => "MenuBar",
            _ => "Other",
        };
        if !name.is_empty() && name.len() > 1 {
            eprintln!("{}[d={}] {} ({}) name=\"{}\"", indent, depth, type_name, control_type, name_preview);
        } else {
            eprintln!("{}[d={}] {} ({})", indent, depth, type_name, control_type);
        }
    }

    // Check if this is a skip type with text children
    if SKIP_TYPES.contains(&control_type) {
        let condition = uia.CreateTrueCondition().unwrap();
        if let Ok(children) = element.FindAll(TreeScope_Children, &condition) {
            let count = children.Length().unwrap_or(0);
            for i in 0..count {
                if let Ok(child) = children.GetElement(i) {
                    let child_type = child.CurrentControlType().map(|c| c.0).unwrap_or(0);
                    let child_name = child.CurrentName()
                        .map(|n| n.to_string())
                        .unwrap_or_default();
                    if (child_type == 50020 || child_type == 50005) && !child_name.is_empty() {
                        let preview: String = child_name.chars().take(60).collect();
                        let type_name = match control_type {
                            50000 => "Button",
                            50006 => "Image",
                            50021 => "ToolBar",
                            50019 => "TabItem",
                            _ => "Skip",
                        };
                        if stats.skip_type_with_text_children.len() < 30 {
                            stats.skip_type_with_text_children.push(format!(
                                "parent={}({}) child={}({}) text=\"{}\" depth={}",
                                type_name, control_type, child_type,
                                if child_type == 50020 { "Text" } else { "Hyperlink" },
                                preview, depth + 1
                            ));
                        }
                        if control_type == 50000 {
                            if stats.text_under_button.len() < 20 {
                                stats.text_under_button.push(format!(
                                    "depth={} text=\"{}\"", depth + 1, preview
                                ));
                            }
                        }
                        if control_type == 50021 {
                            if stats.text_under_toolbar.len() < 20 {
                                stats.text_under_toolbar.push(format!(
                                    "depth={} text=\"{}\"", depth + 1, preview
                                ));
                            }
                        }
                    }
                }
            }
        }
        // Don't recurse further (matching current behavior)
        return;
    }

    // Recurse into children
    let condition = uia.CreateTrueCondition().unwrap();
    if let Ok(children) = element.FindAll(TreeScope_Children, &condition) {
        let count = children.Length().unwrap_or(0);
        for i in 0..count {
            if let Ok(child) = children.GetElement(i) {
                walk_tree(&child, uia, depth + 1, stats, max_depth);
            }
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn dump_tree(_title_filter: Option<&str>) {
    eprintln!("Only supported on Windows");
}
