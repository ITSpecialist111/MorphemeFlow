// MorphemeFlow — Region analysis and rendering verification script
// Analyzes captured UIA regions for issues, applies fixes, generates SVG output
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TextRegion {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  font_size: number;
  source: string;
  control_type: number;
}

const inputPath = resolve(__dirname, "fixtures/captured-regions.json");
const rawRegions: TextRegion[] = JSON.parse(readFileSync(inputPath, "utf-8"));

console.log(`\n=== RAW DATA ANALYSIS ===`);
console.log(`Total raw regions: ${rawRegions.length}`);

// Problem 1: Font size distribution
const fontSizes = rawRegions.map(r => r.font_size);
console.log(`\nFont sizes: min=${Math.min(...fontSizes).toFixed(1)}, max=${Math.max(...fontSizes).toFixed(1)}, avg=${(fontSizes.reduce((a,b)=>a+b,0)/fontSizes.length).toFixed(1)}`);

// Count by font size buckets
const buckets: Record<string, number> = {};
for (const fs of fontSizes) {
  const bucket = `${Math.floor(fs / 10) * 10}-${Math.floor(fs / 10) * 10 + 9}`;
  buckets[bucket] = (buckets[bucket] || 0) + 1;
}
console.log("Font size distribution:", buckets);

// Problem 2: Overlapping regions
let overlapCount = 0;
for (let i = 0; i < rawRegions.length; i++) {
  for (let j = i + 1; j < rawRegions.length; j++) {
    const a = rawRegions[i], b = rawRegions[j];
    const overlapX = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
    const overlapY = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    if (overlapX > 10 && overlapY > 10) overlapCount++;
  }
}
console.log(`\nOverlapping region pairs: ${overlapCount}`);

// Problem 3: Text fits in bounding box?
let textOverflowCount = 0;
for (const r of rawRegions) {
  // Approximate text width: char_count * font_size * 0.55
  const approxTextWidth = r.text.length * r.font_size * 0.55;
  if (approxTextWidth > r.width * 1.5) {
    textOverflowCount++;
  }
}
console.log(`Regions where text overflows bbox: ${textOverflowCount}`);

// Problem 4: Control type analysis
const ctMap: Record<number, string> = {
  50000: "Button",
  50004: "Edit",
  50005: "Hyperlink",
  50006: "Image",
  50007: "ListItem",
  50011: "MenuItem",
  50019: "TabItem",
  50020: "Text",
  50023: "TreeItem",
  50026: "Toolbar",
};

const ctCounts: Record<string, number> = {};
for (const r of rawRegions) {
  const name = ctMap[r.control_type] || `Unknown(${r.control_type})`;
  ctCounts[name] = (ctCounts[name] || 0) + 1;
}
console.log("\nControl types:", ctCounts);

// Problem 5: Browser chrome vs page content
// Chrome/Edge toolbar is typically y < 300 (tabs + address bar + nav)
const chromeRegions = rawRegions.filter(r => r.y < 320 || r.control_type === 50000 || r.control_type === 50019);
const contentRegions = rawRegions.filter(r => r.y >= 320 && r.control_type !== 50000 && r.control_type !== 50019);
console.log(`\nBrowser chrome regions: ${chromeRegions.length}`);
console.log(`Page content regions: ${contentRegions.length}`);

// Problem 6: Image alt-text showing as text (ct50006 = Image)
const imageRegions = rawRegions.filter(r => r.control_type === 50006);
console.log(`Image alt-text regions (should skip): ${imageRegions.length}`);

// Problem 7: ListItem (50007) regions are cards — they're big containers with text inside
const listItems = rawRegions.filter(r => r.control_type === 50007);
console.log(`ListItem (card) regions: ${listItems.length}`);
console.log(`  Avg size: ${(listItems.reduce((a,r) => a + r.width * r.height, 0) / listItems.length).toFixed(0)} sq px`);

// ============================================================
// NOW APPLY FIXES
// ============================================================
console.log(`\n=== APPLYING FIXES ===`);

