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
  control_type: number;
}

// Shared word cache
const cache = new WordCache(10_000);

// State
let enabled = false;
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let scanInterval: ReturnType<typeof setInterval> | null = null;
let lastRegionHash = "";
let scanInProgress = false;

// Scroll detection & adaptive scan rate
const SCAN_INTERVAL_NORMAL = 1000;   // base polling rate (ms)
const SCAN_INTERVAL_FAST = 650;      // polling rate during active scroll
const SCROLL_COOLDOWN_MS = 2000;     // return to normal rate after scroll stops
const POSITION_BUCKET_PX = 4;        // reduce jitter from tiny UIA coordinate drift
const MAX_RENDER_REGIONS = 120;      // cap draw cost in dense documents
const DENSE_CONTENT_THRESHOLD = 90;
let previousCentroidY = 0;
let scrollActive = false;
let scrollCooldownTimer: ReturnType<typeof setTimeout> | null = null;
let scanCount = 0;

// Settings
let settings = {
  morphemeHighlight: true,
  syllableSpacing: true,
  syllableIntensity: 0.06,
  prefixColor: "#7C3AED",
  rootColor: "#1E293B",
  suffixColor: "#059669",
  rootBold: true,
  bgColor: "#FFFFFF",
  bgOpacity: 1.0,      // fully opaque — must cover original text completely
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
    // @ts-expect-error — runtime-injected Tauri event API is not in DOM typings
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
  scanInterval = setInterval(scanAndRender, SCAN_INTERVAL_NORMAL);
}

/** Switch the polling interval (e.g. fast mode during scroll) */
function setScanRate(ms: number): void {
  if (!scanInterval || !enabled) return;
  clearInterval(scanInterval);
  scanInterval = setInterval(scanAndRender, ms);
}

function clearCanvas(): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

async function scanAndRender(): Promise<void> {
  if (!enabled || scanInProgress) return;
  scanInProgress = true;

  try {
    // @ts-expect-error — Tauri invoke API
    const rawRegions: TextRegion[] = await window.__TAURI__.core.invoke("scan_screen_text");

    // UIA returns coordinates in physical screen pixels, but our canvas context
    // is scaled by devicePixelRatio (ctx.scale(dpr, dpr)), so we must convert
    // physical pixels → CSS pixels by dividing by dpr.
    const dpr = window.devicePixelRatio || 1;
    const regions: TextRegion[] = rawRegions.map(r => ({
      ...r,
      x: r.x / dpr,
      y: r.y / dpr,
      width: r.width / dpr,
      height: r.height / dpr,
      font_size: r.font_size / dpr,
    }));

    if (regions.length > 0) {
      // --- Scroll detection: compare Y centroid with previous scan ---
      const centroidY = regions.reduce((sum, r) => sum + r.y, 0) / regions.length;
      const avgFontSize = regions.reduce((sum, r) => sum + r.font_size, 0) / regions.length;
      const shiftThreshold = Math.max(14, avgFontSize * 0.9);
      const shifted = scanCount > 0 && Math.abs(centroidY - previousCentroidY) > shiftThreshold;
      previousCentroidY = centroidY;

      if (shifted) {
        // Positions moved — likely a scroll or window resize.
        // Switch to fast polling so the overlay tracks the content.
        if (!scrollActive) {
          scrollActive = true;
          setScanRate(SCAN_INTERVAL_FAST);
        }
        // Reset cooldown: return to normal rate after scroll stops
        if (scrollCooldownTimer) clearTimeout(scrollCooldownTimer);
        scrollCooldownTimer = setTimeout(() => {
          scrollActive = false;
          setScanRate(SCAN_INTERVAL_NORMAL);
          scrollCooldownTimer = null;
        }, SCROLL_COOLDOWN_MS);
      }

      scanCount++;
      renderTextRegions(regions);
    } else {
      previousCentroidY = 0;
      renderStatusPanel("No text detected. Focus a window with text content.");
    }
  } catch {
    renderDemoPanel();
  } finally {
    scanInProgress = false;
  }
}

/**
 * Detect text that is UI chrome (Word style gallery, toolbar labels, etc.)
 * rather than actual document content.
 */
