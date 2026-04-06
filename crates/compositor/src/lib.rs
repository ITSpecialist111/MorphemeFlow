use windows::core::*;
use windows::Win32::Foundation::{E_FAIL, RECT};
use windows::Win32::Graphics::Direct3D::*;
use windows::Win32::Graphics::Direct3D11::*;
use windows::Win32::Graphics::Dxgi::*;
use windows::Win32::Graphics::Dxgi::Common::{
    DXGI_FORMAT, DXGI_FORMAT_B8G8R8A8_UNORM, DXGI_FORMAT_B8G8R8A8_UNORM_SRGB,
    DXGI_FORMAT_R8G8B8A8_UNORM, DXGI_FORMAT_R8G8B8A8_UNORM_SRGB,
};

pub fn initialize_d3d11() -> Result<(ID3D11Device, ID3D11DeviceContext)> {
    let mut device: Option<ID3D11Device> = None;
    let mut context: Option<ID3D11DeviceContext> = None;
    
    let feature_levels = [D3D_FEATURE_LEVEL_11_1, D3D_FEATURE_LEVEL_11_0];
    
    unsafe {
        D3D11CreateDevice(
            None,
            D3D_DRIVER_TYPE_HARDWARE,
            None,
            D3D11_CREATE_DEVICE_BGRA_SUPPORT,
            Some(&feature_levels),
            D3D11_SDK_VERSION,
            Some(&mut device),
            None,
            Some(&mut context),
        )?;
    }
    
    Ok((device.unwrap(), context.unwrap()))
}

pub fn start_desktop_duplication(device: &ID3D11Device) -> Result<IDXGIOutputDuplication> {
    unsafe {
        let dxgi_device: IDXGIDevice = device.cast()?;
        let adapter = dxgi_device.GetAdapter()?;
        let output = adapter.EnumOutputs(0)?;
        let output1: IDXGIOutput1 = output.cast()?;

        output1.DuplicateOutput(device)
    }
}

#[derive(Debug, Clone)]
pub struct CapturedFrame {
    pub width: u32,
    pub height: u32,
    pub format: DXGI_FORMAT,
    pub last_present_time: i64,
    pub accumulated_frames: u32,
    pub move_rects: Vec<MoveRect>,
    pub dirty_rects: Vec<FrameRect>,
    pub dirty_readbacks: Vec<DirtyRegionReadback>,
}

#[derive(Debug, Clone)]
pub struct FrameRect {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

impl FrameRect {
    fn from_win32(rect: RECT) -> Self {
        Self {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
        }
    }

    fn sanitize(self, width: u32, height: u32) -> Option<Self> {
        let width = width as i32;
        let height = height as i32;

        let left = self.left.clamp(0, width);
        let top = self.top.clamp(0, height);
        let right = self.right.clamp(0, width);
        let bottom = self.bottom.clamp(0, height);

        if right <= left || bottom <= top {
            None
        } else {
            Some(Self {
                left,
                top,
                right,
                bottom,
            })
        }
    }

    fn width(&self) -> usize {
        (self.right - self.left).max(0) as usize
    }

    fn height(&self) -> usize {
        (self.bottom - self.top).max(0) as usize
    }
}

#[derive(Debug, Clone)]
pub struct DirtyRegionReadback {
    pub rect: FrameRect,
    pub row_pitch: usize,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct MoveRect {
    pub source_x: i32,
    pub source_y: i32,
    pub destination: FrameRect,
}

impl MoveRect {
    fn from_win32(rect: DXGI_OUTDUPL_MOVE_RECT) -> Self {
        Self {
            source_x: rect.SourcePoint.x,
            source_y: rect.SourcePoint.y,
            destination: FrameRect::from_win32(rect.DestinationRect),
        }
    }
}

pub struct DesktopDuplicator {
    device: ID3D11Device,
    context: ID3D11DeviceContext,
    duplication: IDXGIOutputDuplication,
    staging_texture: Option<ID3D11Texture2D>,
    staging_desc: Option<D3D11_TEXTURE2D_DESC>,
}

impl DesktopDuplicator {
    pub fn new() -> Result<Self> {
        let (device, context) = initialize_d3d11()?;
        let duplication = start_desktop_duplication(&device)?;

        Ok(Self {
            device,
            context,
            duplication,
            staging_texture: None,
            staging_desc: None,
        })
    }

