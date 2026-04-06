#[derive(Debug, Clone, PartialEq)]
pub enum MorphemeType {
    Prefix,
    Root,
    Suffix,
    Unknown,
}

#[derive(Debug, Clone)]
pub struct Morpheme {
    pub text: String,
    pub m_type: MorphemeType,
    pub is_syllable: bool,
}

#[derive(Debug, Clone)]
pub struct AnalyzedWord {
    pub original: String,
    pub morphemes: Vec<Morpheme>,
}