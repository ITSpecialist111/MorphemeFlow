// MorphemeFlow Reader — OCR screen capture (Windows)
//
// Uses BitBlt for screen capture and Windows.Media.Ocr for text recognition.

#![allow(non_snake_case)]

#[cfg(windows)]
use windows::{
    Graphics::Imaging::{BitmapPixelFormat, SoftwareBitmap},
    Media::Ocr::OcrEngine,
    Win32::Graphics::Gdi::*,
};

#[cfg(windows)]
use windows_core::Interface;

/// Capture a screen region and run OCR on it.
#[cfg(windows)]
pub fn ocr_region(x: i32, y: i32, width: i32, height: i32) -> Result<String, String> {
    if width <= 0 || height <= 0 {
        return Err("OCR region must have a positive width and height".to_string());
    }
    let max_dimension = max_image_dimension() as i32;
    if width > max_dimension || height > max_dimension {
        return Err(format!(
            "OCR region is too large ({width}×{height}). Select a region no larger than {max_dimension}×{max_dimension} pixels."
        ));
    }

    unsafe {
        let pixels = capture_screen_rect(x, y, width, height)?;
        let bitmap = create_software_bitmap(&pixels, width, height)?;
        run_ocr(bitmap)
    }
}

#[cfg(windows)]
pub fn max_image_dimension() -> u32 {
    OcrEngine::MaxImageDimension().unwrap_or(2600)
}

#[cfg(windows)]
pub fn ocr_stable_region(
    x: i32,
    y: i32,
    width: i32,
    height: i32,
) -> Result<Option<String>, String> {
    if width <= 0
        || height <= 0
        || width as u32 > max_image_dimension()
        || height as u32 > max_image_dimension()
    {
        return Err("Invalid reading lens capture dimensions".to_string());
    }
    unsafe {
        let before = capture_screen_rect(x, y, width, height)?;
        let bitmap = create_software_bitmap(&before, width, height)?;
        let text = run_ocr(bitmap)?;
        let after = capture_screen_rect(x, y, width, height)?;
        Ok((before == after).then_some(text))
    }
}

#[cfg(not(windows))]
pub fn max_image_dimension() -> u32 {
    2600
}

#[cfg(windows)]
unsafe fn capture_screen_rect(x: i32, y: i32, w: i32, h: i32) -> Result<Vec<u8>, String> {
    let hdc_screen = GetDC(None);
    if hdc_screen.is_invalid() {
        return Err("Failed to get screen DC".to_string());
    }

    let cleanup = |hdc: HDC| {
        ReleaseDC(None, hdc);
    };

    let hdc_mem = CreateCompatibleDC(Some(hdc_screen));
    if hdc_mem.is_invalid() {
        cleanup(hdc_screen);
        return Err("Failed to create compatible DC".to_string());
    }

    let hbitmap = CreateCompatibleBitmap(hdc_screen, w, h);
    if hbitmap.is_invalid() {
        let _ = DeleteDC(hdc_mem);
        cleanup(hdc_screen);
        return Err("Failed to create bitmap".to_string());
    }

    let old = SelectObject(hdc_mem, hbitmap.into());
    let blt_result = BitBlt(
        hdc_mem,
        0,
        0,
        w,
        h,
        Some(hdc_screen),
        x,
        y,
        SRCCOPY | CAPTUREBLT,
    );
    SelectObject(hdc_mem, old);

    if blt_result.is_err() {
        let _ = DeleteObject(hbitmap.into());
        let _ = DeleteDC(hdc_mem);
        cleanup(hdc_screen);
        return Err("BitBlt failed".to_string());
    }

    let mut bmi = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: w,
            biHeight: -h, // top-down
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            biSizeImage: 0,
            biXPelsPerMeter: 0,
            biYPelsPerMeter: 0,
            biClrUsed: 0,
            biClrImportant: 0,
        },
        bmiColors: [RGBQUAD::default()],
    };

    let buf_size = w
        .checked_mul(h)
        .and_then(|pixels| pixels.checked_mul(4))
        .and_then(|bytes| usize::try_from(bytes).ok())
        .ok_or_else(|| "OCR region is too large to allocate safely".to_string())?;
    let mut pixels = vec![0u8; buf_size];

    let scan_lines = GetDIBits(
        hdc_mem,
        hbitmap,
        0,
        h as u32,
        Some(pixels.as_mut_ptr() as *mut _),
        &mut bmi,
        DIB_RGB_COLORS,
    );

    let _ = DeleteObject(hbitmap.into());
    let _ = DeleteDC(hdc_mem);
    cleanup(hdc_screen);

    if scan_lines == 0 {
        return Err("Failed to read pixels from the selected screen region".to_string());
    }

    Ok(pixels)
}

#[cfg(windows)]
#[windows_core::interface("5b0d3235-4dba-4d44-865e-8f1d0e4fd04d")]
unsafe trait IMemoryBufferByteAccess: windows_core::IUnknown {
    unsafe fn GetBuffer(&self, value: *mut *mut u8, capacity: *mut u32) -> windows_core::HRESULT;
}

#[cfg(windows)]
unsafe fn create_software_bitmap(
    pixels: &[u8],
    width: i32,
    height: i32,
) -> Result<SoftwareBitmap, String> {
    let bitmap = SoftwareBitmap::Create(BitmapPixelFormat::Bgra8, width, height)
        .map_err(|e| format!("SoftwareBitmap::Create failed: {}", e))?;

    let buffer = bitmap
        .LockBuffer(windows::Graphics::Imaging::BitmapBufferAccessMode::Write)
        .map_err(|e| format!("LockBuffer failed: {}", e))?;

    let reference = buffer
        .CreateReference()
        .map_err(|e| format!("CreateReference failed: {}", e))?;

    let byte_access: IMemoryBufferByteAccess = reference
        .cast()
        .map_err(|e| format!("Cast to IMemoryBufferByteAccess failed: {}", e))?;

    let mut data_ptr: *mut u8 = std::ptr::null_mut();
    let mut capacity: u32 = 0;
    byte_access
        .GetBuffer(&mut data_ptr, &mut capacity)
        .ok()
        .map_err(|e| format!("GetBuffer failed: {}", e))?;

    let copy_len = pixels.len().min(capacity as usize);
    std::ptr::copy_nonoverlapping(pixels.as_ptr(), data_ptr, copy_len);

    drop(reference);
    drop(buffer);

    Ok(bitmap)
}

#[cfg(windows)]
unsafe fn run_ocr(bitmap: SoftwareBitmap) -> Result<String, String> {
    let engine = OcrEngine::TryCreateFromUserProfileLanguages()
        .map_err(|e| format!("OCR engine creation failed: {}", e))?;

    let result = engine
        .RecognizeAsync(&bitmap)
        .map_err(|e| format!("RecognizeAsync failed: {}", e))?
        .get()
        .map_err(|e| format!("OCR recognition failed: {}", e))?;

    let text = result
        .Text()
        .map_err(|e| format!("Failed to get OCR text: {}", e))?;

    Ok(text.to_string())
}

#[cfg(not(windows))]
pub fn ocr_region(_x: i32, _y: i32, _width: i32, _height: i32) -> Result<String, String> {
    Err("OCR is only supported on Windows".to_string())
}
