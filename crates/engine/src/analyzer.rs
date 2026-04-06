use crate::types::*;

pub struct MorphemeAnalyzer {
    prefixes: &'static [&'static str],
    suffixes: &'static [&'static str],
}

impl MorphemeAnalyzer {
    pub fn new() -> Self {
        MorphemeAnalyzer {
            prefixes: &[
                "anti", "auto", "counter", "de", "dis", "extra", "hyper", "inter", "micro",
                "mis", "multi", "non", "over", "post", "pre", "re", "semi", "sub", "trans",
                "ultra", "un", "under",
            ],
            suffixes: &[
                "ability", "able", "ably", "ance", "ation", "ative", "ed", "en", "er", "est",
                "ful", "hood", "ible", "ing", "ion", "ise", "ism", "ist", "ity", "ize", "less",
                "ly", "ment", "ness", "ous", "s", "ship", "tion", "ward", "y",
            ],
        }
    }

    /// Analyzes a single word into constituent morphemes or syllables
    pub fn analyze(&self, word: &str) -> AnalyzedWord {
        if word.trim().is_empty() {
            return self.unknown(word);
        }

        let (leading_punct, core_word, trailing_punct) = split_word_edges(word);
        if core_word.len() < 3 {
            return self.unknown(word);
        }

        let lower_core = core_word.to_ascii_lowercase();
        let mut start = 0usize;
        let mut end = core_word.len();
        let mut morphemes = Vec::<Morpheme>::new();

        if let Some(prefix) = longest_matching_prefix(&lower_core, self.prefixes) {
            if core_word.len().saturating_sub(prefix.len()) >= 3 {
                let end_index = prefix.len();
                morphemes.push(Morpheme {
                    text: core_word[..end_index].to_string(),
                    m_type: MorphemeType::Prefix,
                    is_syllable: false,
                });
                start = end_index;
            }
        }

        let remaining = &lower_core[start..end];
        if let Some(suffix) = longest_matching_suffix(remaining, self.suffixes) {
            if remaining.len().saturating_sub(suffix.len()) >= 3 {
                end = end.saturating_sub(suffix.len());
            }
        }

        if start < end {
            morphemes.push(Morpheme {
                text: core_word[start..end].to_string(),
                m_type: MorphemeType::Root,
                is_syllable: false,
            });
        }

        if end < core_word.len() {
            morphemes.push(Morpheme {
                text: core_word[end..].to_string(),
                m_type: MorphemeType::Suffix,
                is_syllable: false,
            });
        }

        if morphemes.is_empty() {
            return self.unknown(word);
        }

        if !leading_punct.is_empty() {
            morphemes.insert(
                0,
                Morpheme {
                    text: leading_punct.to_string(),
                    m_type: MorphemeType::Unknown,
                    is_syllable: false,
                },
            );
        }

        if !trailing_punct.is_empty() {
            morphemes.push(Morpheme {
                text: trailing_punct.to_string(),
                m_type: MorphemeType::Unknown,
                is_syllable: false,
            });
        }

        AnalyzedWord {
            original: word.to_string(),
            morphemes,
        }
    }

    fn unknown(&self, word: &str) -> AnalyzedWord {
        AnalyzedWord {
            original: word.to_string(),
            morphemes: vec![Morpheme {
                text: word.to_string(),
                m_type: MorphemeType::Unknown,
                is_syllable: false,
            }],
        }
    }
}

fn split_word_edges(word: &str) -> (&str, &str, &str) {
    let bytes = word.as_bytes();
    let mut start = 0usize;
    let mut end = bytes.len();

    while start < end {
        let ch = word[start..].chars().next().unwrap_or_default();
        if ch.is_alphanumeric() || ch == '\'' {
            break;
        }
        start += ch.len_utf8();
    }

    while start < end {
        let ch = word[..end].chars().next_back().unwrap_or_default();
        if ch.is_alphanumeric() || ch == '\'' {
            break;
        }
        end = end.saturating_sub(ch.len_utf8());
    }

    (&word[..start], &word[start..end], &word[end..])
}

fn longest_matching_prefix<'a>(word: &str, prefixes: &'a [&str]) -> Option<&'a str> {
    prefixes
        .iter()
        .copied()
        .filter(|prefix| word.starts_with(prefix))
        .max_by_key(|prefix| prefix.len())
}

fn longest_matching_suffix<'a>(word: &str, suffixes: &'a [&str]) -> Option<&'a str> {
    suffixes
        .iter()
        .copied()
        .filter(|suffix| word.ends_with(suffix))
        .max_by_key(|suffix| suffix.len())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_common_prefix_root_suffix() {
        let analyzer = MorphemeAnalyzer::new();
        let analyzed = analyzer.analyze("unhelpful");
        let parts: Vec<(String, MorphemeType)> = analyzed
            .morphemes
            .iter()
            .map(|m| (m.text.clone(), m.m_type.clone()))
            .collect();

        assert_eq!(
            parts,
            vec![
                ("un".to_string(), MorphemeType::Prefix),
                ("help".to_string(), MorphemeType::Root),
                ("ful".to_string(), MorphemeType::Suffix),
            ]
        );
    }

    #[test]
    fn preserves_punctuation_edges() {
        let analyzer = MorphemeAnalyzer::new();
        let analyzed = analyzer.analyze("\"rebuild,\"");
        let text_parts: Vec<String> = analyzed.morphemes.iter().map(|m| m.text.clone()).collect();
        assert_eq!(
            text_parts,
            vec![
                "\"".to_string(),
                "re".to_string(),
                "build".to_string(),
                ",\"".to_string()
            ]
        );
    }
}
