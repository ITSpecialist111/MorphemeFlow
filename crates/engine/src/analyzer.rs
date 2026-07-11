// MorphemeFlow — Morpheme Analyzer (3-tier)
// Tier 1: Dictionary lookup (37k entries)
// Tier 2: Rule-based affix stripping (recursive, depth limit 3)
// Tier 3: Syllable fallback (rule-based vowel/consonant splitting)

use crate::types::{AnalyzedWord, Morpheme, MorphemeType, Tier};
use once_cell::sync::Lazy;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};

// ── Baked data (compile-time embedded) ──────────────────

static DICT_DATA: &str = include_str!("../../../data/morpheme-dictionary/morphemes.txt");
static PREFIX_DATA: &str = include_str!("../../../data/affix-rules/prefixes.json");
static SUFFIX_DATA: &str = include_str!("../../../data/affix-rules/suffixes.json");
static ROOTS_DATA: &str = include_str!("../../../data/affix-rules/roots.txt");

// ── Dictionary ──────────────────────────────────────────

static DICTIONARY: Lazy<HashMap<String, Vec<Morpheme>>> = Lazy::new(|| {
    let mut map = HashMap::with_capacity(40_000);
    for line in DICT_DATA.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Some((word, encoded)) = line.split_once('\t') {
            let morphemes = decode_morphemes(encoded);
            map.insert(word.to_lowercase(), morphemes);
        }
    }
    map
});

fn decode_morphemes(encoded: &str) -> Vec<Morpheme> {
    encoded
        .split('|')
        .map(|part| {
            let mut iter = part.splitn(3, ':');
            let text = iter.next().unwrap_or("").to_string();
            let type_code = iter.next().unwrap_or("r");
            let meaning = iter.next().map(|s| s.to_string());
            let m_type = match type_code {
                "p" => MorphemeType::Prefix,
                "s" => MorphemeType::Suffix,
                "i" => MorphemeType::Inflection,
                _ => MorphemeType::Root,
            };
            Morpheme {
                text,
                m_type,
                meaning,
            }
        })
        .collect()
}

// ── Affix rules ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct AffixRule {
    affix: String,
    meaning: String,
    #[serde(rename = "requiresRoot")]
    #[allow(dead_code)]
    requires_root: bool,
}

static PREFIX_RULES: Lazy<Vec<AffixRule>> =
    Lazy::new(|| serde_json::from_str(PREFIX_DATA).unwrap_or_default());

static SUFFIX_RULES: Lazy<Vec<AffixRule>> =
    Lazy::new(|| serde_json::from_str(SUFFIX_DATA).unwrap_or_default());

// ── Root validator ──────────────────────────────────────

