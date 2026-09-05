use super::{focus_rects, OverlaySettings, ScreenRect, Tint};
use std::sync::{mpsc, Mutex};
use std::time::Duration;
use windows::Win32::{
    Foundation::{COLORREF, HINSTANCE, HWND, LPARAM, LRESULT, POINT, WPARAM},
    Graphics::{Dwm::DwmFlush, Gdi::*},
    System::LibraryLoader::GetModuleHandleW,
    UI::{HiDpi::*, WindowsAndMessaging::*},
};
use windows_core::w;

const WAKE: u32 = WM_APP + 7;

enum Command {
    Configure(OverlaySettings, mpsc::SyncSender<Result<(), String>>),
    Suspend(bool, mpsc::SyncSender<()>),
    Stop,
}

pub struct OverlayController {
    sender: mpsc::Sender<Command>,
    wake_window: isize,
    settings: Mutex<OverlaySettings>,
}

impl OverlayController {
    pub fn start() -> Result<Self, String> {
        let (sender, receiver) = mpsc::channel();
        let (ready_sender, ready_receiver) = mpsc::sync_channel(1);
        std::thread::Builder::new()
            .name("morphemeflow-overlay".to_string())
            .spawn(move || unsafe {
                let mut layers = match Layers::new() {
                    Ok(layers) => layers,
                    Err(error) => {
                        let _ = ready_sender.send(Err(error));
                        return;
                    }
                };
                let _ = ready_sender.send(Ok(layers.windows[0].0 as isize));
                let mut config = OverlaySettings::default();
                let mut suspensions = 0u32;
                let mut message = MSG::default();
                while GetMessageW(&mut message, None, 0, 0).0 > 0 {
                    if message.message == WAKE {
                        for command in receiver.try_iter() {
                            match command {
                                Command::Configure(next, response) => {
                                    config = next;
                                    layers.anchor = None;
                                    let result = layers.update(config, suspensions > 0);
                                    if result.is_err() {
                                        config.enabled = false;
                                        layers.hide();
                                    }
                                    if config.enabled {
                                        SetTimer(Some(layers.windows[0]), 1, 16, None);
                                    } else {
                                        let _ = KillTimer(Some(layers.windows[0]), 1);
                                    }
                                    let _ = response.send(result);
                                }
                                Command::Suspend(paused, response) => {
                                    if paused {
                                        suspensions = suspensions.saturating_add(1);
                                    } else {
                                        suspensions = suspensions.saturating_sub(1);
                                    }
                                    let _ = layers.update(config, suspensions > 0);
                                    let _ = DwmFlush();
                                    let _ = response.send(());
                                }
                                Command::Stop => return,
                            }
                        }
                    } else if message.message == WM_TIMER {
                        if layers.update(config, suspensions > 0).is_err() {
                            layers.hide();
                        }
                    } else {
                        let _ = TranslateMessage(&message);
                        DispatchMessageW(&message);
                    }
                }
            })
            .map_err(|error| format!("Could not start the screen overlay: {error}"))?;
        let wake_window = ready_receiver
            .recv_timeout(Duration::from_secs(5))
            .map_err(|error| format!("Screen overlay did not initialize: {error}"))??;
        Ok(Self {
            sender,
            wake_window,
            settings: Mutex::new(OverlaySettings::default()),
        })
    }

    fn send(&self, command: Command) -> Result<(), String> {
        self.sender
            .send(command)
            .map_err(|_| "Screen overlay has stopped".to_string())?;
        unsafe {
            PostMessageW(
                Some(HWND(self.wake_window as *mut _)),
                WAKE,
                WPARAM(0),
                LPARAM(0),
            )
        }
        .map_err(|error| format!("Could not update screen overlay: {error}"))
    }

    pub fn settings(&self) -> OverlaySettings {
        *self
            .settings
            .lock()
            .unwrap_or_else(|error| error.into_inner())
    }

