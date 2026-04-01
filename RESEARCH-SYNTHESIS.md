# MorphemeFlow — Research Synthesis
## Bringing It All Together

---

## The One-Line Pitch

**MorphemeFlow** is a free, open-source browser extension that helps dyslexic readers decode text by automatically highlighting word roots, prefixes, and suffixes — something no existing tool does.

---

## What We Researched

| Document | Status | Key Finding |
|----------|--------|-------------|
| [Competitive Analysis](research/competitive-analysis.md) | Complete | 10 tools analyzed; none combine morpheme + syllable + adaptive |
| [Typography & Color Science](research/typography-and-dyslexia-research.md) | Complete | Letter spacing is the strongest typographic intervention |
| [Dyslexia Science Foundations](research/dyslexia-science-foundations.md) | Complete | Morphological awareness is a proven compensatory strategy |
| [NLP Technical Approaches](research/nlp-technical-approaches.md) | Complete | Hybrid dictionary+rules approach is feasible client-side |
| [Architecture Design](ARCHITECTURE.md) | Complete | Full system design with processing pipeline |
| [Implementation Plan](PLAN.md) | Complete | 5-sprint plan from engine to shipped extension |

---

## The Gap We're Filling

After analyzing **10 existing tools** across the competitive landscape:

```
╔═══════════════════════════════════════════════════════════╗
║                    THE GAP                                ║
║                                                           ║
║  No tool combines:                                        ║
║                                                           ║
║  1. Automated morpheme decomposition on live web text     ║
║  2. Syllable-level visual intelligence (micro-kerning)    ║
║  3. In-place page modification (not extract-and-rerender) ║
║  4. Synchronized TTS with sub-word highlighting           ║
║  5. Evidence-based features backed by reading science     ║
║  6. Open source + 100% local processing                   ║
║  7. Non-stigmatizing design for adult users               ║
║                                                           ║
║  MorphemeFlow fills ALL of these gaps.                     ║
╚═══════════════════════════════════════════════════════════╝
```

---

## The Science That Backs Us

| Claim | Evidence | Key Study |
|-------|----------|-----------|
| Morpheme highlighting helps dyslexic readers | **Strong** | Bowers, Kirby & Deacon 2010 (meta-analysis, d=0.33-0.65) |
| Letter spacing improves reading | **Strong** | Zorzi et al. 2012 (PNAS, ~20% improvement) |
| Syllable segmentation reduces cognitive load | **Strong** | Tressoldi et al. 2007; Ziegler & Goswami 2005 |
| Multimodal (visual+audio) is better than either alone | **Strong** | Montali & Lewandowski 1996; Mayer 2001 |
| No single "best" font/color exists | **Strong** | UDL framework; Rello & Bigham 2017 |
| Partial-word bolding (Bionic Reading) helps | **None** | University of Valencia 2023 (no significant effect) |

Our approach is **more evidence-based than every competing tool** in the market.

---

## How We Avoid Copyright Issues

| ❌ What We DON'T Do | ✅ What We DO Instead |
|---------------------|----------------------|
| Copy Bionic Reading's fixation algorithm | Linguistically-aware morpheme decomposition (completely different technology) |
| Use BeeLine's color gradient (patented) | Reading ruler with focus window (different mechanism, no patent conflict) |
| Use Bionic Reading's brand/name | Original name "MorphemeFlow" |
| Depend on proprietary APIs | All processing is local, open-source |
| Use restricted linguistic databases | CMU dictionary (BSD), Knuth-Liang patterns (public domain), original morpheme dictionary |

**Our novel contributions:**
1. Hybrid morpheme detection algorithm (original)
2. Syllable micro-kerning concept (original)
3. Combined morpheme + syllable + environment + ruler + TTS system (original combination)
4. Curated morpheme dictionary for the 5,000 most common English words (original compilation)

---

## Why This Will Work (Market Perspective)

**Bionic Reading went viral** by offering one simple thing: click a button, text changes. It focused on **speed** but had **no evidence**.

**MorphemeFlow** offers the same simplicity with a focus on **comprehension** and **actual evidence**:
- Click the extension → text is morpheme-highlighted, syllable-spaced, and readable
- Every feature maps to published research
- Free and open-source → no subscription fatigue

**Distribution channels:**
- Chrome Web Store (2B+ users)
- Firefox Add-ons
- Education market (teachers share tools virally)
- Dyslexia advocacy organizations (BDA, IDA, Understood.org)
- Hacker News / Product Hunt (open-source angle)

---

## Technology Summary

```
Browser Extension (Manifest V3)
├── Engine: TypeScript, custom NLP
│   ├── Morpheme analysis: Dictionary + Rules + Syllable fallback
│   ├── Syllable splitting: Knuth-Liang (hypher)
│   └── Processing: 100% local, <100ms per page
├── DOM: TreeWalker + MutationObserver
├── TTS: Web Speech API (zero dependencies)
├── UI: Vanilla HTML/CSS popup
├── Build: Vite + Vitest
└── License: MIT (fully open source)
```

---

## What's Next

### Immediate (Sprint 0 → Sprint 1)
1. Initialize git repo and project scaffolding
2. Install gstack skills for structured development
3. Build the morpheme dictionary (5K most common words)
4. Implement the core text processing engine
5. Write comprehensive tests

### Ready for your approval to proceed.

---

## gstack Integration

We'll use gstack's sprint methodology:

| gstack Skill | When We Use It |
|-------------|----------------|
| `/office-hours` | Done (this research phase = office hours equivalent) |
| `/plan-ceo-review` | Review this plan before building |
| `/plan-eng-review` | Architecture review with ASCII diagrams |
| `/review` | After each sprint's code is written |
| `/qa` | Browser testing of the extension |
| `/ship` | Chrome/Firefox Web Store submissions |
| `/retro` | After each sprint completion |

---

*Research complete. Architecture designed. Plan ready.*
*Awaiting approval to begin Sprint 0: Project Setup.*
