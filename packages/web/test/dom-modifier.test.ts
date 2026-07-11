import { beforeEach, describe, expect, it } from "vitest";
import { getPreset } from "../../engine-ts/src/settings";
import { applyMorphemes, removeMorphemes } from "../src/content/dom-modifier";

const settings = getPreset("balanced");

describe("browser DOM transformation", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("preserves exact text, casing, apostrophes, and hyphens through apply/remove", () => {
    const original = "UNHAPPY readers don't lose well-known text.";
    document.body.innerHTML = `<main><p id="article"></p></main>`;
    const article = document.getElementById("article")!;
    article.textContent = original;

    expect(applyMorphemes(settings)).toBeGreaterThan(0);
    expect(article.textContent).toBe(original);
    expect(article.querySelectorAll(".mf-word-group").length).toBeGreaterThan(0);

    removeMorphemes();
    expect(article.textContent).toBe(original);
    expect(article.querySelector(".mf-word-group")).toBeNull();
  });

  it("combines morpheme coloring and syllable micro-spacing without adding text", () => {
    document.body.innerHTML = "<main><p id='article'>reconstruction</p></main>";
    const article = document.getElementById("article")!;

    applyMorphemes(settings);

    expect(article.textContent).toBe("reconstruction");
    expect(article.querySelectorAll(".mf-morpheme").length).toBeGreaterThan(1);
    expect(article.querySelectorAll(".mf-syllable-gap").length).toBeGreaterThan(0);
  });

  it("processes semantic reading content but leaves navigation chrome untouched", () => {
    document.body.innerHTML = `
      <nav><p id="navigation">Navigation and account settings</p></nav>
      <main><p id="article">Helpful reconstruction guidance</p></main>
    `;

    applyMorphemes(settings);

    expect(document.getElementById("navigation")!.querySelector(".mf-word-group")).toBeNull();
    expect(document.getElementById("article")!.querySelector(".mf-word-group")).not.toBeNull();
  });

  it("uses a prose-only fallback when a page has no semantic main region", () => {
    document.body.innerHTML = `
      <button id="button">Account settings</button>
      <div id="chrome">Navigation controls</div>
      <p id="article">Readable paragraph content</p>
    `;

    applyMorphemes(settings);

    expect(document.getElementById("button")!.querySelector(".mf-word-group")).toBeNull();
    expect(document.getElementById("chrome")!.querySelector(".mf-word-group")).toBeNull();
    expect(document.getElementById("article")!.querySelector(".mf-word-group")).not.toBeNull();
  });
});
