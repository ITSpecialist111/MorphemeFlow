mod overlay_window;
mod tracker;
mod uia;

use compositor::{CapturedFrame, DesktopDuplicator};
use log::{error, info, warn};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tracker::{AnchorTracker, OverlaySnapshot, SemanticRegion};

#[derive(Debug)]
struct SemanticScan {
    window_id: isize,
    regions: Vec<SemanticRegion>,
}

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

fn spawn_semantic_thread(tx: mpsc::Sender<SemanticScan>) {
    thread::spawn(move || loop {
        let scan = match uia::detect_visible_text_regions_with_window(220) {
            Ok((window_id, regions)) => SemanticScan { window_id, regions },
            Err(err) => {
                warn!("UIA semantic scan failed: {err}");
                SemanticScan {
                    window_id: 0,
                    regions: Vec::new(),
                }
            }
        };

        if tx.send(scan).is_err() {
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

    let (semantic_tx, semantic_rx) = mpsc::channel::<SemanticScan>();
    spawn_semantic_thread(semantic_tx);

    let mut tracker = AnchorTracker::new();
    let mut active_window_id: isize = 0;
    let started_at = Instant::now();
    let mut frames_seen: u64 = 0;
    let mut last_semantic_count: usize = 0;

    loop {
        while let Ok(scan) = semantic_rx.try_recv() {
            if active_window_id != 0 && scan.window_id != 0 && scan.window_id != active_window_id {
                info!("foreground window changed ({} -> {}), resetting tracker", active_window_id, scan.window_id);
                tracker.reset();
            }

            if scan.window_id != 0 {
                active_window_id = scan.window_id;
            }

            last_semantic_count = scan.regions.len();
            tracker.ingest_semantic_regions(scan.regions);
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