const UI_CHROME_PATTERNS = [
  /^¶?\s*Normal¶?\s*No\s*Spacing/i,
  /Heading\s*1.*Heading\s*2.*Heading\s*3/i,
  /TitleSub.*Emphasis.*Intense/i,
  /QuoteIntense.*QuoteSubtle.*Reference/i,
  /^Calibri\s*\(/i,
  /^(File|Home|Insert|Draw|Design|Layout|References|Mailings|Review|View)\s+(File|Home|Insert|Draw|Design|Layout|References|Mailings|Review|View)/i,
];

const LIST_MARKER_ONLY_PATTERN = /^\s*(?:[\u2022\u25E6\u25AA\u25CF\u00B7▪‣◦*-]|(?:\d+|[A-Za-z])[.)])\s*$/u;
const LIST_LINE_PATTERN = /^\s*(?:[\u2022\u25E6\u25AA\u25CF\u00B7▪‣◦*-]|(?:\d+|[A-Za-z])[.)])\s+\S/u;

function isUiChromeText(text: string): boolean {
  return UI_CHROME_PATTERNS.some(p => p.test(text));
}

function isListCandidateText(text: string): boolean {
  return LIST_MARKER_ONLY_PATTERN.test(text) || LIST_LINE_PATTERN.test(text);
}

/**
 * Render all detected text regions with morpheme highlighting
 */
function renderTextRegions(regions: TextRegion[]): void {
  // Filter: skip regions in the top toolbar/ribbon area of most apps,
  // very small regions, status bars, and sidebar chrome.
  // Note: coordinates are already in CSS pixels (DPI-adjusted).
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  const contentRegions = regions.filter(r => {
    const isListCandidate = isListCandidateText(r.text);
    // Skip title bars / very top chrome (60 CSS px)
    if (r.y < 60) return false;
    // Skip tiny regions (UI labels, not content)
    if ((r.height < 8 || r.width < 20) && !isListCandidate) return false;
    // Skip status bars at the very bottom
    if (r.y > screenH - 30) return false;
    // Skip very short text that's likely a UI button/link label
    if (r.text.length <= 2 && r.width < 40 && !isListCandidate) return false;
    // Skip settings panels / sidebars far to the right (>90% of screen, very narrow)
    if (r.x > screenW * 0.92 && r.width < 80) return false;
    // Skip navigation / sidebar on the left (<8% of screen, very narrow, very short)
    if (r.x < screenW * 0.08 && r.width < 80 && r.text.length < 10 && !isListCandidate) return false;
    // Skip Word style gallery and similar UI chrome by content
    if (isUiChromeText(r.text)) return false;
    // Skip Image alt text — not visible on screen, just accessibility metadata
    if (r.control_type === 50006) return false;
    // Skip accessibility helper text
    if (r.text.includes("missing image description")) return false;
    // Skip raw URLs leaked from UIA
    if (/^https?:\/\//.test(r.text)) return false;
    // Skip orphaned numbers (comment counts without context)
    if (/^\d{1,5}$/.test(r.text) && r.width < 60) return false;
    // Skip "attribution" labels
    if (/^attribution$/i.test(r.text.trim())) return false;
    return true;
  });

  // Prioritize top-to-bottom document flow and cap draw workload for smoothness.
  const prioritizedRegions = [...contentRegions].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 3) return a.y - b.y;
    return a.x - b.x;
  });
  const renderRegions = prioritizedRegions.slice(0, MAX_RENDER_REGIONS);
  const denseMode = renderRegions.length >= DENSE_CONTENT_THRESHOLD;

  // Skip re-render if content regions haven't changed (cheap numeric hash)
  let hash = 0;
  const stableRegions = [...renderRegions].sort((a, b) => {
    const yA = Math.round(a.y / POSITION_BUCKET_PX);
    const yB = Math.round(b.y / POSITION_BUCKET_PX);
    if (yA !== yB) return yA - yB;
    const xA = Math.round(a.x / POSITION_BUCKET_PX);
    const xB = Math.round(b.x / POSITION_BUCKET_PX);
    if (xA !== xB) return xA - xB;
    return a.text.localeCompare(b.text);
  });

  for (const r of stableRegions) {
    const xBucket = Math.round(r.x / POSITION_BUCKET_PX);
    const yBucket = Math.round(r.y / POSITION_BUCKET_PX);
    for (let i = 0; i < r.text.length; i++) {
      hash = ((hash << 5) - hash + r.text.charCodeAt(i)) | 0;
    }
    hash = ((hash << 5) - hash + xBucket) | 0;
    hash = ((hash << 5) - hash + yBucket) | 0;
  }
  const hashStr = String(hash);
  if (hashStr === lastRegionHash) return;
  lastRegionHash = hashStr;

  // Clear canvas AFTER hash check — avoids wiping the screen when nothing changed
  clearCanvas();

  // Status bar at top
  renderStatusBar(`MorphemeFlow active — ${regions.length} detected, ${renderRegions.length}/${contentRegions.length} rendered | Ctrl+Shift+M to hide`);

  for (const region of renderRegions) {
    renderRegionOverlay(region, denseMode);
  }
}

