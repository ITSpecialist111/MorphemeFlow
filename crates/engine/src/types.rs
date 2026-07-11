use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum MorphemeType {
    Prefix,
    Root,
    Suffix,
    Inflection,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Tier {
    Dictionary,
    Rule,
    Syllable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Morpheme {
    pub text: String,
    pub m_type: MorphemeType,
    pub meaning: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzedWord {
    pub original: String,
    pub morphemes: Vec<Morpheme>,
    pub syllables: Vec<String>,
    pub tier: Tier,
    pub rule_applied: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum TokenType {
    Word,
    Whitespace,
    Punctuation,
    Number,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Token {
    pub text: String,
    pub token_type: TokenType,
}