function fixRegions(regions: TextRegion[]): TextRegion[] {
  let fixed = [...regions];

  // Fix 1: Skip browser chrome (buttons, tabs, toolbar, address bar)
  fixed = fixed.filter(r => {
    // Skip buttons (Close, Back, etc.)
    if (r.control_type === 50000) return false;
    // Skip tab items
    if (r.control_type === 50019) return false;
    // Skip toolbar items
    if (r.control_type === 50026) return false;
    // Skip edit fields (address bar)
    if (r.control_type === 50004) return false;
    return true;
  });
  console.log(`After removing chrome controls: ${fixed.length}`);

  // Fix 2: Skip image alt-text (ct 50006)
  fixed = fixed.filter(r => r.control_type !== 50006);
  console.log(`After removing image alt-text: ${fixed.length}`);

  // Fix 3: Better font size estimation
  // The bounding boxes for ListItems (50007) are the ENTIRE card, not just the text.
  // For these, we need a fixed reasonable font size, not height-based.
  for (const r of fixed) {
    if (r.control_type === 50007) {
      // ListItem cards - estimate from text length and width
      // These are typically 15-18px body text
      const lines = Math.ceil(r.text.length / (r.width / 8)); // rough chars per line
      if (lines > 2) {
        r.font_size = 15;
      } else {
        r.font_size = Math.min(18, (r.height / 1.4));
      }
    }
    // Clamp all font sizes to reasonable range
    r.font_size = Math.max(11, Math.min(r.font_size, 32));
  }

  // Fix 4: For multiline ListItem cards, only render the headline text
  // Strip "Attribution*" suffixes and "Comments\d+" and "Video, *"
  for (const r of fixed) {
    if (r.control_type === 50007) {
      r.text = r.text
        .replace(/Attribution[A-Za-z &']+$/, "")
        .replace(/Comments\d+$/, "")
        .replace(/\. Video, [\d:]+$/, "")
        .trim();
    }
  }

  // Fix 5: Dedup overlapping regions (prefer smaller/more specific)
  fixed.sort((a, b) => (a.width * a.height) - (b.width * b.height));
  const deduped: TextRegion[] = [];
  for (const r of fixed) {
    const dominated = deduped.some(k => {
      const overlapX = Math.max(0, Math.min(r.x + r.width, k.x + k.width) - Math.max(r.x, k.x));
      const overlapY = Math.max(0, Math.min(r.y + r.height, k.y + k.height) - Math.max(r.y, k.y));
      const overlapArea = overlapX * overlapY;
      const smallerArea = Math.min(r.width * r.height, k.width * k.height);
      return overlapArea > smallerArea * 0.5;
    });
    if (!dominated) deduped.push(r);
  }
  console.log(`After dedup: ${deduped.length}`);

  return deduped;
}

const fixedRegions = fixRegions(rawRegions);

// Stats on fixed data
const fixedFontSizes = fixedRegions.map(r => r.font_size);
console.log(`\nFixed font sizes: min=${Math.min(...fixedFontSizes).toFixed(1)}, max=${Math.max(...fixedFontSizes).toFixed(1)}, avg=${(fixedFontSizes.reduce((a,b)=>a+b,0)/fixedFontSizes.length).toFixed(1)}`);

// Check overlaps after fix
let fixedOverlaps = 0;
for (let i = 0; i < fixedRegions.length; i++) {
  for (let j = i + 1; j < fixedRegions.length; j++) {
    const a = fixedRegions[i], b = fixedRegions[j];
    const overlapX = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
    const overlapY = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    if (overlapX > 10 && overlapY > 10) fixedOverlaps++;
  }
}
console.log(`Remaining overlaps: ${fixedOverlaps}`);

// Save fixed regions
const fixedPath = resolve(__dirname, "fixtures/fixed-regions.json");
writeFileSync(fixedPath, JSON.stringify(fixedRegions, null, 2));
console.log(`\nSaved ${fixedRegions.length} fixed regions to ${fixedPath}`);

// ============================================================
// GENERATE SVG VISUALIZATION
// ============================================================
console.log(`\n=== GENERATING SVG ===`);

const viewportW = 1600;
const viewportH = Math.max(...fixedRegions.map(r => r.y + r.height + 20), 800);

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewportW}" height="${viewportH}" viewBox="0 0 ${viewportW} ${viewportH}">
<rect width="100%" height="100%" fill="#f8f8f8"/>
<style>
  text { font-family: 'Segoe UI', system-ui, sans-serif; }
  .prefix { fill: #7C3AED; }
  .root { fill: #1E293B; font-weight: bold; }
  .suffix { fill: #059669; }
  .bg { fill: #FFFBF0; opacity: 0.95; }
  .debug-box { fill: none; stroke: #e11d48; stroke-width: 0.5; opacity: 0.3; }
</style>
`;

// Draw bounding boxes (debug layer)
for (const r of fixedRegions) {
  svg += `<rect class="debug-box" x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}"/>\n`;
}

// Draw morpheme-styled text
for (const r of fixedRegions) {
  const fs = r.font_size;
  const baseline = r.y + fs * 0.85;

  // Background cover
  svg += `<rect class="bg" x="${r.x - 2}" y="${r.y - 2}" width="${r.width + 4}" height="${r.height + 4}"/>\n`;

  // Simple morpheme coloring: split words, color parts
  const words = r.text.split(/(\s+)/);
  let xOffset = r.x;

  for (const word of words) {
    if (/^\s+$/.test(word)) {
      xOffset += fs * 0.3 * word.length;
      continue;
    }

    if (word.length > 5) {
      const pLen = Math.min(3, Math.floor(word.length * 0.25));
      const sLen = Math.min(3, Math.floor(word.length * 0.2));
      const prefix = word.substring(0, pLen);
      const root = word.substring(pLen, word.length - sLen);
      const suffix = word.substring(word.length - sLen);

      svg += `<text x="${xOffset}" y="${baseline}" font-size="${fs}" class="prefix">${escXml(prefix)}</text>`;
      xOffset += prefix.length * fs * 0.55;
      svg += `<text x="${xOffset}" y="${baseline}" font-size="${fs}" class="root">${escXml(root)}</text>`;
      xOffset += root.length * fs * 0.6;
      svg += `<text x="${xOffset}" y="${baseline}" font-size="${fs}" class="suffix">${escXml(suffix)}</text>`;
      xOffset += suffix.length * fs * 0.55;
    } else {
      svg += `<text x="${xOffset}" y="${baseline}" font-size="${fs}" fill="#1E293B">${escXml(word)}</text>`;
      xOffset += word.length * fs * 0.55;
    }
    xOffset += fs * 0.25; // word spacing
  }
  svg += "\n";
}

svg += `</svg>`;

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

const svgPath = resolve(__dirname, "fixtures/overlay-preview.svg");
writeFileSync(svgPath, svg);
console.log(`Generated SVG preview: ${svgPath}`);
console.log(`\nDone! Open the SVG in a browser to verify rendering.`);
