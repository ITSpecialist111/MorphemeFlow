// MorphemeFlow — Settings UI Logic
// Handles user interactions in the settings window and syncs with the overlay.

/**
 * Initialize settings UI with current values and wire up event handlers.
 */
function init(): void {
  // Slider value displays
  wireSlider("morpheme-intensity", (v) => `${v}%`);
  wireSlider("syllable-intensity", (v) => `${(Number(v) / 100).toFixed(2)}em`);
  wireSlider("ruler-height", (v) => `${v}px`);
  wireSlider("letter-spacing", (v) => `${(Number(v) / 100).toFixed(2)}em`);

  // Theme swatches
  document.querySelectorAll(".swatch").forEach((el) => {
    el.addEventListener("click", () => {
      document.querySelector(".swatch.active")?.classList.remove("active");
      el.classList.add("active");
      emitSettings();
    });
  });

  // Preset buttons
  document.querySelectorAll(".preset-btn").forEach((el) => {
    el.addEventListener("click", () => {
      document.querySelector(".preset-btn.active")?.classList.remove("active");
      el.classList.add("active");
      applyPreset((el as HTMLElement).dataset.preset ?? "balanced");
    });
  });

  // Any change triggers settings sync
  document.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("change", emitSettings);
    el.addEventListener("input", emitSettings);
  });
}

function wireSlider(id: string, format: (v: string) => string): void {
  const slider = document.getElementById(id) as HTMLInputElement;
  const display = document.getElementById(`${id}-value`);
  if (slider && display) {
    slider.addEventListener("input", () => {
      display.textContent = format(slider.value);
    });
  }
}

function applyPreset(preset: string): void {
  const presets: Record<string, Record<string, number | boolean | string>> = {
    subtle: {
      "morpheme-intensity": 30,
      "syllable-intensity": 4,
      "letter-spacing": 5,
      "ruler-height": 80,
    },
    balanced: {
      "morpheme-intensity": 60,
      "syllable-intensity": 8,
      "letter-spacing": 7,
      "ruler-height": 100,
    },
    full: {
      "morpheme-intensity": 100,
      "syllable-intensity": 14,
      "letter-spacing": 10,
      "ruler-height": 120,
    },
  };

  const values = presets[preset];
  if (!values) return;

  for (const [id, value] of Object.entries(values)) {
    const el = document.getElementById(id) as HTMLInputElement;
    if (el) {
      el.value = String(value);
      el.dispatchEvent(new Event("input"));
    }
  }

  emitSettings();
}

function collectSettings(): Record<string, unknown> {
  return {
    morphemeHighlight: (document.getElementById("morpheme-enabled") as HTMLInputElement)?.checked,
    syllableSpacing: (document.getElementById("syllable-enabled") as HTMLInputElement)?.checked,
    syllableIntensity: Number((document.getElementById("syllable-intensity") as HTMLInputElement)?.value ?? 8) / 100,
    prefixColor: (document.getElementById("prefix-color") as HTMLInputElement)?.value,
    rootColor: (document.getElementById("root-color") as HTMLInputElement)?.value,
    suffixColor: (document.getElementById("suffix-color") as HTMLInputElement)?.value,
    rootBold: true,
    rulerEnabled: (document.getElementById("ruler-enabled") as HTMLInputElement)?.checked,
    rulerHeight: Number((document.getElementById("ruler-height") as HTMLInputElement)?.value),
    font: (document.getElementById("font-select") as HTMLSelectElement)?.value,
    letterSpacing: Number((document.getElementById("letter-spacing") as HTMLInputElement)?.value) / 100,
    theme: document.querySelector(".swatch.active")?.getAttribute("data-theme") ?? "cream",
  };
}

function emitSettings(): void {
  const settings = collectSettings();

  // Send to overlay window via Tauri event system
  try {
    // @ts-expect-error — Tauri injects __TAURI__ at runtime
    window.__TAURI__?.event.emit("settings-updated", settings);
  } catch {
    // Not in Tauri context (development)
    console.log("Settings updated:", settings);
  }
}

document.addEventListener("DOMContentLoaded", init);
