use std::io::BufRead;
use windows::Win32::{
    Foundation::{HINSTANCE, HWND, LPARAM, LRESULT, POINT, WPARAM},
    Graphics::{Dwm::DwmFlush, Gdi::*},
    System::LibraryLoader::GetModuleHandleW,
    UI::{Controls::EM_SETSEL, HiDpi::*, Input::KeyboardAndMouse::*, WindowsAndMessaging::*},
};
use windows_core::w;

struct ReaderWindowSearch {
    process_id: u32,
    window: HWND,
}

unsafe extern "system" fn find_reader(window: HWND, parameter: LPARAM) -> windows_core::BOOL {
    let search = &mut *(parameter.0 as *mut ReaderWindowSearch);
    let mut process_id = 0;
    GetWindowThreadProcessId(window, Some(&mut process_id));
    if process_id == search.process_id {
        let mut title = [0u16; 128];
        let length = GetWindowTextW(window, &mut title) as usize;
        if String::from_utf16_lossy(&title[..length]) == "MorphemeFlow Reader" {
            search.window = window;
            return false.into();
        }
    }
    true.into()
}

unsafe extern "system" fn fixture_proc(
    window: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if message == WM_DESTROY {
        PostQuitMessage(0);
        return LRESULT(0);
    }
    DefWindowProcW(window, message, wparam, lparam)
}

fn main() -> windows_core::Result<()> {
    let reader_process = std::env::args()
        .nth(1)
        .and_then(|value| value.parse::<u32>().ok());
    unsafe {
        let _ = SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
        let instance: HINSTANCE = GetModuleHandleW(None)?.into();
        let class = WNDCLASSW {
            lpfnWndProc: Some(fixture_proc),
            hInstance: instance,
            lpszClassName: w!("MorphemeFlow.ReadingFixture"),
            hbrBackground: HBRUSH(GetStockObject(WHITE_BRUSH).0),
            ..Default::default()
        };
        RegisterClassW(&class);
        let window = CreateWindowExW(
            WS_EX_TOOLWINDOW,
            class.lpszClassName,
            w!("MorphemeFlow runtime test source"),
            WS_OVERLAPPEDWINDOW | WS_VISIBLE,
            80,
            80,
            1000,
            600,
            None,
            None,
            Some(instance),
            None,
        )?;
        let edit = CreateWindowExW(
            WINDOW_EX_STYLE::default(),
            w!("EDIT"),
            w!("Reading independently"),
            WS_CHILD | WS_VISIBLE | WINDOW_STYLE(ES_MULTILINE as u32),
            40,
            110,
            880,
            360,
            Some(window),
            None,
            Some(instance),
            None,
        )?;
        let font = CreateFontW(
            -36,
            0,
            0,
            0,
            FW_NORMAL.0 as i32,
            0,
            0,
            0,
            DEFAULT_CHARSET,
            OUT_DEFAULT_PRECIS,
            CLIP_DEFAULT_PRECIS,
            CLEARTYPE_QUALITY,
            DEFAULT_PITCH.0 as u32,
            w!("Segoe UI"),
        );
        SendMessageW(
            edit,
            WM_SETFONT,
            Some(WPARAM(font.0 as usize)),
            Some(LPARAM(1)),
        );
        SendMessageW(edit, EM_SETSEL, Some(WPARAM(0)), Some(LPARAM(-1)));
        SetWindowPos(
            window,
            Some(HWND_TOPMOST),
            80,
            80,
            1000,
            600,
            SWP_SHOWWINDOW,
        )?;
        let _ = SetForegroundWindow(window);
        let _ = SetFocus(Some(edit));
        let mut origin = POINT::default();
        let _ = ClientToScreen(edit, &mut origin);
        SetCursorPos(origin.x + 200, origin.y + 24)?;
        let _ = UpdateWindow(window);
        let _ = DwmFlush();
        let mouse_input = |flags| INPUT {
            r#type: INPUT_MOUSE,
            Anonymous: INPUT_0 {
                mi: MOUSEINPUT {
                    dwFlags: flags,
                    ..Default::default()
                },
            },
        };
        SendInput(
            &[
                mouse_input(MOUSEEVENTF_LEFTDOWN),
                mouse_input(MOUSEEVENTF_LEFTUP),
            ],
            std::mem::size_of::<INPUT>() as i32,
        );
        SetTimer(Some(window), 1, 100, None);
        let handle = window.0 as isize;
        std::thread::spawn(move || {
            for line in std::io::stdin().lock().lines().map_while(Result::ok) {
                let message = match line.as_str() {
                    "next" => WM_APP + 1,
                    "stop" => WM_APP + 2,
                    "close-reader" => WM_APP + 3,
                    _ => WM_CLOSE,
                };
                let _ = PostMessageW(Some(HWND(handle as *mut _)), message, WPARAM(0), LPARAM(0));
            }
        });
        let mut message = MSG::default();
        while GetMessageW(&mut message, None, 0, 0).0 > 0 {
            if message.message == WM_TIMER {
                let _ = KillTimer(Some(window), 1);
                SendMessageW(edit, EM_SETSEL, Some(WPARAM(0)), Some(LPARAM(-1)));
                println!(
                    "{}",
                    serde_json::json!({ "ready": true, "foreground": GetForegroundWindow() == window, "x": origin.x, "y": origin.y })
                );
            } else if message.message == WM_APP + 3 {
                if let Some(process_id) = reader_process {
                    let mut search = ReaderWindowSearch {
                        process_id,
                        window: HWND::default(),
                    };
                    let _ = EnumWindows(Some(find_reader), LPARAM(&mut search as *mut _ as isize));
                    if !search.window.is_invalid() {
                        PostMessageW(
                            Some(search.window),
                            WM_SYSCOMMAND,
                            WPARAM(SC_CLOSE as usize),
                            LPARAM(0),
                        )?;
                    }
                }
            } else if message.message == WM_APP + 2 {
                let key = |code, flags| INPUT {
                    r#type: INPUT_KEYBOARD,
                    Anonymous: INPUT_0 {
                        ki: KEYBDINPUT {
                            wVk: code,
                            dwFlags: flags,
                            ..Default::default()
                        },
                    },
                };
                let inputs = [
                    key(VK_CONTROL, KEYBD_EVENT_FLAGS::default()),
                    key(VK_MENU, KEYBD_EVENT_FLAGS::default()),
                    key(VK_SHIFT, KEYBD_EVENT_FLAGS::default()),
                    key(VK_ESCAPE, KEYBD_EVENT_FLAGS::default()),
                    key(VK_ESCAPE, KEYEVENTF_KEYUP),
                    key(VK_SHIFT, KEYEVENTF_KEYUP),
                    key(VK_MENU, KEYEVENTF_KEYUP),
                    key(VK_CONTROL, KEYEVENTF_KEYUP),
                ];
                SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
            } else if message.message == WM_APP + 1 {
                SetWindowTextW(edit, w!("Understanding information"))?;
                SendMessageW(edit, EM_SETSEL, Some(WPARAM(0)), Some(LPARAM(0)));
                let _ = SetFocus(Some(window));
                let _ = UpdateWindow(edit);
            } else {
                let _ = TranslateMessage(&message);
                DispatchMessageW(&message);
            }
        }
        let _ = DeleteObject(font.into());
    }
    Ok(())
}