    pub fn configure(&self, settings: OverlaySettings) -> Result<(), String> {
        settings.validate()?;
        let mut current = self
            .settings
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let (sender, receiver) = mpsc::sync_channel(1);
        self.send(Command::Configure(settings, sender))?;
        receiver
            .recv_timeout(Duration::from_secs(2))
            .map_err(|error| format!("Screen overlay did not respond: {error}"))??;
        *current = settings;
        Ok(())
    }

    pub fn suspend(&self) -> Result<OverlaySuspension<'_>, String> {
        self.set_suspended(true)?;
        Ok(OverlaySuspension(self))
    }

    fn set_suspended(&self, paused: bool) -> Result<(), String> {
        let (sender, receiver) = mpsc::sync_channel(1);
        self.send(Command::Suspend(paused, sender))?;
        receiver
            .recv_timeout(Duration::from_secs(2))
            .map_err(|error| format!("Could not pause screen overlay: {error}"))
    }
}

impl Drop for OverlayController {
    fn drop(&mut self) {
        let _ = self.send(Command::Stop);
    }
}

pub struct OverlaySuspension<'a>(&'a OverlayController);

impl Drop for OverlaySuspension<'_> {
    fn drop(&mut self) {
        let _ = self.0.set_suspended(false);
    }
}

struct Layers {
    windows: [HWND; 3],
    anchor: Option<POINT>,
    previous: Option<([ScreenRect; 3], OverlaySettings)>,
}

impl Layers {
    unsafe fn new() -> Result<Self, String> {
        let _ = SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
        let instance: HINSTANCE = GetModuleHandleW(None)
            .map_err(|error| error.to_string())?
            .into();
        let class_name = w!("MorphemeFlow.FocusLayer");
        let class = WNDCLASSW {
            lpfnWndProc: Some(layer_proc),
            hInstance: instance,
            lpszClassName: class_name,
            ..Default::default()
        };
        RegisterClassW(&class);
        let mut layers = Self {
            windows: [HWND::default(); 3],
            anchor: None,
            previous: None,
        };
        for window in &mut layers.windows {
            *window = CreateWindowExW(
                WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW,
                class_name,
                w!("MorphemeFlow Focus Overlay"),
                WS_POPUP,
                0,
                0,
                0,
                0,
                None,
                None,
                Some(instance),
                None,
            )
            .map_err(|error| format!("Could not create a screen overlay: {error}"))?;
            let _ = SetWindowDisplayAffinity(*window, WDA_EXCLUDEFROMCAPTURE);
        }
        Ok(layers)
    }

    unsafe fn hide(&mut self) {
        for window in self.windows {
            let _ = ShowWindow(window, SW_HIDE);
        }
        self.previous = None;
    }

    unsafe fn update(&mut self, settings: OverlaySettings, suspended: bool) -> Result<(), String> {
        if !settings.enabled || suspended {
            self.hide();
            return Ok(());
        }
        let mut cursor = POINT::default();
        GetCursorPos(&mut cursor).map_err(|error| error.to_string())?;
        let anchor = if settings.follow_pointer {
            cursor
        } else {
            *self.anchor.get_or_insert(cursor)
        };
        let monitor = MonitorFromPoint(anchor, MONITOR_DEFAULTTONEAREST);
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        if !GetMonitorInfoW(monitor, &mut info).as_bool() {
            return Err("Could not locate the overlay display".to_string());
        }
        let bounds = ScreenRect {
            x: info.rcMonitor.left,
            y: info.rcMonitor.top,
            width: info.rcMonitor.right - info.rcMonitor.left,
            height: info.rcMonitor.bottom - info.rcMonitor.top,
        };
        let mut dpi_x = 96;
        let mut dpi_y = 96;
        let _ = GetDpiForMonitor(monitor, MDT_EFFECTIVE_DPI, &mut dpi_x, &mut dpi_y);
        let rects = focus_rects(bounds, anchor.y, settings.band_height * dpi_y / 96);
        if self.previous == Some((rects, settings)) {
            return Ok(());
        }
        for (index, rect) in rects.iter().enumerate() {
            let window = self.windows[index];
            let (color, opacity) = if index == 1 {
                (tint_color(settings.tint), settings.tint_opacity)
            } else {
                (COLORREF(0), settings.dim_opacity)
            };
            if rect.height == 0 || opacity == 0 {
                let _ = ShowWindow(window, SW_HIDE);
                continue;
            }
            SetWindowLongPtrW(window, GWLP_USERDATA, color.0 as isize);
            SetLayeredWindowAttributes(
                window,
                COLORREF(0),
                (u16::from(opacity) * 255 / 100) as u8,
                LWA_ALPHA,
            )
            .map_err(|error| error.to_string())?;
            SetWindowPos(
                window,
                Some(HWND_TOPMOST),
                rect.x,
                rect.y,
                rect.width,
                rect.height,
                SWP_NOACTIVATE | SWP_SHOWWINDOW,
            )
            .map_err(|error| error.to_string())?;
            let _ = InvalidateRect(Some(window), None, true);
        }
        self.previous = Some((rects, settings));
        Ok(())
    }
}

