use compositor::{CapturedFrame, DirtyRegionReadback, FrameRect, MoveRect};
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct SemanticRegion {
    pub text: String,
    pub rect: FrameRect,
}

#[derive(Debug, Clone)]
pub struct OverlayItem {
    #[allow(dead_code)]
    pub text: String,
    pub rect: FrameRect,
    pub confidence: f32,
}

#[derive(Debug, Clone, Default)]
pub struct OverlaySnapshot {
    pub frame_index: u64,
    pub items: Vec<OverlayItem>,
}

#[derive(Debug, Clone)]
struct TrackedAnchor {
    id: u64,
    text: String,
    rect: FrameRect,
    confidence: f32,
    last_update_frame: u64,
    signature: Option<[u8; 8]>,
}

#[derive(Debug, Default)]
pub struct AnchorTracker {
    next_id: u64,
    frame_index: u64,
    anchors: HashMap<u64, TrackedAnchor>,
}

impl AnchorTracker {
    pub fn new() -> Self {
        Self {
            next_id: 1,
            frame_index: 0,
            anchors: HashMap::new(),
        }
    }

    pub fn ingest_semantic_regions(&mut self, regions: Vec<SemanticRegion>) {
        for region in regions {
            if region.text.trim().is_empty() {
                continue;
            }

            let matched_id = self.find_anchor_match(&region);
            if let Some(id) = matched_id {
                if let Some(anchor) = self.anchors.get_mut(&id) {
                    anchor.rect = region.rect;
                    anchor.text = region.text;
                    anchor.confidence = (anchor.confidence + 0.25).min(1.0);
                    anchor.last_update_frame = self.frame_index;
                }
            } else {
                let id = self.next_id;
                self.next_id += 1;
                self.anchors.insert(
                    id,
                    TrackedAnchor {
                        id,
                        text: region.text,
                        rect: region.rect,
                        confidence: 1.0,
                        last_update_frame: self.frame_index,
                        signature: None,
                    },
                );
            }
        }

        self.prune_stale();
    }

    pub fn apply_motion(&mut self, frame: &CapturedFrame) {
        self.frame_index += 1;

        for anchor in self.anchors.values_mut() {
            let mut moved = false;
            for moved_rect in &frame.move_rects {
                if anchor_is_in_move_source(anchor, moved_rect) {
                    let dx = moved_rect.destination.left - moved_rect.source_x;
                    let dy = moved_rect.destination.top - moved_rect.source_y;
                    anchor.rect = translate_rect(&anchor.rect, dx, dy);
                    anchor.confidence = (anchor.confidence + 0.03).min(1.0);
                    anchor.last_update_frame = self.frame_index;
                    moved = true;
                    break;
                }
            }

            if !moved {
                // Mild decay when no motion signal matched this anchor.
                anchor.confidence *= 0.9992;
            }

            if intersects_any(&anchor.rect, &frame.dirty_rects) {
                anchor.confidence = (anchor.confidence - 0.002).max(0.0);
            }

            if let Some(signature) = sample_anchor_signature(anchor, &frame.dirty_readbacks) {
                match anchor.signature {
                    Some(previous) => {
                        let distance = signature_distance(&previous, &signature);
                        if distance <= 20 {
                            anchor.confidence = (anchor.confidence + 0.015).min(1.0);
                        } else {
                            anchor.confidence = (anchor.confidence - 0.005).max(0.0);
                        }
                    }
                    None => {
                        anchor.confidence = (anchor.confidence + 0.01).min(1.0);
                    }
                }
                anchor.signature = Some(signature);
            }
        }

        self.prune_stale();
    }

    pub fn snapshot(&self, max_items: usize) -> OverlaySnapshot {
        let mut items: Vec<OverlayItem> = self
            .anchors
            .values()
            .filter(|anchor| anchor.confidence >= 0.12)
            .filter(|anchor| rect_area(&anchor.rect) >= 900)
            .map(|anchor| OverlayItem {
                text: anchor.text.clone(),
                rect: anchor.rect.clone(),
                confidence: anchor.confidence,
            })
            .collect();

        items.sort_by(|a, b| b.confidence.total_cmp(&a.confidence));
        items.truncate(max_items);

        OverlaySnapshot {
            frame_index: self.frame_index,
            items,
        }
    }

