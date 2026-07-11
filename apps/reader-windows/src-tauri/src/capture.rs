// MorphemeFlow Reader — clipboard-based selection capture (Windows)
//
// Every clipboard format is duplicated before Ctrl+C and restored afterward.
// OleDuplicateData handles global-memory, bitmap, palette, and metafile formats
// correctly, avoiding dependence on the previous owner's delayed IDataObject.

#[cfg(windows)]
pub fn capture_selection(source_window: isize) -> Result<Option<String>, String> {
    use std::time::{Duration, Instant};
    use windows::Win32::System::DataExchange::GetClipboardSequenceNumber;

    unsafe {
        let original = ClipboardSnapshot::capture(Duration::from_millis(400))?;
        let initial_sequence = GetClipboardSequenceNumber();
        let capture_result = (|| {
            wait_for_modifier_release(Duration::from_millis(1200))?;
            focus_source_window(source_window, Duration::from_millis(400))?;
            send_ctrl_c()?;
            let deadline = Instant::now() + Duration::from_millis(650);
            while Instant::now() < deadline {
                if GetClipboardSequenceNumber() != initial_sequence {
                    return get_clipboard_text_with_retry(Duration::from_millis(250));
                }
                std::thread::sleep(Duration::from_millis(15));
            }
            Ok(None)
        })();

        let restore_result = original.restore(Duration::from_millis(650));
        restore_result?;
        capture_result.map(|text| text.filter(|value| !value.trim().is_empty()))
    }
}

#[cfg(windows)]
pub fn foreground_window_handle() -> isize {
    unsafe { windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow().0 as isize }
}

#[cfg(windows)]
unsafe fn focus_source_window(
    source_window: isize,
    timeout: std::time::Duration,
) -> Result<(), String> {
    use windows::Win32::{
        Foundation::HWND,
        UI::WindowsAndMessaging::{GetForegroundWindow, IsWindow, SetForegroundWindow},
    };

    let source = HWND(source_window as *mut core::ffi::c_void);
    if source_window == 0 || !IsWindow(Some(source)).as_bool() {
        return Err("The source window closed before its text could be copied".to_string());
    }
    let deadline = std::time::Instant::now() + timeout;
    loop {
        if GetForegroundWindow() == source {
            return Ok(());
        }
        let _ = SetForegroundWindow(source);
        if std::time::Instant::now() >= deadline {
            return Err("The source application would not accept keyboard focus".to_string());
        }
        std::thread::sleep(std::time::Duration::from_millis(15));
    }
}

