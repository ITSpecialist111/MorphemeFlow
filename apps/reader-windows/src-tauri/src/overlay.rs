use serde::{Deserialize, Serialize};

#[cfg(windows)]
#[path = "overlay_windows.rs"]
mod native;

#[cfg(windows)]
pub use native::OverlayController;

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", default, deny_unknown_fields)]
pub struct OverlaySettings {
    pub enabled: bool,
    pub band_height: u32,
    pub dim_opacity: u8,
    pub tint_opacity: u8,
    pub tint: Tint,
    pub follow_pointer: bool,
}

impl Default for OverlaySettings {
    fn default() -> Self {
        Self {
            enabled: false,
            band_height: 100,
            dim_opacity: 35,
            tint_opacity: 0,
            tint: Tint::Warm,
            follow_pointer: true,
        }
    }
}

impl OverlaySettings {
    pub fn validate(&self) -> Result<(), String> {
        if !(40..=320).contains(&self.band_height) {
            return Err("Focus band height must be between 40 and 320".to_string());
        }
        if self.dim_opacity > 70 || self.tint_opacity > 30 {
            return Err("Screen dimming cannot exceed 70%, or tint 30%".to_string());
        }
        Ok(())
    }
}

#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Tint {
    #[default]
    Warm,
    Rose,
    Mint,
    Sky,
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct ScreenRect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

pub fn focus_rects(bounds: ScreenRect, center_y: i32, height: u32) -> [ScreenRect; 3] {
    let band_height = i32::try_from(height)
        .unwrap_or(i32::MAX)
        .clamp(0, bounds.height.max(0));
    let band_y = center_y
        .saturating_sub(band_height / 2)
        .clamp(bounds.y, bounds.y + bounds.height - band_height);
    let band_bottom = band_y + band_height;
    [
        ScreenRect {
            height: band_y - bounds.y,
            ..bounds
        },
        ScreenRect {
            y: band_y,
            height: band_height,
            ..bounds
        },
        ScreenRect {
            y: band_bottom,
            height: bounds.y + bounds.height - band_bottom,
            ..bounds
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    const MONITOR: ScreenRect = ScreenRect {
        x: -1920,
        y: -240,
        width: 1920,
        height: 1080,
    };

    #[test]
    fn band_preserves_negative_monitor_origin() {
        let [top, band, bottom] = focus_rects(MONITOR, 200, 100);
        assert_eq!(
            top,
            ScreenRect {
                height: 390,
                ..MONITOR
            }
        );
        assert_eq!(
            band,
            ScreenRect {
                y: 150,
                height: 100,
                ..MONITOR
            }
        );
        assert_eq!(
            bottom,
            ScreenRect {
                y: 250,
                height: 590,
                ..MONITOR
            }
        );
    }

    #[test]
    fn band_stays_whole_at_both_display_edges() {
        let [top, band, _] = focus_rects(MONITOR, -240, 100);
        assert_eq!(top.height, 0);
        assert_eq!((band.y, band.height), (-240, 100));
        let [_, band, bottom] = focus_rects(MONITOR, 839, 100);
        assert_eq!((band.y, band.height), (740, 100));
        assert_eq!(bottom.height, 0);
    }

    #[test]
    fn oversized_band_cannot_cover_outside_monitor() {
        let [top, band, bottom] = focus_rects(MONITOR, 0, u32::MAX);
        assert_eq!(top.height, 0);
        assert_eq!(band, MONITOR);
        assert_eq!(bottom.height, 0);
    }

    #[test]
    fn regions_cover_display_without_gaps_or_overlap() {
        for center in [-10000, -240, 0, 500, 839, 10000] {
            for height in [40, 100, 150, 320, 1080, 2000] {
                let [top, band, bottom] = focus_rects(MONITOR, center, height);
                assert_eq!(top.y + top.height, band.y);
                assert_eq!(band.y + band.height, bottom.y);
                assert_eq!(bottom.y + bottom.height, MONITOR.y + MONITOR.height);
                assert_eq!(top.height + band.height + bottom.height, MONITOR.height);
                assert!(top.height >= 0 && bottom.height >= 0);
            }
        }
    }

    #[test]
    fn unsafe_settings_are_rejected() {
        assert!(OverlaySettings::default().validate().is_ok());
        for band_height in [0, 39, 321, u32::MAX] {
            assert!(OverlaySettings {
                band_height,
                ..Default::default()
            }
            .validate()
            .is_err());
        }
        assert!(OverlaySettings {
            dim_opacity: 71,
            ..Default::default()
        }
        .validate()
        .is_err());
        assert!(OverlaySettings {
            tint_opacity: 31,
            ..Default::default()
        }
        .validate()
        .is_err());
    }

    #[test]
    fn partial_saved_settings_use_safe_defaults() {
        let settings: OverlaySettings = serde_json::from_str(r#"{"bandHeight":160}"#).unwrap();
        assert_eq!(settings.band_height, 160);
        assert!(!settings.enabled);
        assert!(settings.validate().is_ok());
        assert!(serde_json::from_str::<OverlaySettings>(r#"{"tint":"unknown"}"#).is_err());
    }
}