    fn find_anchor_match(&self, region: &SemanticRegion) -> Option<u64> {
        let mut best_id: Option<u64> = None;
        let mut best_score = 0.0f32;

        for anchor in self.anchors.values() {
            if !text_roughly_matches(&anchor.text, &region.text) {
                continue;
            }

            let overlap = iou(&anchor.rect, &region.rect);
            let distance = center_distance(&anchor.rect, &region.rect);
            let proximity_score = (1.0 - (distance / 250.0).min(1.0)).max(0.0);
            let score = overlap * 0.7 + proximity_score * 0.3;

            if score > best_score && score > 0.22 {
                best_score = score;
                best_id = Some(anchor.id);
            }
        }

        best_id
    }

    fn prune_stale(&mut self) {
        let frame_index = self.frame_index;
        self.anchors.retain(|_, anchor| {
            let stale_for = frame_index.saturating_sub(anchor.last_update_frame);
            anchor.confidence > 0.04 && stale_for < 1800
        });
    }
}

fn anchor_is_in_move_source(anchor: &TrackedAnchor, moved_rect: &MoveRect) -> bool {
    let (cx, cy) = rect_center(&anchor.rect);
    let source_width = moved_rect.destination.right - moved_rect.destination.left;
    let source_height = moved_rect.destination.bottom - moved_rect.destination.top;

    let source = FrameRect {
        left: moved_rect.source_x,
        top: moved_rect.source_y,
        right: moved_rect.source_x + source_width,
        bottom: moved_rect.source_y + source_height,
    };

    point_in_rect(cx, cy, &source)
}

fn sample_anchor_signature(
    anchor: &TrackedAnchor,
    dirty_readbacks: &[DirtyRegionReadback],
) -> Option<[u8; 8]> {
    let (cx, cy) = rect_center(&anchor.rect);
    let readback = dirty_readbacks.iter().find(|region| {
        point_in_rect(cx, cy, &region.rect) && !region.bytes.is_empty() && region.row_pitch > 0
    })?;

    Some(compute_signature(
        &readback.bytes,
        readback.row_pitch,
        rect_width(&readback.rect) as usize,
        rect_height(&readback.rect) as usize,
    ))
}

fn compute_signature(bytes: &[u8], row_pitch: usize, width: usize, height: usize) -> [u8; 8] {
    let mut bins = [0u32; 8];
    if width == 0 || height == 0 || row_pitch == 0 {
        return [0u8; 8];
    }

    let sample_step_x = (width / 48).max(1);
    let sample_step_y = (height / 48).max(1);

    for y in (0..height).step_by(sample_step_y) {
        let row_offset = y * row_pitch;
        for x in (0..width).step_by(sample_step_x) {
            let pixel_offset = row_offset + x * 4;
            if pixel_offset + 2 >= bytes.len() {
                continue;
            }

            // Input is BGRA/RGBA-family; this luminance approximation is robust for both.
            let b = bytes[pixel_offset] as u32;
            let g = bytes[pixel_offset + 1] as u32;
            let r = bytes[pixel_offset + 2] as u32;
            let luma = ((r * 77) + (g * 150) + (b * 29)) >> 8;
            let bin = ((luma as usize) * bins.len()) / 256;
            bins[bin.min(bins.len() - 1)] += 1;
        }
    }

    let total: u32 = bins.iter().sum();
    if total == 0 {
        return [0u8; 8];
    }

    let mut normalized = [0u8; 8];
    for (i, value) in bins.iter().enumerate() {
        normalized[i] = ((value * 255) / total) as u8;
    }

    normalized
}

fn signature_distance(a: &[u8; 8], b: &[u8; 8]) -> u32 {
    a.iter()
        .zip(b.iter())
        .map(|(av, bv)| av.abs_diff(*bv) as u32)
        .sum()
}