#[cfg(windows)]
unsafe fn wait_for_modifier_release(timeout: std::time::Duration) -> Result<(), String> {
    use windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;

    const MODIFIER_KEYS: [i32; 5] = [0x10, 0x11, 0x12, 0x5B, 0x5C];
    let deadline = std::time::Instant::now() + timeout;
    loop {
        if MODIFIER_KEYS.iter().all(|key| GetAsyncKeyState(*key) >= 0) {
            return Ok(());
        }
        if std::time::Instant::now() >= deadline {
            return Err("Release the capture shortcut keys, then try again".to_string());
        }
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
}

#[cfg(windows)]
const CF_UNICODETEXT: u32 = 13;
#[cfg(windows)]
const CF_BITMAP: u32 = 2;
#[cfg(windows)]
const CF_METAFILEPICT: u32 = 3;
#[cfg(windows)]
const CF_PALETTE: u32 = 9;
#[cfg(windows)]
const CF_ENHMETAFILE: u32 = 14;
#[cfg(windows)]
const CF_DSPBITMAP: u32 = 0x0082;
#[cfg(windows)]
const CF_DSPMETAFILEPICT: u32 = 0x0083;
#[cfg(windows)]
const CF_DSPENHMETAFILE: u32 = 0x008E;

#[cfg(windows)]
struct ClipboardEntry {
    format: u32,
    handle: windows::Win32::Foundation::HANDLE,
}

#[cfg(windows)]
struct ClipboardSnapshot {
    entries: Vec<ClipboardEntry>,
}

#[cfg(windows)]
impl ClipboardSnapshot {
    unsafe fn capture(timeout: std::time::Duration) -> Result<Self, String> {
        use windows::Win32::{
            Foundation::GetLastError,
            System::{
                DataExchange::{
                    CloseClipboard, CountClipboardFormats, EnumClipboardFormats, GetClipboardData,
                },
                Memory::GMEM_MOVEABLE,
                Ole::{OleDuplicateData, CLIPBOARD_FORMAT},
            },
        };

        open_clipboard_with_retry(timeout)?;
        let expected_count = CountClipboardFormats().max(0) as usize;
        let result = (|| {
            let mut snapshot = ClipboardSnapshot {
                entries: Vec::with_capacity(expected_count),
            };
            let mut current_format = 0u32;
            loop {
                let next_format = EnumClipboardFormats(current_format);
                if next_format == 0 {
                    break;
                }
                let source = GetClipboardData(next_format).map_err(|error| {
                    format!("Could not read clipboard format {next_format}: {error}")
                })?;
                let duplicate =
                    OleDuplicateData(source, CLIPBOARD_FORMAT(next_format as u16), GMEM_MOVEABLE);
                if duplicate.is_invalid() {
                    return Err(format!(
                        "Could not preserve clipboard format {next_format}: {}",
                        GetLastError().to_hresult()
                    ));
                }
                snapshot.entries.push(ClipboardEntry {
                    format: next_format,
                    handle: duplicate,
                });
                current_format = next_format;
            }

            if snapshot.entries.len() != expected_count {
                return Err(format!(
                    "Clipboard changed while it was being preserved (expected {expected_count} formats, copied {})",
                    snapshot.entries.len()
                ));
            }
            Ok(snapshot)
        })();
        let close_result = CloseClipboard()
            .map_err(|error| format!("Could not close the clipboard snapshot: {error}"));

        match (result, close_result) {
            (Ok(snapshot), Ok(())) => Ok(snapshot),
            (Err(error), _) => Err(error),
            (Ok(_), Err(error)) => Err(error),
        }
    }

    unsafe fn restore(mut self, timeout: std::time::Duration) -> Result<(), String> {
        use windows::Win32::System::DataExchange::{
            CloseClipboard, EmptyClipboard, SetClipboardData,
        };

        open_clipboard_with_retry(timeout)?;
        if let Err(error) = EmptyClipboard() {
            let _ = CloseClipboard();
            return Err(format!(
                "Could not clear the captured clipboard data: {error}"
            ));
        }

        let mut failures = Vec::new();
        for entry in &mut self.entries {
            match SetClipboardData(entry.format, Some(entry.handle)) {
                Ok(_) => entry.handle = windows::Win32::Foundation::HANDLE::default(),
                Err(error) => failures.push(format!("{} ({error})", entry.format)),
            }
        }
        let close_result = CloseClipboard()
            .map_err(|error| format!("Could not close the restored clipboard: {error}"));

        if !failures.is_empty() {
            return Err(format!(
                "Captured text, but could not restore clipboard formats: {}",
                failures.join(", ")
            ));
        }
        close_result
    }
}

#[cfg(windows)]
impl Drop for ClipboardSnapshot {
    fn drop(&mut self) {
        for entry in &mut self.entries {
            if !entry.handle.is_invalid() {
                unsafe { release_duplicated_handle(entry.format, entry.handle) };
                entry.handle = windows::Win32::Foundation::HANDLE::default();
            }
        }
    }
}

#[cfg(windows)]
unsafe fn release_duplicated_handle(format: u32, handle: windows::Win32::Foundation::HANDLE) {
    use windows::Win32::{
        Foundation::{GlobalFree, HGLOBAL},
        Graphics::Gdi::{DeleteEnhMetaFile, DeleteMetaFile, DeleteObject, HENHMETAFILE, HGDIOBJ},
        System::{
            DataExchange::METAFILEPICT,
            Memory::{GlobalLock, GlobalUnlock},
        },
    };

    match format {
        CF_BITMAP | CF_DSPBITMAP | CF_PALETTE => {
            let _ = DeleteObject(HGDIOBJ(handle.0));
        }
        CF_ENHMETAFILE | CF_DSPENHMETAFILE => {
            let _ = DeleteEnhMetaFile(Some(HENHMETAFILE(handle.0)));
        }
        CF_METAFILEPICT | CF_DSPMETAFILEPICT => {
            let global = HGLOBAL(handle.0);
            let pointer = GlobalLock(global);
            if !pointer.is_null() {
                let picture = &*(pointer as *const METAFILEPICT);
                let _ = DeleteMetaFile(picture.hMF);
                let _ = GlobalUnlock(global);
            }
            let _ = GlobalFree(Some(global));
        }
        _ => {
            let _ = GlobalFree(Some(HGLOBAL(handle.0)));
        }
    }
}

#[cfg(windows)]
unsafe fn open_clipboard_with_retry(timeout: std::time::Duration) -> Result<(), String> {
    use windows::Win32::System::DataExchange::OpenClipboard;

    let deadline = std::time::Instant::now() + timeout;
    loop {
        match OpenClipboard(None) {
            Ok(()) => return Ok(()),
            Err(error) if std::time::Instant::now() >= deadline => {
                return Err(format!("Clipboard remained busy: {error}"));
            }
            Err(_) => std::thread::sleep(std::time::Duration::from_millis(10)),
        }
    }
}

#[cfg(windows)]
unsafe fn get_clipboard_text_with_retry(
    timeout: std::time::Duration,
) -> Result<Option<String>, String> {
    let deadline = std::time::Instant::now() + timeout;
    loop {
        if let Some(text) = try_get_clipboard_text() {
            return Ok(Some(text));
        }
        if std::time::Instant::now() >= deadline {
            return Ok(None);
        }
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
}

#[cfg(windows)]
unsafe fn try_get_clipboard_text() -> Option<String> {
    use windows::Win32::Foundation::HGLOBAL;
    use windows::Win32::System::{DataExchange::*, Memory::*};

    if OpenClipboard(None).is_err() {
        return None;
    }
    let result = (|| {
        if IsClipboardFormatAvailable(CF_UNICODETEXT).is_err() {
            return None;
        }
        let handle = GetClipboardData(CF_UNICODETEXT).ok()?;
        let global = HGLOBAL(handle.0);
        let pointer = GlobalLock(global);
        if pointer.is_null() {
            return None;
        }

        let wide_pointer = pointer as *const u16;
        let mut length = 0usize;
        while *wide_pointer.add(length) != 0 {
            length += 1;
        }
        let text = String::from_utf16_lossy(std::slice::from_raw_parts(wide_pointer, length));
        let _ = GlobalUnlock(global);
        Some(text)
    })();
    let _ = CloseClipboard();
    result
}

#[cfg(windows)]
unsafe fn send_ctrl_c() -> Result<(), String> {
    use windows::Win32::UI::Input::KeyboardAndMouse::*;

    let inputs = [
        keyboard_input(VIRTUAL_KEY(0x11), KEYBD_EVENT_FLAGS(0)),
        keyboard_input(VIRTUAL_KEY(0x43), KEYBD_EVENT_FLAGS(0)),
        keyboard_input(VIRTUAL_KEY(0x43), KEYEVENTF_KEYUP),
        keyboard_input(VIRTUAL_KEY(0x11), KEYEVENTF_KEYUP),
    ];
    let sent = SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
    if sent == inputs.len() as u32 {
        Ok(())
    } else {
        Err(format!(
            "Windows accepted only {sent} of {} keyboard events",
            inputs.len()
        ))
    }
}

#[cfg(windows)]
fn keyboard_input(
    key: windows::Win32::UI::Input::KeyboardAndMouse::VIRTUAL_KEY,
    flags: windows::Win32::UI::Input::KeyboardAndMouse::KEYBD_EVENT_FLAGS,
) -> windows::Win32::UI::Input::KeyboardAndMouse::INPUT {
    use windows::Win32::UI::Input::KeyboardAndMouse::*;

    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: key,
                wScan: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

#[cfg(not(windows))]
pub fn capture_selection(_source_window: isize) -> Result<Option<String>, String> {
    Err("Selection capture is only supported on Windows".to_string())
}

#[cfg(not(windows))]
pub fn foreground_window_handle() -> isize {
    0
}
