// MorphemeFlow — LRU Word Cache
// Caches morpheme analysis results for performance.

use crate::types::AnalyzedWord;
use lru::LruCache;
use std::num::NonZeroUsize;

pub struct WordCache {
    cache: LruCache<String, AnalyzedWord>,
    hits: u64,
    misses: u64,
}

impl WordCache {
    pub fn new(capacity: usize) -> Self {
        WordCache {
            cache: LruCache::new(
                NonZeroUsize::new(capacity).unwrap_or(NonZeroUsize::new(1).unwrap()),
            ),
            hits: 0,
            misses: 0,
        }
    }

    pub fn get(&mut self, word: &str) -> Option<&AnalyzedWord> {
        let key = word.to_lowercase();
        if self.cache.get(&key).is_some() {
            self.hits += 1;
            self.cache.get(&key)
        } else {
            self.misses += 1;
            None
        }
    }

    pub fn put(&mut self, word: &str, result: AnalyzedWord) {
        self.cache.put(word.to_lowercase(), result);
    }

    pub fn len(&self) -> usize {
        self.cache.len()
    }

    pub fn is_empty(&self) -> bool {
        self.cache.is_empty()
    }

    pub fn hit_rate(&self) -> f64 {
        let total = self.hits + self.misses;
        if total == 0 {
            0.0
        } else {
            self.hits as f64 / total as f64
        }
    }

    pub fn clear(&mut self) {
        self.cache.clear();
        self.hits = 0;
        self.misses = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Morpheme, MorphemeType, Tier};

    fn make_result(word: &str) -> AnalyzedWord {
        AnalyzedWord {
            original: word.to_string(),
            morphemes: vec![Morpheme {
                text: word.to_string(),
                m_type: MorphemeType::Root,
                meaning: None,
            }],
            syllables: vec![word.to_string()],
            tier: Tier::Syllable,
            rule_applied: None,
        }
    }

    #[test]
    fn basic_cache_operations() {
        let mut cache = WordCache::new(100);
        assert!(cache.is_empty());

        cache.put("hello", make_result("hello"));
        assert_eq!(cache.len(), 1);
        assert!(cache.get("hello").is_some());
        assert!(cache.get("world").is_none());
    }

    #[test]
    fn lru_eviction() {
        let mut cache = WordCache::new(2);
        cache.put("a", make_result("a"));
        cache.put("b", make_result("b"));
        cache.put("c", make_result("c")); // evicts "a"
        assert!(cache.get("a").is_none());
        assert!(cache.get("b").is_some());
        assert!(cache.get("c").is_some());
    }

    #[test]
    fn hit_rate_tracking() {
        let mut cache = WordCache::new(100);
        cache.put("hello", make_result("hello"));
        cache.get("hello"); // hit
        cache.get("world"); // miss
        assert!((cache.hit_rate() - 0.5).abs() < 0.01);
    }

    #[test]
    fn case_insensitive() {
        let mut cache = WordCache::new(100);
        cache.put("Hello", make_result("Hello"));
        assert!(cache.get("hello").is_some());
        assert!(cache.get("HELLO").is_some());
    }
}