fn text_roughly_matches(a: &str, b: &str) -> bool {
    let a = a.trim().to_lowercase();
    let b = b.trim().to_lowercase();
    if a == b {
        return true;
    }

    if a.len() >= 6 && b.len() >= 6 && (a.contains(&b) || b.contains(&a)) {
        return true;
    }

    false
}

fn iou(a: &FrameRect, b: &FrameRect) -> f32 {
    let left = a.left.max(b.left);
    let top = a.top.max(b.top);
    let right = a.right.min(b.right);
    let bottom = a.bottom.min(b.bottom);

    let intersection_w = (right - left).max(0) as f32;
    let intersection_h = (bottom - top).max(0) as f32;
    let intersection = intersection_w * intersection_h;
    if intersection <= 0.0 {
        return 0.0;
    }

    let area_a = (rect_width(a) * rect_height(a)) as f32;
    let area_b = (rect_width(b) * rect_height(b)) as f32;
    let union = area_a + area_b - intersection;
    if union <= 0.0 {
        0.0
    } else {
        intersection / union
    }
}

fn center_distance(a: &FrameRect, b: &FrameRect) -> f32 {
    let (ax, ay) = rect_center(a);
    let (bx, by) = rect_center(b);
    let dx = (ax - bx) as f32;
    let dy = (ay - by) as f32;
    (dx * dx + dy * dy).sqrt()
}

fn translate_rect(rect: &FrameRect, dx: i32, dy: i32) -> FrameRect {
    FrameRect {
        left: rect.left + dx,
        top: rect.top + dy,
        right: rect.right + dx,
        bottom: rect.bottom + dy,
    }
}

fn intersects_any(target: &FrameRect, rects: &[FrameRect]) -> bool {
    rects.iter().any(|rect| {
        target.left < rect.right
            && target.right > rect.left
            && target.top < rect.bottom
            && target.bottom > rect.top
    })
}

fn point_in_rect(x: i32, y: i32, rect: &FrameRect) -> bool {
    x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom
}

fn rect_center(rect: &FrameRect) -> (i32, i32) {
    ((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2)
}

fn rect_width(rect: &FrameRect) -> i32 {
    (rect.right - rect.left).max(0)
}

fn rect_height(rect: &FrameRect) -> i32 {
    (rect.bottom - rect.top).max(0)
}

fn rect_area(rect: &FrameRect) -> i32 {
    rect_width(rect) * rect_height(rect)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn move_rect_translates_anchor() {
        let mut tracker = AnchorTracker::new();
        tracker.ingest_semantic_regions(vec![SemanticRegion {
            text: "example".to_string(),
            rect: FrameRect {
                left: 100,
                top: 200,
                right: 220,
                bottom: 240,
            },
        }]);

        let frame = CapturedFrame {
            width: 1920,
            height: 1080,
            format: windows::Win32::Graphics::Dxgi::Common::DXGI_FORMAT_B8G8R8A8_UNORM,
            last_present_time: 1,
            accumulated_frames: 1,
            move_rects: vec![MoveRect {
                source_x: 0,
                source_y: 160,
                destination: FrameRect {
                    left: 0,
                    top: 140,
                    right: 1920,
                    bottom: 1060,
                },
            }],
            dirty_rects: Vec::new(),
            dirty_readbacks: Vec::new(),
        };

        tracker.apply_motion(&frame);
        let snapshot = tracker.snapshot(10);
        assert_eq!(snapshot.items.len(), 1);
        assert_eq!(snapshot.items[0].rect.top, 180);
        assert_eq!(snapshot.items[0].rect.bottom, 220);
    }

    #[test]
    fn signature_computation_is_stable_for_constant_block() {
        let width = 16usize;
        let height = 16usize;
        let row_pitch = width * 4;
        let bytes = vec![200u8; row_pitch * height];

        let a = compute_signature(&bytes, row_pitch, width, height);
        let b = compute_signature(&bytes, row_pitch, width, height);
        assert_eq!(a, b);
        assert_eq!(signature_distance(&a, &b), 0);
    }
}
