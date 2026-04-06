// MorphemeFlow — Extension Build Script
// Bundles content script, background worker, and popup for Chrome MV3.

import * as esbuild from "esbuild";
import { cpSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes("--watch");
const dist = resolve(__dirname, "dist");

// Shared config
const shared = {
  bundle: true,
  format: "esm",
  target: "es2022",
  sourcemap: true,
  minify: !isWatch,
  logLevel: "info",
};

async function build() {
  // Ensure dist exists
  mkdirSync(dist, { recursive: true });

  // 1. Content script — runs in page context
  const contentConfig = {
    ...shared,
    entryPoints: [resolve(__dirname, "src/content/content.ts")],
    outfile: resolve(dist, "content.js"),
    // Content scripts can't use ES modules in MV3
    format: "iife",
  };

  // 2. Background service worker
  const backgroundConfig = {
    ...shared,
    entryPoints: [resolve(__dirname, "src/background/background.ts")],
    outfile: resolve(dist, "background.js"),
    format: "esm",
  };

  // 3. Popup script
  const popupConfig = {
    ...shared,
    entryPoints: [resolve(__dirname, "src/popup/popup.ts")],
    outfile: resolve(dist, "popup/popup.js"),
    format: "esm",
  };

  if (isWatch) {
    const contexts = await Promise.all([
      esbuild.context(contentConfig),
      esbuild.context(backgroundConfig),
      esbuild.context(popupConfig),
    ]);
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log("Watching for changes...");
  } else {
    await Promise.all([
      esbuild.build(contentConfig),
      esbuild.build(backgroundConfig),
      esbuild.build(popupConfig),
    ]);
  }

  // Copy static assets to dist
  cpSync(resolve(__dirname, "src/manifest.json"), resolve(dist, "manifest.json"));
  cpSync(resolve(__dirname, "src/content/styles.css"), resolve(dist, "content.css"));
  cpSync(resolve(__dirname, "src/popup/index.html"), resolve(dist, "popup/index.html"));
  const iconsDir = resolve(__dirname, "src/icons");
  if (existsSync(iconsDir)) {
    mkdirSync(resolve(dist, "icons"), { recursive: true });
    cpSync(iconsDir, resolve(dist, "icons"), { recursive: true });
  }

  // Copy fonts if available
  const fontsDir = resolve(__dirname, "../../public/fonts");
  if (existsSync(fontsDir)) {
    mkdirSync(resolve(dist, "fonts"), { recursive: true });
    cpSync(fontsDir, resolve(dist, "fonts"), { recursive: true });
  }

  console.log("Extension build complete → dist/");
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