    pub fn acquire_next_frame(&mut self, timeout_ms: u32) -> Result<Option<CapturedFrame>> {
        unsafe {
            let mut frame_info = DXGI_OUTDUPL_FRAME_INFO::default();
            let mut frame_resource: Option<IDXGIResource> = None;

            match self
                .duplication
                .AcquireNextFrame(timeout_ms, &mut frame_info, &mut frame_resource)
            {
                Ok(_) => {}
                Err(err) if err.code() == DXGI_ERROR_WAIT_TIMEOUT => return Ok(None),
                Err(err) => return Err(err),
            }

            let release_result = (|| -> Result<CapturedFrame> {
                let resource = frame_resource.ok_or_else(|| {
                    Error::new(
                        E_FAIL,
                        "Desktop duplication returned an empty frame resource",
                    )
                })?;

                let texture: ID3D11Texture2D = resource.cast()?;
                let mut desc = D3D11_TEXTURE2D_DESC::default();
                texture.GetDesc(&mut desc);
                let (move_rects, dirty_rects) = self.read_frame_metadata(&frame_info)?;
                let dirty_readbacks = self.read_dirty_region_pixels(&texture, &desc, &dirty_rects)?;

                Ok(CapturedFrame {
                    width: desc.Width,
                    height: desc.Height,
                    format: desc.Format,
                    last_present_time: frame_info.LastPresentTime,
                    accumulated_frames: frame_info.AccumulatedFrames,
                    move_rects,
                    dirty_rects,
                    dirty_readbacks,
                })
            })();

            self.duplication.ReleaseFrame()?;
            release_result.map(Some)
        }
    }

    fn read_frame_metadata(
        &self,
        frame_info: &DXGI_OUTDUPL_FRAME_INFO,
    ) -> Result<(Vec<MoveRect>, Vec<FrameRect>)> {
        if frame_info.TotalMetadataBufferSize == 0 {
            return Ok((Vec::new(), Vec::new()));
        }

        unsafe {
            let total_metadata_bytes = frame_info.TotalMetadataBufferSize as usize;
            let move_rect_size = std::mem::size_of::<DXGI_OUTDUPL_MOVE_RECT>();
            let move_capacity = total_metadata_bytes.div_ceil(move_rect_size);
            let mut move_buffer = vec![DXGI_OUTDUPL_MOVE_RECT::default(); move_capacity];
            let mut move_bytes_written: u32 = 0;

            self.duplication.GetFrameMoveRects(
                frame_info.TotalMetadataBufferSize,
                move_buffer.as_mut_ptr(),
                &mut move_bytes_written,
            )?;

            let move_rect_count = (move_bytes_written as usize) / move_rect_size;
            move_buffer.truncate(move_rect_count);
            let move_rects = move_buffer
                .iter()
                .copied()
                .map(MoveRect::from_win32)
                .collect();

            let dirty_metadata_bytes = total_metadata_bytes.saturating_sub(move_bytes_written as usize);
            let mut dirty_bytes_written: u32 = 0;
            let mut dirty_buffer = Vec::<RECT>::new();
            if dirty_metadata_bytes > 0 {
                let dirty_rect_size = std::mem::size_of::<RECT>();
                let dirty_capacity = dirty_metadata_bytes.div_ceil(dirty_rect_size);
                dirty_buffer = vec![RECT::default(); dirty_capacity];

                self.duplication.GetFrameDirtyRects(
                    dirty_metadata_bytes as u32,
                    dirty_buffer.as_mut_ptr(),
                    &mut dirty_bytes_written,
                )?;
            }

            let dirty_rect_size = std::mem::size_of::<RECT>();
            let dirty_rect_count = (dirty_bytes_written as usize) / dirty_rect_size;
            dirty_buffer.truncate(dirty_rect_count);
            let dirty_rects = dirty_buffer
                .iter()
                .copied()
                .map(FrameRect::from_win32)
                .collect();

            Ok((move_rects, dirty_rects))
        }
    }

