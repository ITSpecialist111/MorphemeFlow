// MorphemeFlow — Prefix Rules
// 26 common English prefixes with meanings

export interface AffixRule {
  affix: string;
  meaning: string;
  requiresRoot: boolean; // Does remaining string need to be a valid root?
  stemChange?: (remaining: string) => string; // Handles stem changes
}

export const PREFIX_RULES: AffixRule[] = [
  // Sorted longest-first for greedy matching
  { affix: "inter", meaning: "between", requiresRoot: true },
  { affix: "trans", meaning: "across", requiresRoot: true },
  { affix: "super", meaning: "above", requiresRoot: true },
  { affix: "under", meaning: "below", requiresRoot: true },
  { affix: "counter", meaning: "against", requiresRoot: true },
  { affix: "over", meaning: "excessive", requiresRoot: true },
  { affix: "anti", meaning: "against", requiresRoot: true },
  { affix: "auto", meaning: "self", requiresRoot: true },
  { affix: "fore", meaning: "before", requiresRoot: true },
  { affix: "semi", meaning: "half", requiresRoot: true },
  { affix: "post", meaning: "after", requiresRoot: true },
  { affix: "pre", meaning: "before", requiresRoot: true },
  { affix: "mis", meaning: "wrongly", requiresRoot: true },
  { affix: "out", meaning: "beyond", requiresRoot: true },
  { affix: "non", meaning: "not", requiresRoot: true },
  { affix: "dis", meaning: "not/opposite", requiresRoot: true },
  { affix: "sub", meaning: "under", requiresRoot: true },
  { affix: "un", meaning: "not/reverse", requiresRoot: true },
  { affix: "re", meaning: "again", requiresRoot: true },
  { affix: "in", meaning: "not/in", requiresRoot: true },
  { affix: "im", meaning: "not", requiresRoot: true },
  { affix: "ir", meaning: "not", requiresRoot: true },
  { affix: "il", meaning: "not", requiresRoot: true },
  { affix: "en", meaning: "make", requiresRoot: true },
  { affix: "em", meaning: "make", requiresRoot: true },
  { affix: "de", meaning: "remove/down", requiresRoot: true },
];
