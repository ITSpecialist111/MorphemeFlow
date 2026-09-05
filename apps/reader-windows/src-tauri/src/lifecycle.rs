#[derive(Default)]
pub struct ReaderLifecycle {
    closing: bool,
    capturing: bool,
}

impl ReaderLifecycle {
    pub fn begin_capture(&mut self) -> bool {
        if self.closing || self.capturing {
            return false;
        }
        self.capturing = true;
        true
    }

    pub fn finish_capture(&mut self) -> bool {
        self.capturing = false;
        self.closing
    }

    pub fn request_close(&mut self) -> bool {
        self.closing = true;
        !self.capturing
    }

    pub fn is_closing(&self) -> bool {
        self.closing
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn close_exits_immediately_when_capture_is_idle() {
        let mut state = ReaderLifecycle::default();
        assert!(state.request_close());
        assert!(state.is_closing());
        assert!(!state.begin_capture());
    }

    #[test]
    fn close_waits_for_clipboard_capture_to_finish() {
        let mut state = ReaderLifecycle::default();
        assert!(state.begin_capture());
        assert!(!state.request_close());
        assert!(!state.request_close());
        assert!(!state.begin_capture());
        assert!(state.finish_capture());
    }

    #[test]
    fn normal_capture_does_not_request_exit() {
        let mut state = ReaderLifecycle::default();
        assert!(state.begin_capture());
        assert!(!state.begin_capture());
        assert!(!state.finish_capture());
        assert!(state.begin_capture());
    }
}
