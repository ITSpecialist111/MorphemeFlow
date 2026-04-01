// MorphemeFlow — Overlay Renderer
// Draws morpheme-styled text on a transparent canvas overlay,
// covering original text with highlighted morpheme breakdowns.

import { tokenize, analyzeWord, WordCache } from "../../engine/src/index";
import type { Morpheme } from "../../engine/src/index";

// Colors for morpheme types (on light background)
const MORPHEME_COLORS: Record<Morpheme["type"], string> = {
  prefix: "#7C3AED",     // violet-600
  root: "#1E293B",       // slate-800
  suffix: "#059669",     // emerald-600
  inflection: "#6366F1", // indigo-500
};

interface TextRegion {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  font_size: number;
  source: "Accessibility" | "Ocr";
}

// Shared word cache
const cache = new WordCache(10_000);

// State
let enabled = false;
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let scanInterval: ReturnType<typeof setInterval> | null = null;

// Settings
let settings = {
  morphemeHighlight: true,
  syllableSpacing: true,
  syllableIntensity: 0.06,
  prefixColor: "#7C3AED",
  rootColor: "#1E293B",
  suffixColor: "#059669",
  rootBold: true,
  bgColor: "#FFFBF0",  // warm cream background to cover original text
  bgOpacity: 0.95,
};

function init(): void {
  canvas = document.getElementById("overlay-canvas") as HTMLCanvasElement;
  ctx = canvas.getContext("2d")!;

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  setupTauriListeners();

  // Start scanning immediately — the window starts HIDDEN (tauri.conf.json visible:false)
  // so nothing is visible until user presses Ctrl+Shift+M to toggle
  startScanning();
}

function resizeCanvas(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
  ctx.scale(dpr, dpr);
}

function setupTauriListeners(): void {
  // @ts-expect-error — Tauri injects __TAURI__ at runtime
  if (window.__TAURI__) {
    // @ts-expect-error
    window.__TAURI__.event.listen("settings-updated", (event: { payload: typeof settings }) => {
      Object.assign(settings, event.payload);
      if (enabled) scanAndRender();
    });
  }
}

function startScanning(): void {
  if (scanInterval) return;
  enabled = true;
  scanAndRender();
  // Scan every 1s (not 500ms — gives user time to scroll)
  scanInterval = setInterval(scanAndRender, 1000);
}

function stopScanning(): void {
  enabled = false;
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  clearCanvas();
}

function clearCanvas(): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

async function scanAndRender(): Promise<void> {
  if (!enabled) return;

  try {
    // @ts-expect-error — Tauri invoke API
    const regions: TextRegion[] = await window.__TAURI__.core.invoke("scan_screen_text");

    if (regions.length > 0) {
      renderTextRegions(regions);
    } else {
      renderStatusPanel("No text detected. Focus a window with text content.");
    }
  } catch {
    renderDemoPanel();
  }
}

/**
 * Render all detected text regions with morpheme highlighting
 */
function renderTextRegions(regions: TextRegion[]): void {
  clearCanvas();

  // Small status bar at top
  renderStatusBar(`MorphemeFlow active — ${regions.length} text regions | Ctrl+Shift+M to hide`);

  for (const region of regions) {
    renderRegionOverlay(region);
  }
}

/**
 * Render a single text region: background cover + morpheme text
 */
function renderRegionOverlay(region: TextRegion): void {
  const padding = 2;
  const fontSize = region.font_size;

  // Draw background to cover original text
  ctx.fillStyle = settings.bgColor;
  ctx.globalAlpha = settings.bgOpacity;
  ctx.fillRect(
    region.x - padding,
    region.y - padding,
    region.width + padding * 2,
    region.height + padding * 2
  );
  ctx.globalAlpha = 1.0;

  // Tokenize and render with morpheme colors
  const tokens = tokenize(region.text);
  let xPos = region.x;
  // Vertically center text in the region (baseline ≈ top + ascent)
  const baseline = region.y + fontSize * 0.85;

  for (const token of tokens) {
    if (token.type !== "word") {
      // Whitespace / punctuation
      ctx.font = `${fontSize}px 'Segoe UI', system-ui, sans-serif`;
      ctx.fillStyle = "#64748B";
      ctx.fillText(token.text, xPos, baseline);
      xPos += ctx.measureText(token.text).width;
      continue;
    }

    let result = cache.get(token.text);
    if (!result) {
      result = analyzeWord(token.text);
      cache.set(token.text, result);
    }

    if (settings.morphemeHighlight && result.morphemes.length > 1) {
      // Multi-morpheme: color each part
      for (const morpheme of result.morphemes) {
        const color = MORPHEME_COLORS[morpheme.type];
        const isBold = morpheme.type === "root" && settings.rootBold;
        ctx.font = `${isBold ? "bold " : ""}${fontSize}px 'Segoe UI', system-ui, sans-serif`;
        ctx.fillStyle = color;
        ctx.fillText(morpheme.text, xPos, baseline);
        xPos += ctx.measureText(morpheme.text).width;

        if (settings.syllableSpacing) {
          xPos += fontSize * settings.syllableIntensity;
        }
      }
    } else {
      // Single morpheme — render plainly
      ctx.font = `${fontSize}px 'Segoe UI', system-ui, sans-serif`;
      ctx.fillStyle = settings.rootColor;
      ctx.fillText(token.text, xPos, baseline);
      xPos += ctx.measureText(token.text).width;
    }
  }

  // Subtle underline showing morpheme structure for multi-morpheme words
  // (helps visually separate the morpheme groups)
}