/**
 * Render a single text region: background cover + morpheme text
 * Uses two-pass rendering: measure rendered width first, then size
 * background to cover BOTH original text and rendered text.
 */
function renderRegionOverlay(region: TextRegion, denseMode = false): void {
  const fontSize = region.font_size;
  const lineHeight = fontSize * 1.35;
  const maxLines = Math.max(1, Math.floor(region.height / lineHeight));
  // Clamp maxWidth to not extend past screen edge
  const screenW = window.innerWidth;
  const availableWidth = Math.max(100, screenW - region.x - 10);
  const maxWidth = Math.min(region.width, availableWidth);

  // Break text into words for wrapping
  const tokens = tokenize(region.text);
  const lines = wrapTokensIntoLines(tokens, fontSize, maxWidth, maxLines);

  // --- PASS 1: measure each line's natural width and morpheme gap count ---
  const lineMetrics: { naturalWidth: number; gapCount: number }[] = [];
  for (const line of lines) {
    let naturalWidth = 0;
    let gapCount = 0;
    for (const token of line) {
      if (token.type !== "word") {
        ctx.font = `${fontSize}px 'Segoe UI', system-ui, sans-serif`;
        naturalWidth += ctx.measureText(token.text).width;
        continue;
      }
      let result = cache.get(token.text);
      if (!result) {
        result = analyzeWord(token.text);
        cache.set(token.text, result);
      }
      if (settings.morphemeHighlight && result.morphemes.length > 1) {
        for (const morpheme of result.morphemes) {
          const isBold = morpheme.type === "root" && settings.rootBold;
          ctx.font = `${isBold ? "bold " : ""}${fontSize}px 'Segoe UI', system-ui, sans-serif`;
          naturalWidth += ctx.measureText(morpheme.text).width;
        }
        gapCount += result.morphemes.length - 1;
      } else {
        ctx.font = `${fontSize}px 'Segoe UI', system-ui, sans-serif`;
        naturalWidth += ctx.measureText(token.text).width;
      }
    }
    lineMetrics.push({ naturalWidth, gapCount });
  }

  // Compute max rendered width across all lines (with spacing budget)
  let maxRenderedWidth = 0;
  const lineSpacings: number[] = [];
  for (const { naturalWidth, gapCount } of lineMetrics) {
    // Dynamic spacing: cap so rendered text never exceeds original width
    const slack = Math.max(0, region.width - naturalWidth);
    const idealGap = fontSize * settings.syllableIntensity;
    const spacingPerGap = settings.syllableSpacing && gapCount > 0
      ? Math.min(idealGap, slack / gapCount)
      : 0;
    lineSpacings.push(spacingPerGap);
    const renderedWidth = naturalWidth + spacingPerGap * gapCount;
    maxRenderedWidth = Math.max(maxRenderedWidth, renderedWidth);
  }

  // Background width: use the SMALLER of region.width and rendered text width + margin.
  // UIA often returns container-width bounding boxes (e.g., 580px for "Sport headlines"
  // that only needs ~180px). Using the measured text width prevents huge white rectangles.
  const padding = Math.max(4, fontSize * (denseMode ? 0.24 : 0.3));
  const textWidth = maxRenderedWidth > 0 ? maxRenderedWidth : region.width;
  
  // Bound the block to just the text size to avoid painting over images in large container elements
  // If the original region is massively wider than the rendered text, it's likely a generic container.
  let targetWidth = region.width;
  if (region.width > textWidth * 1.5) {
    targetWidth = textWidth + fontSize * 0.5;
  }
  let bgWidth = Math.max(targetWidth, textWidth * (denseMode ? 0.98 : 0.95)) + padding * 2;
  bgWidth = Math.min(bgWidth, availableWidth + padding * 2);

  // Cover at least the original region height to avoid vertical text bleed-through.
  const renderedTextHeight = lines.length * lineHeight;
  let targetHeight = region.height;
  if (region.height > renderedTextHeight * 2.0) {
    // This is clearly a container (e.g., a card with an image). Bound height tightly to text.
    targetHeight = renderedTextHeight + fontSize * 0.5;
  }
  
  let bgHeight = Math.max(targetHeight, renderedTextHeight + fontSize * 0.3) + padding * 2;
  bgHeight = Math.min(bgHeight, Math.max(lineHeight + padding * 2, window.innerHeight - region.y + padding));

  // --- Draw background ---
  ctx.fillStyle = settings.bgColor;
  ctx.globalAlpha = settings.bgOpacity;
  ctx.fillRect(region.x - padding, region.y - padding, bgWidth, bgHeight);
  ctx.globalAlpha = 1.0;

  // Clip to background rect
  ctx.save();
  ctx.beginPath();
  ctx.rect(region.x - padding, region.y - padding, bgWidth, bgHeight);
  ctx.clip();

  // --- PASS 2: render text with computed spacing ---
  let lineY = region.y + fontSize * 0.85;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const spacingPerGap = lineSpacings[li];
    let xPos = region.x;

    for (const token of line) {
      if (token.type !== "word") {
        ctx.font = `${fontSize}px 'Segoe UI', system-ui, sans-serif`;
        ctx.fillStyle = "#64748B";
        ctx.fillText(token.text, xPos, lineY);
        xPos += ctx.measureText(token.text).width;
        continue;
      }

      let result = cache.get(token.text);
      if (!result) {
        result = analyzeWord(token.text);
        cache.set(token.text, result);
      }

      if (settings.morphemeHighlight && result.morphemes.length > 1) {
        for (let mi = 0; mi < result.morphemes.length; mi++) {
          const morpheme = result.morphemes[mi];
          const color = MORPHEME_COLORS[morpheme.type];
          const isBold = morpheme.type === "root" && settings.rootBold;
          ctx.font = `${isBold ? "bold " : ""}${fontSize}px 'Segoe UI', system-ui, sans-serif`;
          ctx.fillStyle = color;
          ctx.fillText(morpheme.text, xPos, lineY);
          xPos += ctx.measureText(morpheme.text).width;
          // Add capped spacing between morphemes (not after last)
          if (mi < result.morphemes.length - 1) {
            xPos += spacingPerGap;
          }
        }
      } else {
        ctx.font = `${fontSize}px 'Segoe UI', system-ui, sans-serif`;
        ctx.fillStyle = settings.rootColor;
        ctx.fillText(token.text, xPos, lineY);
        xPos += ctx.measureText(token.text).width;
      }
    }
    lineY += lineHeight;
  }

  ctx.restore();
}

/**
 * Wrap tokens into lines that fit within maxWidth.
 */
function wrapTokensIntoLines(
  tokens: ReturnType<typeof tokenize>,
  fontSize: number,
  maxWidth: number,
  maxLines: number,
): ReturnType<typeof tokenize>[] {
  // Use bold font for measurement since root morphemes render bold —
  // this slightly overestimates non-bold words but prevents overflow
  ctx.font = `bold ${fontSize}px 'Segoe UI', system-ui, sans-serif`;

  const lines: ReturnType<typeof tokenize>[] = [[]];
  let lineWidth = 0;

  for (const token of tokens) {
    const w = ctx.measureText(token.text).width;

    if (lineWidth + w > maxWidth && lines[lines.length - 1].length > 0) {
      // Start new line
      if (lines.length >= maxLines) break; // hit max lines
      lines.push([]);
      lineWidth = 0;
      // Skip leading whitespace on new line
      if (token.type !== "word") continue;
    }

    lines[lines.length - 1].push(token);
    lineWidth += w;
  }

  return lines;
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
