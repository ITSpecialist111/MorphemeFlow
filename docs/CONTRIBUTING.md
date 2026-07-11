# Contributing to MorphemeFlow

## Prerequisites

- **Rust** (stable) with `rustfmt` — [rustup.rs](https://rustup.rs/)
- **Node.js** (20+) and npm — TypeScript engine, extension, tests, and project-local Tauri CLI
- **Windows 10/11** — required for Win32 APIs (capture, OCR)
- **WebView2** — ships with Windows 11; install manually on Windows 10

## Building

```bash
# Clone the repo
git clone https://github.com/morphemeflow/dyslexia-solution.git
cd dyslexia-solution

# Install pinned JavaScript and Tauri tooling
npm ci

# Test, lint, type-check, and build TypeScript surfaces
npm test
npm run lint
npm run typecheck
npm run build

# Run the Reader app (dev mode)
npm run dev:reader

# Build Reader MSI + NSIS installers
npm run build:reader
```

## Testing

```bash
# Run all Rust tests
cargo test --workspace

# Formatting and compile gates
cargo fmt --all -- --check
cargo check --workspace

# Individual JavaScript suites
npm -w packages/engine-ts test
npm -w packages/web test
```

## Project Structure

```
crates/engine/              # Shared Rust engine (morpheme analysis)
packages/engine-ts/         # TypeScript engine
packages/web/               # MV3 extension + DOM tests
apps/reader-windows/        # Tauri 2.x desktop app
  src-tauri/                 # Rust backend
  ui/                        # Frontend (HTML/CSS/JS)
data/test-fixtures/          # Shared test fixtures
docs/                        # Documentation
```

## Code Style

- Rust: standard `rustfmt` formatting, `clippy` clean
- JS/CSS: no framework, vanilla with clear structure
- Commit messages: imperative mood, concise

## Adding Dictionary Entries

The shared morpheme source lives at `data/morpheme-dictionary/morphemes.txt`. To add entries:
1. Use the tab-delimited compact format: `word<TAB>morph:type-code[:meaning]|morph:type-code[:meaning]`
2. Type codes: `p` prefix, `r` root, `s` suffix, `i` inflection
3. Ensure the visible segments reconstruct the source spelling; lexical stem changes are projected safely but explicit surface boundaries are preferred
4. Re-bake generated TypeScript data when required by `data/bake-data.mjs`
5. Run `npm test && cargo test --workspace`

## Reporting Issues

- Use GitHub Issues
- Include your Windows version
- Include the crash log from `%APPDATA%\MorphemeFlow\logs\reader.log` if relevant
- Screenshots are helpful for rendering issues
- For content-selection issues, show both the expected reading content and any UI chrome that was incorrectly processed; stability metrics alone are not sufficient

## License

MIT — see [LICENSE](../LICENSE) in the repo root.
