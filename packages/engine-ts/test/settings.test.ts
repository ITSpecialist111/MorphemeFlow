// MorphemeFlow — Settings Tests

import { describe, it, expect } from "vitest";
import { getDefaultSettings, getPreset, getEffectiveSettings } from "../src/settings";
import type { PresetName } from "../src/types";

describe("getDefaultSettings", () => {
  it("returns valid settings object", () => {
    const settings = getDefaultSettings();
    expect(settings.enabled).toBe(true);
    expect(settings.activePreset).toBe("balanced");
    expect(settings.features).toBeDefined();
    expect(settings.siteOverrides).toEqual({});
  });

  it("returns a deep copy each time", () => {
    const a = getDefaultSettings();
    const b = getDefaultSettings();
    a.features.morphemeHighlight.intensity = 999;
    expect(b.features.morphemeHighlight.intensity).not.toBe(999);
  });

  it("has all feature sections", () => {
    const { features } = getDefaultSettings();
    expect(features.morphemeHighlight).toBeDefined();
    expect(features.syllableSpacing).toBeDefined();
    expect(features.readingEnv).toBeDefined();
    expect(features.readingRuler).toBeDefined();
    expect(features.tts).toBeDefined();
  });
});

describe("getPreset", () => {
  const presets: PresetName[] = ["subtle", "balanced", "full", "custom"];

  for (const name of presets) {
    it(`returns valid features for "${name}" preset`, () => {
      const features = getPreset(name);
      expect(features.morphemeHighlight).toBeDefined();
      expect(features.syllableSpacing).toBeDefined();
      expect(features.readingEnv).toBeDefined();
    });
  }

  it("subtle has lower intensity than full", () => {
    const subtle = getPreset("subtle");
    const full = getPreset("full");
    expect(subtle.morphemeHighlight.intensity).toBeLessThan(full.morphemeHighlight.intensity);
    expect(subtle.syllableSpacing.intensity).toBeLessThan(full.syllableSpacing.intensity);
  });

  it("returns deep copies", () => {
    const a = getPreset("balanced");
    const b = getPreset("balanced");
    a.morphemeHighlight.intensity = 999;
    expect(b.morphemeHighlight.intensity).not.toBe(999);
  });
});

describe("getEffectiveSettings", () => {
  it("returns base features when no override exists", () => {
    const settings = getDefaultSettings();
    const effective = getEffectiveSettings(settings, "example.com");
    expect(effective).toEqual(settings.features);
  });

  it("merges site overrides", () => {
    const settings = getDefaultSettings();
    settings.siteOverrides["github.com"] = {
      morphemeHighlight: { ...settings.features.morphemeHighlight, enabled: false },
    };
    const effective = getEffectiveSettings(settings, "github.com");
    expect(effective.morphemeHighlight.enabled).toBe(false);
  });

  it("does not affect other sites", () => {
    const settings = getDefaultSettings();
    settings.siteOverrides["github.com"] = {
      morphemeHighlight: { ...settings.features.morphemeHighlight, enabled: false },
    };
    const effective = getEffectiveSettings(settings, "wikipedia.org");
    expect(effective.morphemeHighlight.enabled).toBe(true);
  });
});