    fn read_dirty_region_pixels(
        &mut self,
        source_texture: &ID3D11Texture2D,
        texture_desc: &D3D11_TEXTURE2D_DESC,
        dirty_rects: &[FrameRect],
    ) -> Result<Vec<DirtyRegionReadback>> {
        if dirty_rects.is_empty() {
            return Ok(Vec::new());
        }

        let bytes_per_pixel = bytes_per_pixel_for_format(texture_desc.Format)?;
        let sanitized_rects: Vec<FrameRect> = dirty_rects
            .iter()
            .cloned()
            .filter_map(|rect| rect.sanitize(texture_desc.Width, texture_desc.Height))
            .collect();

        if sanitized_rects.is_empty() {
            return Ok(Vec::new());
        }

        let staging_texture = self.ensure_staging_texture(texture_desc)?.clone();
        let source_resource: ID3D11Resource = source_texture.cast()?;
        let staging_resource: ID3D11Resource = staging_texture.cast()?;

        unsafe {
            for rect in &sanitized_rects {
                let src_box = D3D11_BOX {
                    left: rect.left as u32,
                    top: rect.top as u32,
                    front: 0,
                    right: rect.right as u32,
                    bottom: rect.bottom as u32,
                    back: 1,
                };

                self.context.CopySubresourceRegion(
                    &staging_resource,
                    0,
                    rect.left as u32,
                    rect.top as u32,
                    0,
                    &source_resource,
                    0,
                    Some(&src_box as *const D3D11_BOX),
                );
            }

            let mut mapped = D3D11_MAPPED_SUBRESOURCE::default();
            self.context.Map(
                &staging_resource,
                0,
                D3D11_MAP_READ,
                0,
                Some(&mut mapped as *mut D3D11_MAPPED_SUBRESOURCE),
            )?;

            let map_result = (|| -> Result<Vec<DirtyRegionReadback>> {
                let mapped_ptr = mapped.pData as *const u8;
                if mapped_ptr.is_null() {
                    return Err(Error::new(E_FAIL, "Mapped staging texture returned null data"));
                }

                let full_row_pitch = mapped.RowPitch as usize;
                let mut readbacks = Vec::with_capacity(sanitized_rects.len());

                for rect in sanitized_rects {
                    let region_row_bytes = rect.width() * bytes_per_pixel;
                    let region_height = rect.height();
                    let mut bytes = vec![0u8; region_row_bytes * region_height];

                    for row in 0..region_height {
                        let source_offset = ((rect.top as usize + row) * full_row_pitch)
                            + (rect.left as usize * bytes_per_pixel);
                        let source_ptr = mapped_ptr.add(source_offset);
                        let target_offset = row * region_row_bytes;
                        let target_ptr = bytes.as_mut_ptr().add(target_offset);

                        std::ptr::copy_nonoverlapping(source_ptr, target_ptr, region_row_bytes);
                    }

                    readbacks.push(DirtyRegionReadback {
                        rect,
                        row_pitch: region_row_bytes,
                        bytes,
                    });
                }

                Ok(readbacks)
            })();

            self.context.Unmap(&staging_resource, 0);
            map_result
        }
    }

    fn ensure_staging_texture(
        &mut self,
        source_desc: &D3D11_TEXTURE2D_DESC,
    ) -> Result<&ID3D11Texture2D> {
        let needs_new_texture = match self.staging_desc {
            Some(desc) => {
                desc.Width != source_desc.Width
                    || desc.Height != source_desc.Height
                    || desc.Format != source_desc.Format
            }
            None => true,
        };

        if needs_new_texture {
            let mut staging_desc = *source_desc;
            staging_desc.MipLevels = 1;
            staging_desc.ArraySize = 1;
            staging_desc.Usage = D3D11_USAGE_STAGING;
            staging_desc.BindFlags = 0;
            staging_desc.CPUAccessFlags = D3D11_CPU_ACCESS_READ.0 as u32;
            staging_desc.MiscFlags = 0;

            let mut staging_texture: Option<ID3D11Texture2D> = None;
            unsafe {
                self.device
                    .CreateTexture2D(&staging_desc, None, Some(&mut staging_texture))?;
            }

            self.staging_texture = staging_texture;
            self.staging_desc = Some(staging_desc);
        }

        self.staging_texture.as_ref().ok_or_else(|| {
            Error::new(
                E_FAIL,
                "Failed to initialize staging texture for dirty region readback",
            )
        })
    }
}

fn bytes_per_pixel_for_format(format: DXGI_FORMAT) -> Result<usize> {
    match format {
        DXGI_FORMAT_B8G8R8A8_UNORM
        | DXGI_FORMAT_B8G8R8A8_UNORM_SRGB
        | DXGI_FORMAT_R8G8B8A8_UNORM
        | DXGI_FORMAT_R8G8B8A8_UNORM_SRGB => Ok(4),
        other => Err(Error::new(
            E_FAIL,
            format!("Unsupported frame format for readback: {:?}", other),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_rect_clamps_to_texture_bounds() {
        let rect = FrameRect {
            left: -20,
            top: 10,
            right: 220,
            bottom: 150,
        };

        let sanitized = rect.sanitize(200, 100).expect("rect should be clamped");
        assert_eq!(sanitized.left, 0);
        assert_eq!(sanitized.top, 10);
        assert_eq!(sanitized.right, 200);
        assert_eq!(sanitized.bottom, 100);
    }

    #[test]
    fn bytes_per_pixel_supports_common_8bit_rgba_formats() {
        assert_eq!(bytes_per_pixel_for_format(DXGI_FORMAT_B8G8R8A8_UNORM).unwrap(), 4);
        assert_eq!(bytes_per_pixel_for_format(DXGI_FORMAT_B8G8R8A8_UNORM_SRGB).unwrap(), 4);
        assert_eq!(bytes_per_pixel_for_format(DXGI_FORMAT_R8G8B8A8_UNORM).unwrap(), 4);
        assert_eq!(bytes_per_pixel_for_format(DXGI_FORMAT_R8G8B8A8_UNORM_SRGB).unwrap(), 4);
    }
}
