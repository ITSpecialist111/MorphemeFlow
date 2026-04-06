mod overlay_window;
mod tracker;
mod uia;

use compositor::{CapturedFrame, DesktopDuplicator};
use log::{error, info, warn};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tracker::{AnchorTracker, OverlaySnapshot, SemanticRegion};

fn estimate_scroll_vector(frame: &CapturedFrame) -> Option<(f32, f32)> {
    if frame.move_rects.is_empty() {
        return None;
    }

    let mut weighted_dx = 0f64;
    let mut weighted_dy = 0f64;
    let mut total_weight = 0f64;

    for moved in &frame.move_rects {
        let dx = (moved.destination.left - moved.source_x) as f64;
        let dy = (moved.destination.top - moved.source_y) as f64;
        let width = (moved.destination.right - moved.destination.left).max(1) as f64;
        let height = (moved.destination.bottom - moved.destination.top).max(1) as f64;
        let weight = width * height;

        weighted_dx += dx * weight;
        weighted_dy += dy * weight;
        total_weight += weight;
    }

    if total_weight == 0.0 {
        None
    } else {
        Some(((weighted_dx / total_weight) as f32, (weighted_dy / total_weight) as f32))
    }
}

fn spawn_semantic_thread(tx: mpsc::Sender<Vec<SemanticRegion>>) {
    thread::spawn(move || loop {
        let regions = match uia::detect_visible_text_regions(220) {
            Ok(regions) => regions,
            Err(err) => {
                warn!("UIA semantic scan failed: {err}");
                Vec::new()
            }
        };

        if tx.send(regions).is_err() {
            break;
        }

        thread::sleep(Duration::from_millis(250));
    });
}

fn run_capture_pipeline(shared_snapshot: Arc<Mutex<OverlaySnapshot>>) {
    let mut duplicator = match DesktopDuplicator::new() {
        Ok(duplicator) => duplicator,
        Err(err) => {
            error!("failed to initialize desktop duplication: {err}");
            return;
        }
    };

    let (semantic_tx, semantic_rx) = mpsc::channel::<Vec<SemanticRegion>>();
    spawn_semantic_thread(semantic_tx);

    let mut tracker = AnchorTracker::new();
    let started_at = Instant::now();
    let mut frames_seen: u64 = 0;
    let mut last_semantic_count: usize = 0;

    loop {
        while let Ok(semantic_regions) = semantic_rx.try_recv() {
            last_semantic_count = semantic_regions.len();
            tracker.ingest_semantic_regions(semantic_regions);
        }

        match duplicator.acquire_next_frame(16) {
            Ok(Some(frame)) => {
                frames_seen += 1;
                tracker.apply_motion(&frame);

                if let Ok(mut shared) = shared_snapshot.lock() {
                    *shared = tracker.snapshot(120);
                }

                if frames_seen % 120 == 0 {
                    let scroll_hint = estimate_scroll_vector(&frame)
                        .map(|(dx, dy)| format!("{dx:.2},{dy:.2}"))
                        .unwrap_or_else(|| "none".to_string());
                    let readback_bytes: usize =
                        frame.dirty_readbacks.iter().map(|region| region.bytes.len()).sum();
                    let readback_kb = readback_bytes as f64 / 1024.0;
                    let visible = tracker.snapshot(120).items.len();

                    info!(
                        "captured={} visible_anchors={} semantic_regions={} move_rects={} dirty_rects={} readback_regions={} readback_kb={:.1} accum={} scroll_hint={} uptime={}s",
                        frames_seen,
                        visible,
                        last_semantic_count,
                        frame.move_rects.len(),
                        frame.dirty_rects.len(),
                        frame.dirty_readbacks.len(),
                        readback_kb,
                        frame.accumulated_frames,
                        scroll_hint,
                        started_at.elapsed().as_secs()
                    );
                }
            }
            Ok(None) => {
                thread::sleep(Duration::from_millis(1));
            }
            Err(err) => {
                warn!("capture loop error: {err}");
                thread::sleep(Duration::from_millis(10));
            }
        }
    }
}

fn main() {
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .init();

    info!("overlay-daemon starting");

    let shared_snapshot = Arc::new(Mutex::new(OverlaySnapshot::default()));
    let capture_shared = Arc::clone(&shared_snapshot);
    thread::spawn(move || run_capture_pipeline(capture_shared));

    if let Err(err) = overlay_window::run_overlay_window(shared_snapshot) {
        error!("overlay window failed: {err}");
        std::process::exit(1);
    }
}
