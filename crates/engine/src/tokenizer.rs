pub struct Tokenizer;

impl Tokenizer {
    pub fn new() -> Self {
        Tokenizer {}
    }

    /// Splits text into word and non-word tokens
    pub fn tokenize(&self, text: &str) -> Vec<String> {
        // A simple baseline tokenizer that splits by whitespace/punctuation
        text.split_whitespace().map(|s| s.to_string()).collect()
    }
}