/**
 * Thin status bar at top of overlay
 */
function renderStatusBar(message: string): void {
  const barH = 22;
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  ctx.fillRect(0, 0, window.innerWidth, barH);

  ctx.font = "11px 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = "#C4B5FD";
  ctx.fillText(message, 8, 15);
}

/**
 * Status panel when overlay is waiting
 */
function renderStatusPanel(message: string): void {
  clearCanvas();
  const w = 400;
  const h = 40;
  const x = (window.innerWidth - w) / 2;
  const y = 10;

  ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();

  ctx.font = "12px 'Segoe UI', system-ui, sans-serif";
  ctx.fillStyle = "#C4B5FD";
  ctx.textAlign = "center";
  ctx.fillText(message, x + w / 2, y + 25);
  ctx.textAlign = "left";
}

/**
 * Demo panel when Tauri backend is not available (dev mode)
 */
function renderDemoPanel(): void {
  clearCanvas();

  const panelW = 700;
  const panelH = 220;
  const panelX = (window.innerWidth - panelW) / 2;
  const panelY = 40;
  const pad = 20;

  ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, 12);
  ctx.fill();

  ctx.strokeStyle = "rgba(124, 58, 237, 0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = "bold 14px 'Segoe UI', system-ui";
  ctx.fillStyle = "#C4B5FD";
  ctx.fillText("MorphemeFlow — Demo Mode", panelX + pad, panelY + pad + 14);

  const sentences = [
    "The unsuccessful reconstruction was unfortunately delayed.",
    "Predictable misunderstandings are completely unavoidable.",
    "Extraordinary developmental improvements exceeded expectations.",
  ];

  let lineY = panelY + pad + 48;
  for (const s of sentences) {
    renderMorphemeLine(panelX + pad, lineY, s, 18, "#E2E8F0");
    lineY += 36;
  }

  // Legend
  const ly = panelY + panelH - pad;
  ctx.font = "11px system-ui";
  let lx = panelX + pad;
  for (const [type, color] of Object.entries(MORPHEME_COLORS)) {
    ctx.fillStyle = type === "root" ? "#E2E8F0" : color;
    ctx.fillText(`\u25CF ${type}`, lx, ly);
    lx += 80;
  }
}

/**
 * Render a single line with morpheme coloring (for demo panel)
 */
function renderMorphemeLine(x: number, y: number, text: string, fontSize: number, defaultColor: string): void {
  const tokens = tokenize(text);
  let xPos = x;

  for (const token of tokens) {
    if (token.type !== "word") {
      ctx.font = `${fontSize}px 'Segoe UI', system-ui`;
      ctx.fillStyle = "#94A3B8";
      ctx.fillText(token.text, xPos, y);
      xPos += ctx.measureText(token.text).width;
      continue;
    }

    let result = cache.get(token.text);
    if (!result) {
      result = analyzeWord(token.text);
      cache.set(token.text, result);
    }

    if (result.morphemes.length > 1) {
      for (const m of result.morphemes) {
        const color = m.type === "root" ? defaultColor : MORPHEME_COLORS[m.type];
        ctx.font = `${m.type === "root" ? "bold " : ""}${fontSize}px 'Segoe UI', system-ui`;
        ctx.fillStyle = color;
        ctx.fillText(m.text, xPos, y);
        xPos += ctx.measureText(m.text).width;
        xPos += fontSize * 0.04;
      }
    } else {
      ctx.font = `${fontSize}px 'Segoe UI', system-ui`;
      ctx.fillStyle = defaultColor;
      ctx.fillText(token.text, xPos, y);
      xPos += ctx.measureText(token.text).width;
    }
  }
}

document.addEventListener("DOMContentLoaded", init);
