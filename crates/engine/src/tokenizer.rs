// MorphemeFlow — Tokenizer
// Splits text into typed tokens: words, whitespace, punctuation, numbers.

use crate::types::{Token, TokenType};

#[derive(Default)]
pub struct Tokenizer;

impl Tokenizer {
    pub fn new() -> Self {
        Tokenizer
    }

    /// Splits text into typed tokens preserving all characters.
    pub fn tokenize(&self, text: &str) -> Vec<Token> {
        let mut tokens = Vec::new();
        let chars: Vec<char> = text.chars().collect();
        let mut i = 0;

        while i < chars.len() {
            let c = chars[i];

            if c.is_whitespace() {
                // Whitespace run
                let start = i;
                while i < chars.len() && chars[i].is_whitespace() {
                    i += 1;
                }
                tokens.push(Token {
                    text: chars[start..i].iter().collect(),
                    token_type: TokenType::Whitespace,
                });
            } else if c.is_ascii_digit() {
                // Number (digits, dots, commas within digits)
                let start = i;
                while i < chars.len()
                    && (chars[i].is_ascii_digit()
                        || ((chars[i] == '.' || chars[i] == ',')
                            && i + 1 < chars.len()
                            && chars[i + 1].is_ascii_digit()))
                {
                    i += 1;
                }
                tokens.push(Token {
                    text: chars[start..i].iter().collect(),
                    token_type: TokenType::Number,
                });
            } else if c.is_alphabetic() || c == '\'' {
                // Word (letters, apostrophes for contractions, hyphens between letters)
                let start = i;
                while i < chars.len() {
                    let ch = chars[i];
                    if ch.is_alphabetic() || ch == '\'' {
                        i += 1;
                    } else if ch == '-' && i + 1 < chars.len() && chars[i + 1].is_alphabetic() {
                        // Hyphenated word
                        i += 1;
                    } else {
                        break;
                    }
                }
                tokens.push(Token {
                    text: chars[start..i].iter().collect(),
                    token_type: TokenType::Word,
                });
            } else {
                // Punctuation / other
                tokens.push(Token {
                    text: c.to_string(),
                    token_type: TokenType::Punctuation,
                });
                i += 1;
            }
        }

        tokens
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn basic_sentence() {
        let tokenizer = Tokenizer::new();
        let tokens = tokenizer.tokenize("Hello world!");
        assert_eq!(tokens.len(), 4); // Hello, space, world, !
        assert_eq!(tokens[0].token_type, TokenType::Word);
        assert_eq!(tokens[0].text, "Hello");
        assert_eq!(tokens[1].token_type, TokenType::Whitespace);
        assert_eq!(tokens[2].token_type, TokenType::Word);
        assert_eq!(tokens[2].text, "world");
        assert_eq!(tokens[3].token_type, TokenType::Punctuation);
    }

    #[test]
    fn contractions() {
        let tokenizer = Tokenizer::new();
        let tokens = tokenizer.tokenize("don't");
        assert_eq!(tokens.len(), 1);
        assert_eq!(tokens[0].text, "don't");
        assert_eq!(tokens[0].token_type, TokenType::Word);
    }

    #[test]
    fn hyphenated_word() {
        let tokenizer = Tokenizer::new();
        let tokens = tokenizer.tokenize("well-known");
        assert_eq!(tokens.len(), 1);
        assert_eq!(tokens[0].text, "well-known");
        assert_eq!(tokens[0].token_type, TokenType::Word);
    }

    #[test]
    fn numbers() {
        let tokenizer = Tokenizer::new();
        let tokens = tokenizer.tokenize("3.14 and 1,000");
        let nums: Vec<_> = tokens
            .iter()
            .filter(|t| t.token_type == TokenType::Number)
            .collect();
        assert_eq!(nums.len(), 2);
        assert_eq!(nums[0].text, "3.14");
        assert_eq!(nums[1].text, "1,000");
    }

    #[test]
    fn reconstruction() {
        let tokenizer = Tokenizer::new();
        let tokens = tokenizer.tokenize("Hello, world!");
        let reconstructed: String = tokens.iter().map(|t| t.text.as_str()).collect();
        assert_eq!(reconstructed, "Hello, world!");
    }

    #[test]
    fn empty_input() {
        let tokenizer = Tokenizer::new();
        let tokens = tokenizer.tokenize("");
        assert!(tokens.is_empty());
    }
}