impl Drop for Layers {
    fn drop(&mut self) {
        for window in self.windows {
            if !window.is_invalid() {
                unsafe {
                    let _ = DestroyWindow(window);
                }
            }
        }
    }
}

fn tint_color(tint: Tint) -> COLORREF {
    let (red, green, blue) = match tint {
        Tint::Warm => (255, 225, 150),
        Tint::Rose => (255, 182, 200),
        Tint::Mint => (174, 235, 193),
        Tint::Sky => (174, 214, 255),
    };
    COLORREF(red | green << 8 | blue << 16)
}

unsafe extern "system" fn layer_proc(
    window: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    match message {
        WM_NCHITTEST => LRESULT(HTTRANSPARENT as isize),
        WM_MOUSEACTIVATE => LRESULT(MA_NOACTIVATE as isize),
        WM_CLOSE => LRESULT(0),
        WM_PAINT => {
            let mut paint = PAINTSTRUCT::default();
            let context = BeginPaint(window, &mut paint);
            let brush = CreateSolidBrush(COLORREF(GetWindowLongPtrW(window, GWLP_USERDATA) as u32));
            FillRect(context, &paint.rcPaint, brush);
            let _ = DeleteObject(brush.into());
            let _ = EndPaint(window, &paint);
            LRESULT(0)
        }
        _ => DefWindowProcW(window, message, wparam, lparam),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use windows::Win32::UI::Input::KeyboardAndMouse::*;

    static CLICKS: AtomicUsize = AtomicUsize::new(0);

    unsafe extern "system" fn fixture_proc(
        window: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        if message == WM_LBUTTONDOWN {
            CLICKS.fetch_add(1, Ordering::SeqCst);
        }
        if message == WM_PAINT {
            let mut paint = PAINTSTRUCT::default();
            let context = BeginPaint(window, &mut paint);
            FillRect(
                context,
                &paint.rcPaint,
                HBRUSH(GetStockObject(WHITE_BRUSH).0),
            );
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
            let previous = SelectObject(context, font.into());
            let text: Vec<u16> = "Reading independently".encode_utf16().collect();
            let _ = TextOutW(context, 30, 60, &text);
            SelectObject(context, previous);
            let _ = DeleteObject(font.into());
            let _ = EndPaint(window, &paint);
            return LRESULT(0);
        }
        DefWindowProcW(window, message, wparam, lparam)
    }

    #[test]
    #[ignore = "Uses a temporary desktop window and moves the pointer"]
    fn native_overlay_passes_clicks_without_taking_focus() {
        unsafe {
            let previous_focus = GetForegroundWindow();
            let mut previous_cursor = POINT::default();
            GetCursorPos(&mut previous_cursor).unwrap();
            let mut layers = Layers::new().unwrap();
            let instance: HINSTANCE = GetModuleHandleW(None).unwrap().into();
            let class = WNDCLASSW {
                lpfnWndProc: Some(fixture_proc),
                hInstance: instance,
                lpszClassName: w!("MorphemeFlow.OverlayTest"),
                hbrBackground: HBRUSH(GetStockObject(WHITE_BRUSH).0),
                ..Default::default()
            };
            RegisterClassW(&class);
            let fixture = CreateWindowExW(
                WS_EX_TOOLWINDOW,
                class.lpszClassName,
                w!("MorphemeFlow temporary overlay test"),
                WS_POPUP | WS_VISIBLE,
                100,
                100,
                600,
                500,
                None,
                None,
                Some(instance),
                None,
            )
            .unwrap();
            SetWindowPos(
                fixture,
                Some(HWND_TOPMOST),
                100,
                100,
                600,
                500,
                SWP_SHOWWINDOW,
            )
            .unwrap();
            let _ = SetForegroundWindow(fixture);
            let focus_before = GetForegroundWindow();
            SetCursorPos(300, 200).unwrap();
            let config = OverlaySettings {
                enabled: true,
                follow_pointer: false,
                tint_opacity: 15,
                ..Default::default()
            };
            layers.update(config, false).unwrap();
            let focus_preserved = GetForegroundWindow() == focus_before;
            let styles_valid = layers.windows.iter().all(|window| {
                let styles = GetWindowLongPtrW(*window, GWL_EXSTYLE) as u32;
                let required =
                    WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW;
                styles & required.0 == required.0
            });
            let excluded = layers.windows.iter().all(|window| {
                let mut affinity = 0;
                GetWindowDisplayAffinity(*window, &mut affinity).is_ok()
                    && affinity == WDA_EXCLUDEFROMCAPTURE.0
            });
            let _ = DwmFlush();
            let _ = UpdateWindow(fixture);
            let _ = DwmFlush();
            let recognized = crate::ocr::ocr_stable_region(120, 140, 560, 120);
            SetCursorPos(300, 420).unwrap();
            let mouse_input = |flags| INPUT {
                r#type: INPUT_MOUSE,
                Anonymous: INPUT_0 {
                    mi: MOUSEINPUT {
                        dwFlags: flags,
                        ..Default::default()
                    },
                },
            };
            let delivered = SendInput(
                &[
                    mouse_input(MOUSEEVENTF_LEFTDOWN),
                    mouse_input(MOUSEEVENTF_LEFTUP),
                ],
                std::mem::size_of::<INPUT>() as i32,
            );
            let deadline = std::time::Instant::now() + Duration::from_secs(2);
            while CLICKS.load(Ordering::SeqCst) == 0 && std::time::Instant::now() < deadline {
                MsgWaitForMultipleObjects(None, false, 100, QS_ALLINPUT);
                let mut message = MSG::default();
                while PeekMessageW(&mut message, None, 0, 0, PM_REMOVE).as_bool() {
                    let _ = TranslateMessage(&message);
                    DispatchMessageW(&message);
                }
            }
            layers.hide();
            let all_hidden = layers
                .windows
                .iter()
                .all(|window| !IsWindowVisible(*window).as_bool());
            let _ = DestroyWindow(fixture);
            let _ = SetForegroundWindow(previous_focus);
            let _ = SetCursorPos(previous_cursor.x, previous_cursor.y);
            assert!(focus_preserved, "Overlay took foreground focus");
            assert!(styles_valid, "Overlay input styles were not applied");
            assert!(excluded, "Overlay was not excluded from screen capture");
            assert_eq!(delivered, 2, "Windows did not accept test mouse input");
            assert_eq!(
                CLICKS.load(Ordering::SeqCst),
                1,
                "Click did not reach the underlying window"
            );
            assert!(all_hidden, "Turning off left an overlay visible");
            assert_eq!(
                recognized.unwrap().as_deref(),
                Some("Reading independently"),
                "OCR did not read the underlying content exactly"
            );
        }
    }
}