static ROOT_WORDS: Lazy<HashSet<String>> = Lazy::new(|| {
    ROOTS_DATA
        .lines()
        .map(|line| line.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .collect()
});

fn is_valid_root(candidate: &str) -> bool {
    if candidate.len() < 2 {
        return false;
    }
    let lower = candidate.to_lowercase();
    if ROOT_WORDS.contains(&lower) {
        return true;
    }
    // Stem restoration: i->y (e.g. "happi" -> "happy")
    if lower.ends_with('i') {
        let restored = format!("{}y", &lower[..lower.len() - 1]);
        if ROOT_WORDS.contains(&restored) {
            return true;
        }
    }
    // Doubled consonant (e.g. "runn" -> "run")
    let bytes = lower.as_bytes();
    if bytes.len() >= 3 && bytes[bytes.len() - 1] == bytes[bytes.len() - 2] {
        let restored = &lower[..lower.len() - 1];
        if ROOT_WORDS.contains(restored) {
            return true;
        }
    }
    // Missing 'e' (e.g. "hop" -> "hope")
    let with_e = format!("{}e", &lower);
    if ROOT_WORDS.contains(&with_e) {
        return true;
    }
    false
}

// ── Public API ──────────────────────────────────────────

#[derive(Default)]
pub struct MorphemeAnalyzer;

impl MorphemeAnalyzer {
    pub fn new() -> Self {
        MorphemeAnalyzer
    }

    /// Analyze a single word into its morphemes.
    pub fn analyze(&self, word: &str) -> AnalyzedWord {
        // Skip very short words
        if word.len() < 3 {
            return AnalyzedWord {
                original: word.to_string(),
                morphemes: vec![Morpheme {
                    text: word.to_string(),
                    m_type: MorphemeType::Root,
                    meaning: None,
                }],
                syllables: vec![word.to_string()],
                tier: Tier::Syllable,
                rule_applied: None,
            };
        }

        // Strip punctuation edges
        let (leading, core, trailing) = split_word_edges(word);
        let core_lower = core.to_lowercase();

        // Tier 1: Dictionary lookup
        if let Some(dict_morphemes) = DICTIONARY.get(&core_lower) {
            let mut morphemes = Vec::new();
            if !leading.is_empty() {
                morphemes.push(Morpheme {
                    text: leading.to_string(),
                    m_type: MorphemeType::Root,
                    meaning: None,
                });
            }
            // Dictionary entries contain lexical stems (for example,
            // relate + ion) that may not concatenate to the visible spelling
            // (relation). Project those boundaries onto the exact source so
            // enhancement can never change the user's text.
            let abstract_parts: Vec<String> =
                dict_morphemes.iter().map(|m| m.text.clone()).collect();
            let surface_parts = project_segments_to_surface(core, &abstract_parts);
            for (dm, original_text) in dict_morphemes.iter().zip(surface_parts) {
                if original_text.is_empty() {
                    continue;
                }
                morphemes.push(Morpheme {
                    text: original_text,
                    m_type: dm.m_type.clone(),
                    meaning: dm.meaning.clone(),
                });
            }
            if !trailing.is_empty() {
                morphemes.push(Morpheme {
                    text: trailing.to_string(),
                    m_type: MorphemeType::Root,
                    meaning: None,
                });
            }
            let syllables = surface_syllables(core, &core_lower);
            return AnalyzedWord {
                original: word.to_string(),
                morphemes,
                syllables,
                tier: Tier::Dictionary,
                rule_applied: None,
            };
        }

        // Tier 2: Rule-based affix stripping
        if let Some((morphemes, rule)) = rule_based_parse(&core_lower, core, 0) {
            let mut all = Vec::new();
            if !leading.is_empty() {
                all.push(Morpheme {
                    text: leading.to_string(),
                    m_type: MorphemeType::Root,
                    meaning: None,
                });
            }
            all.extend(morphemes);
            if !trailing.is_empty() {
                all.push(Morpheme {
                    text: trailing.to_string(),
                    m_type: MorphemeType::Root,
                    meaning: None,
                });
            }
            let syllables = surface_syllables(core, &core_lower);
            return AnalyzedWord {
                original: word.to_string(),
                morphemes: all,
                syllables,
                tier: Tier::Rule,
                rule_applied: Some(rule),
            };
        }

        // Tier 3: Syllable fallback
        let syllables = surface_syllables(core, &core_lower);
        let mut morphemes: Vec<Morpheme> = syllables
            .iter()
            .map(|s| Morpheme {
                text: s.clone(),
                m_type: MorphemeType::Root,
                meaning: None,
            })
            .collect();

        if !leading.is_empty() {
            morphemes.insert(
                0,
                Morpheme {
                    text: leading.to_string(),
                    m_type: MorphemeType::Root,
                    meaning: None,
                },
            );
        }
        if !trailing.is_empty() {
            morphemes.push(Morpheme {
                text: trailing.to_string(),
                m_type: MorphemeType::Root,
                meaning: None,
            });
        }

        AnalyzedWord {
            original: word.to_string(),
            morphemes,
            syllables,
            tier: Tier::Syllable,
            rule_applied: None,
        }
    }

    /// Get the number of entries in the dictionary.
    pub fn dictionary_size(&self) -> usize {
        DICTIONARY.len()
    }
}

// ── Rule-based parsing ──────────────────────────────────

fn rule_based_parse(word: &str, original: &str, depth: usize) -> Option<(Vec<Morpheme>, String)> {
    if depth >= 3 || word.len() < 4 {
        return None;
    }

    let mut rules_applied = Vec::new();
    let mut prefix_morphemes = Vec::new();
    let mut suffix_morphemes = Vec::new();
    let mut remaining = word.to_string();
    let mut orig_start = 0;
    let mut orig_end = original.len();

    // Strip prefix (longest-first, already sorted in data)
    for rule in PREFIX_RULES.iter() {
        if remaining.starts_with(&rule.affix) && remaining.len() > rule.affix.len() + 2 {
            let affix_len = rule.affix.len();
            prefix_morphemes.push(Morpheme {
                text: original[orig_start..orig_start + affix_len].to_string(),
                m_type: MorphemeType::Prefix,
                meaning: Some(rule.meaning.clone()),
            });
            remaining = remaining[affix_len..].to_string();
            orig_start += affix_len;
            rules_applied.push(format!("prefix:{}", rule.affix));
            break;
        }
    }

    // Strip suffix (longest-first, already sorted in data)
    for rule in SUFFIX_RULES.iter() {
        if remaining.ends_with(&rule.affix) && remaining.len() > rule.affix.len() + 2 {
            let affix_len = rule.affix.len();
            let suffix_start = remaining.len() - affix_len;
            suffix_morphemes.push(Morpheme {
                text: original[orig_end - affix_len..orig_end].to_string(),
                m_type: MorphemeType::Suffix,
                meaning: Some(rule.meaning.clone()),
            });
            let root_part = &remaining[..suffix_start];
            remaining = apply_stem_change(root_part, &rule.affix);
            orig_end -= affix_len;
            rules_applied.push(format!("suffix:{}", rule.affix));
            break;
        }
    }

    if rules_applied.is_empty() {
        return None;
    }

    // Validate root
    if is_valid_root(&remaining) {
        let mut morphemes = prefix_morphemes;
        morphemes.push(Morpheme {
            text: original[orig_start..orig_end].to_string(),
            m_type: MorphemeType::Root,
            meaning: None,
        });
        morphemes.extend(suffix_morphemes);
        return Some((morphemes, rules_applied.join("+")));
    }

    // Try dictionary lookup on remaining
    if let Some(dict_morphemes) = DICTIONARY.get(&remaining) {
        let mut morphemes = prefix_morphemes;
        let orig_root = &original[orig_start..orig_end];
        let mut pos = 0;
        for dm in dict_morphemes {
            let len = dm.text.len();
            let text = if pos + len <= orig_root.len() {
                orig_root[pos..pos + len].to_string()
            } else {
                dm.text.clone()
            };
            morphemes.push(Morpheme {
                text,
                m_type: dm.m_type.clone(),
                meaning: dm.meaning.clone(),
            });
            pos += len;
        }
        morphemes.extend(suffix_morphemes);
        rules_applied.push("dict-root".to_string());
        return Some((morphemes, rules_applied.join("+")));
    }

    // Recursive decomposition on remaining
    let orig_remaining = &original[orig_start..orig_end];
    if let Some((inner_morphemes, inner_rule)) =
        rule_based_parse(&remaining, orig_remaining, depth + 1)
    {
        let mut morphemes = prefix_morphemes;
        morphemes.extend(inner_morphemes);
        morphemes.extend(suffix_morphemes);
        rules_applied.push(inner_rule);
        return Some((morphemes, rules_applied.join("+")));
    }

    None
}

fn apply_stem_change(root: &str, suffix: &str) -> String {
    match suffix {
        "ness" | "ly" => {
            if let Some(stem) = root.strip_suffix('i') {
                return format!("{}y", stem);
            }
            root.to_string()
        }
        "ing" | "ed" => {
            let bytes = root.as_bytes();
            if bytes.len() >= 3
                && bytes[bytes.len() - 1] == bytes[bytes.len() - 2]
                && !is_vowel(bytes[bytes.len() - 1] as char)
            {
                return root[..root.len() - 1].to_string();
            }
            root.to_string()
        }
        _ => root.to_string(),
    }
}

// ── Syllable splitter (rule-based) ──────────────────────

fn is_vowel(c: char) -> bool {
    matches!(c.to_ascii_lowercase(), 'a' | 'e' | 'i' | 'o' | 'u' | 'y')
}

pub fn syllable_split(word: &str) -> Vec<String> {
    if word.len() <= 3 {
        return vec![word.to_string()];
    }

    let chars: Vec<char> = word.chars().collect();
    let mut breaks = Vec::new();
    let mut i = 1;

    while i < chars.len() - 1 {
        let prev_vowel = is_vowel(chars[i - 1]);
        let curr_consonant = !is_vowel(chars[i]);
        let next_vowel = i + 1 < chars.len() && is_vowel(chars[i + 1]);

        if prev_vowel && curr_consonant && next_vowel {
            // V-CV pattern: split before consonant
            breaks.push(i);
            i += 2;
        } else if prev_vowel
            && curr_consonant
            && i + 2 < chars.len()
            && !is_vowel(chars[i + 1])
            && is_vowel(chars[i + 2])
        {
            // VC-CV pattern: split between consonants
            breaks.push(i + 1);
            i += 3;
        } else {
            i += 1;
        }
    }

    if breaks.is_empty() {
        return vec![word.to_string()];
    }

    let mut syllables: Vec<String> = Vec::new();
    let mut start = 0;
    for &brk in &breaks {
        if brk > start {
            syllables.push(chars[start..brk].iter().collect());
        }
        start = brk;
    }
    if start < chars.len() {
        syllables.push(chars[start..].iter().collect());
    }

    // Merge very short trailing syllables
    let mut merged: Vec<String> = Vec::new();
    for s in syllables {
        if merged.is_empty() || s.len() > 1 {
            merged.push(s);
        } else if let Some(last) = merged.last_mut() {
            last.push_str(&s);
        }
    }

    if merged.is_empty() {
        vec![word.to_string()]
    } else {
        merged
    }
}

fn surface_syllables(surface: &str, normalized: &str) -> Vec<String> {
    let abstract_syllables = syllable_split(normalized);
    project_segments_to_surface(surface, &abstract_syllables)
        .into_iter()
        .filter(|part| !part.is_empty())
        .collect()
}

/// Align normalized linguistic segments to the exact spelling supplied by
/// the user. A small edit-distance alignment handles stem changes and
/// allomorphs while preserving case, apostrophes, and hyphens losslessly.
fn project_segments_to_surface(surface: &str, segments: &[String]) -> Vec<String> {
    let surface_chars: Vec<char> = surface.chars().collect();
    let source_letters: Vec<char> = surface_chars
        .iter()
        .copied()
        .filter(|c| c.is_alphabetic())
        .flat_map(char::to_lowercase)
        .collect();
    let analyzed: Vec<(char, usize)> = segments
        .iter()
        .enumerate()
        .flat_map(|(part_index, segment)| {
            segment
                .chars()
                .filter(|c| c.is_alphabetic())
                .flat_map(char::to_lowercase)
                .map(move |c| (c, part_index))
        })
        .collect();

    if segments.is_empty() {
        return Vec::new();
    }
    if source_letters.is_empty() || analyzed.is_empty() {
        let mut projected = vec![String::new(); segments.len()];
        projected[0] = surface.to_string();
        return projected;
    }

    let rows = analyzed.len() + 1;
    let cols = source_letters.len() + 1;
    let mut distances = vec![vec![0usize; cols]; rows];
    for (row, values) in distances.iter_mut().enumerate() {
        values[0] = row;
    }
    for col in 0..cols {
        distances[0][col] = col;
    }

    for row in 1..rows {
        for col in 1..cols {
            let substitution = distances[row - 1][col - 1]
                + usize::from(analyzed[row - 1].0 != source_letters[col - 1]);
            let deletion = distances[row - 1][col] + 1;
            let insertion = distances[row][col - 1] + 1;
            distances[row][col] = substitution.min(deletion).min(insertion);
        }
    }

    let mut alignment: Vec<(usize, Option<usize>)> = Vec::new();
    let mut row = analyzed.len();
    let mut col = source_letters.len();
    while row > 0 || col > 0 {
        let substitution = if row > 0 && col > 0 {
            distances[row - 1][col - 1]
                + usize::from(analyzed[row - 1].0 != source_letters[col - 1])
        } else {
            usize::MAX
        };

        if row > 0 && col > 0 && distances[row][col] == substitution {
            alignment.push((col - 1, Some(analyzed[row - 1].1)));
            row -= 1;
            col -= 1;
        } else if row > 0 && distances[row][col] == distances[row - 1][col] + 1 {
            row -= 1;
        } else {
            alignment.push((col - 1, None));
            col -= 1;
        }
    }
    alignment.reverse();

    let mut letter_parts = vec![0usize; source_letters.len()];
    let mut previous_part = None;
    for (index, (source_index, part_index)) in alignment.iter().copied().enumerate() {
        if let Some(part_index) = part_index {
            letter_parts[source_index] = part_index;
            previous_part = Some(part_index);
        } else {
            let next_part = alignment[index + 1..]
                .iter()
                .find_map(|(_, candidate)| *candidate);
            letter_parts[source_index] = previous_part.or(next_part).unwrap_or(0);
        }
    }

    let mut projected = vec![String::new(); segments.len()];
    let mut letter_index = 0usize;
    let mut active_part = 0usize;
    for c in surface_chars {
        if c.is_alphabetic() {
            active_part = letter_parts
                .get(letter_index)
                .copied()
                .unwrap_or(active_part);
            letter_index += c.to_lowercase().count();
        }
        projected[active_part].push(c);
    }
    projected
}

// ── Utility ─────────────────────────────────────────────

fn split_word_edges(word: &str) -> (&str, &str, &str) {
    let mut start = 0usize;
    let mut end = word.len();

    while start < end {
        let ch = word[start..].chars().next().unwrap_or_default();
        if ch.is_alphanumeric() || ch == '\'' {
            break;
        }
        start += ch.len_utf8();
    }

    while end > start {
        let ch = word[..end].chars().next_back().unwrap_or_default();
        if ch.is_alphanumeric() || ch == '\'' {
            break;
        }
        end -= ch.len_utf8();
    }

    (&word[..start], &word[start..end], &word[end..])
}

// ── Tests ───────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dictionary_loads() {
        let analyzer = MorphemeAnalyzer::new();
        assert!(
            analyzer.dictionary_size() > 30_000,
            "dict has {} entries",
            analyzer.dictionary_size()
        );
    }

    #[test]
    fn tier1_dictionary_lookup() {
        let analyzer = MorphemeAnalyzer::new();
        let result = analyzer.analyze("helpful");
        assert_eq!(result.tier, Tier::Dictionary);
        assert!(result.morphemes.len() >= 2);
    }

    #[test]
    fn tier1_dictionary_with_meaning() {
        let analyzer = MorphemeAnalyzer::new();
        let result = analyzer.analyze("reconstruction");
        assert_eq!(result.tier, Tier::Dictionary);
        let has_meaning = result.morphemes.iter().any(|m| m.meaning.is_some());
        assert!(has_meaning, "dictionary entries should have meanings");
    }

    #[test]
    fn tier3_syllable_fallback() {
        let analyzer = MorphemeAnalyzer::new();
        let result = analyzer.analyze("zygomorphic");
        assert!(result.syllables.len() >= 2);
    }

    #[test]
    fn splits_common_prefix_root_suffix() {
        let analyzer = MorphemeAnalyzer::new();
        let result = analyzer.analyze("reconstruction");
        let types: Vec<_> = result.morphemes.iter().map(|m| &m.m_type).collect();
        assert!(
            types.contains(&&MorphemeType::Prefix),
            "expected prefix morpheme in {:?}",
            result.morphemes
        );
    }

    #[test]
    fn preserves_punctuation_edges() {
        let analyzer = MorphemeAnalyzer::new();
        let result = analyzer.analyze("\"rebuild,\"");
        let first_text = &result.morphemes[0].text;
        let last_text = &result.morphemes.last().unwrap().text;
        assert!(
            first_text.starts_with('"'),
            "expected leading quote, got {:?}",
            first_text
        );
        assert!(
            last_text.ends_with('"'),
            "expected trailing quote, got {:?}",
            last_text
        );
    }

    #[test]
    fn short_word_passthrough() {
        let analyzer = MorphemeAnalyzer::new();
        let result = analyzer.analyze("it");
        assert_eq!(result.morphemes.len(), 1);
        assert_eq!(result.morphemes[0].text, "it");
    }

    #[test]
    fn syllable_split_basic() {
        let syllables = syllable_split("understand");
        assert!(
            syllables.len() >= 2,
            "expected >=2 syllables, got {:?}",
            syllables
        );
    }

    #[test]
    fn syllable_split_short() {
        let syllables = syllable_split("cat");
        assert_eq!(syllables.len(), 1);
    }

    #[test]
    fn analyze_multiple_words() {
        let analyzer = MorphemeAnalyzer::new();
        let words = [
            "running",
            "beautiful",
            "unexpected",
            "disagreement",
            "helpful",
        ];
        for word in &words {
            let result = analyzer.analyze(word);
            assert!(
                !result.morphemes.is_empty(),
                "word '{}' should have morphemes",
                word
            );
        }
    }

    #[test]
    fn preserves_surface_text_across_analysis_tiers() {
        let analyzer = MorphemeAnalyzer::new();
        for word in [
            "RECONSTRUCTION",
            "UnFoRtUnAtElY",
            "RUNNING",
            "ZyGoMoRpHiC",
            "well-known",
            "don't",
            "\"rebuild,\"",
        ] {
            let result = analyzer.analyze(word);
            let reconstructed: String = result.morphemes.iter().map(|m| m.text.as_str()).collect();
            assert_eq!(reconstructed, word, "failed to reconstruct {word}");
        }
    }

    #[test]
    fn preserves_surface_text_in_syllables() {
        let analyzer = MorphemeAnalyzer::new();
        for word in ["RECONSTRUCTION", "ZyGoMoRpHiC", "well-known", "don't"] {
            let result = analyzer.analyze(word);
            assert_eq!(
                result.syllables.concat(),
                word,
                "failed to reconstruct {word}"
            );
        }
    }
}
