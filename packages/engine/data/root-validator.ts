// MorphemeFlow — Root Word Validator
// Validates that a stripped stem is a known English root

// Common English roots — this is a curated set of ~800 roots
// that covers the vast majority of morphologically complex words.
// This list grows over time through community contribution.
const ROOT_WORDS = new Set([
  // A
  "act", "add", "age", "agree", "aid", "aim", "allow", "amaze", "anger",
  "appear", "apply", "arm", "art", "ask", "attach", "attempt", "attract",
  // B
  "balance", "band", "base", "bear", "beat", "beauty", "behave", "believe",
  "belong", "bend", "bind", "bite", "blame", "bleed", "bless", "blind",
  "block", "blow", "board", "boil", "bold", "bomb", "bond", "bore",
  "bother", "bound", "boy", "brain", "brave", "break", "breath", "breed",
  "brief", "bright", "bring", "broad", "brother", "brush", "build", "burn",
  "burst", "busy",
  // C
  "call", "calm", "camp", "care", "carry", "catch", "cause", "center",
  "certain", "chain", "chair", "chance", "change", "charge", "charm",
  "cheap", "cheat", "check", "cheer", "child", "choice", "choose",
  "claim", "class", "clean", "clear", "climb", "close", "cloud", "cold",
  "collect", "color", "comfort", "command", "commit", "common", "compare",
  "compete", "complete", "concern", "condition", "conduct", "confess",
  "confide", "confirm", "confuse", "connect", "conscious", "consider",
  "construct", "contain", "content", "continue", "control", "convert",
  "convince", "cook", "cool", "copy", "correct", "cost", "count",
  "courage", "cover", "create", "cross", "crowd", "crush", "cry", "cure",
  "curious", "cut",
  // D
  "damage", "dance", "danger", "dare", "dark", "dead", "deal", "dear",
  "death", "debate", "decide", "declare", "decline", "deep", "defeat",
  "defend", "define", "delay", "delight", "deliver", "demand", "deny",
  "depend", "describe", "desert", "deserve", "design", "desire", "destroy",
  "detail", "determine", "develop", "devote", "differ", "difficult",
  "direct", "dirty", "discover", "discuss", "display", "distance",
  "distinct", "divide", "doubt", "draft", "drag", "draw", "dream",
  "dress", "drink", "drive", "drop", "dry", "dull", "dust", "duty",
  // E
  "eager", "earn", "earth", "ease", "eat", "edge", "edit", "educate",
  "effect", "effort", "elect", "employ", "empty", "encourage", "end",
  "enemy", "energy", "engage", "enjoy", "enter", "equal", "error",
  "escape", "establish", "even", "event", "evident", "evil", "exact",
  "examine", "example", "except", "excite", "exclude", "excuse",
  "exercise", "exist", "expand", "expect", "expense", "experience",
  "explain", "explore", "expose", "express", "extend", "extreme",
  // F
  "face", "fact", "fail", "fair", "faith", "fall", "false", "fame",
  "familiar", "family", "fancy", "farm", "fashion", "fast", "fat",
  "father", "fault", "favor", "fear", "feed", "feel", "female", "few",
  "field", "fight", "figure", "fill", "final", "find", "fine", "finish",
  "fire", "firm", "fish", "fit", "fix", "flat", "flesh", "flight",
  "float", "flood", "floor", "flow", "fly", "fold", "follow", "fond",
  "fool", "force", "foreign", "forest", "forget", "forgive", "form",
  "fortune", "found", "frame", "free", "fresh", "friend", "frighten",
  "front", "fruit", "fuel", "full", "fun", "function", "fund", "funny",
  // G
  "gain", "game", "garden", "gather", "general", "gentle", "gift",
  "glad", "glory", "glow", "goal", "gold", "good", "govern", "grace",
  "grand", "grant", "grass", "grateful", "grave", "great", "green",
  "greet", "grey", "grip", "ground", "group", "grow", "guard", "guess",
  "guide", "guilt",
  // H
  "habit", "half", "hand", "handle", "hang", "happen", "happy", "hard",
  "harm", "harvest", "hate", "head", "heal", "health", "hear", "heart",
  "heat", "heavy", "height", "help", "hide", "high", "hill", "hint",
  "hire", "hit", "hold", "hole", "hollow", "home", "honest", "honor",
  "hope", "host", "hot", "house", "humble", "humor", "hunt", "hurry",
  "hurt",
  // I
  "identify", "ignore", "imagine", "import", "impose", "impress",
  "improve", "include", "increase", "indicate", "individual", "inform",
  "inhabit", "injure", "inner", "inquire", "insert", "insist", "inspire",
  "install", "instant", "instruct", "insult", "intend", "interest",
  "interpret", "introduce", "invade", "invent", "invest", "invite",
  "involve", "iron", "isolate",
  // J
  "join", "joke", "joy", "judge", "jump", "just",
  // K
  "keen", "keep", "key", "kick", "kill", "kind", "king", "kiss", "knee",
  "knock", "know",
  // L
  "lack", "land", "large", "last", "late", "laugh", "launch", "law",
  "lay", "lead", "lean", "learn", "leave", "left", "lend", "length",
  "lesson", "level", "liberal", "lift", "light", "like", "limit", "line",
  "link", "list", "listen", "live", "load", "local", "lock", "lone",
  "long", "look", "loose", "lord", "lose", "loss", "loud", "love",
  "low", "luck",
  // M
  "machine", "magic", "main", "maintain", "major", "make", "male",
  "manage", "manner", "many", "mark", "market", "marry", "mass",
  "master", "match", "matter", "mean", "measure", "meet", "melt",
  "memory", "mend", "mental", "mention", "mercy", "mere", "merit",
  "method", "middle", "might", "mild", "mind", "mine", "minister",
  "minor", "miracle", "mirror", "miss", "mistake", "mix", "model",
  "moderate", "modern", "modest", "moment", "money", "month", "mood",
  "moral", "mother", "motion", "mount", "mourn", "move", "murder",
  "music", "mystery",
  // N
  "naked", "name", "narrow", "nation", "native", "nature", "near",
  "neat", "need", "nerve", "new", "night", "noble", "noise", "normal",
  "north", "note", "notice", "number", "nurse",
  // O
  "obey", "object", "observe", "obtain", "obvious", "occasion", "occupy",
  "occur", "offend", "offer", "open", "operate", "opinion", "oppose",
  "order", "ordinary", "organize", "origin", "other", "own",
  // P
  "pack", "page", "pain", "paint", "pair", "pale", "parent", "part",
  "particular", "partner", "pass", "passion", "past", "patient", "pattern",
  "pause", "pay", "peace", "people", "perfect", "perform", "period",
  "permit", "person", "persuade", "pick", "picture", "piece", "pity",
  "place", "plain", "plan", "plant", "play", "please", "pleasure",
  "plenty", "plot", "point", "poison", "polish", "polite", "poor",
  "popular", "port", "position", "possess", "possible", "post", "power",
  "practice", "praise", "pray", "precious", "predict", "prepare",
  "present", "preserve", "press", "pretend", "prevent", "price", "pride",
  "print", "private", "prize", "produce", "profit", "program", "progress",
  "promise", "promote", "proof", "proper", "propose", "protect", "prove",
  "provide", "public", "pull", "punish", "pure", "purpose", "push", "put",
  // Q
  "quality", "quarter", "question", "quick", "quiet", "quit", "quote",
  // R
  "race", "rage", "rain", "raise", "range", "rank", "rapid", "rare",
  "rate", "raw", "reach", "react", "read", "real", "reason", "receive",
  "recognize", "recommend", "record", "recover", "reduce", "refer",
  "reflect", "reform", "refuse", "regard", "region", "regret", "regular",
  "reject", "relate", "release", "relief", "rely", "remain", "remark",
  "remember", "remind", "remove", "rent", "repair", "repeat", "replace",
  "report", "represent", "request", "require", "rescue", "research",
  "reserve", "resist", "resolve", "resource", "respect", "respond",
  "rest", "restore", "result", "retire", "return", "reveal", "revenge",
  "review", "reward", "rich", "ride", "right", "ring", "rise", "risk",
  "rival", "road", "rock", "role", "roll", "roof", "root", "rough",
  "round", "rude", "ruin", "rule", "run", "rush",
  // S
  "sacred", "sacrifice", "sad", "safe", "sail", "salt", "same", "sand",
  "satisfy", "save", "scale", "scene", "school", "science", "score",
  "search", "season", "seat", "secret", "secure", "seek", "seem",
  "select", "sell", "send", "sense", "separate", "serious", "serve",
  "set", "settle", "shake", "shall", "shame", "shape", "share", "sharp",
  "shelter", "shift", "shine", "shock", "shoot", "short", "shout",
  "show", "shut", "sick", "sight", "sign", "signal", "silence", "silly",
  "silver", "simple", "sing", "single", "sit", "size", "skill", "skin",
  "slave", "sleep", "slide", "slight", "slip", "slow", "small", "smart",
  "smell", "smile", "smoke", "smooth", "social", "soft", "solid",
  "solve", "soon", "sort", "soul", "sound", "source", "space", "spare",
  "speak", "special", "speed", "spend", "spirit", "split", "spot",
  "spread", "spring", "stable", "staff", "stage", "stand", "standard",
  "star", "start", "state", "stay", "steady", "steal", "step", "stick",
  "stiff", "still", "stock", "stop", "store", "storm", "story",
  "straight", "strange", "strength", "stress", "stretch", "strict",
  "strike", "string", "strong", "struggle", "study", "stuff", "stupid",
  "subject", "submit", "succeed", "success", "suffer", "suggest", "suit",
  "sum", "supply", "support", "suppose", "sure", "surprise", "surround",
  "survive", "suspect", "sustain", "swear", "sweet", "swim", "swing",
  "symbol", "sympathy",
  // T
  "take", "talk", "tall", "taste", "tax", "teach", "tear", "tell",
  "temper", "tend", "term", "terrible", "test", "thank", "thick", "thin",
  "thing", "think", "thorough", "thought", "threat", "throw", "tide",
  "tie", "tight", "time", "tiny", "tire", "title", "tone", "top",
  "total", "touch", "tough", "tour", "town", "trace", "track", "trade",
  "tradition", "train", "transform", "trap", "travel", "treasure",
  "treat", "trial", "trick", "trouble", "true", "trust", "truth", "try",
  "turn", "twist", "type", "typical",
  // U
  "ugly", "understand", "union", "unique", "unit", "unite", "universe",
  "upper", "urge", "use",
  // V
  "vague", "vain", "valid", "value", "vary", "vast", "venture", "verse",
  "view", "violent", "virtue", "vision", "visit", "vital", "voice",
  "volume", "vote",
  // W
  "wage", "wait", "wake", "walk", "wall", "wander", "want", "war",
  "warm", "warn", "wash", "waste", "watch", "water", "wave", "weak",
  "wealth", "weapon", "wear", "weather", "weigh", "welcome", "well",
  "west", "wet", "wheel", "whisper", "white", "whole", "wide", "wild",
  "will", "win", "wind", "winter", "wisdom", "wise", "wish", "wit",
  "witness", "wonder", "wood", "word", "work", "world", "worry", "worse",
  "worship", "worth", "wound", "wrap", "write", "wrong",
  // Y
  "young", "youth",
]);

/**
 * Check if a string is a known English root word.
 * Tolerates minor stem changes (e.g., "happi" → "happy").
 */
export function isValidRoot(candidate: string): boolean {
  if (candidate.length < 2) return false;

  // Direct match
  if (ROOT_WORDS.has(candidate)) return true;

  // Try common stem restorations
  // "happi" → "happy" (i→y)
  if (candidate.endsWith("i")) {
    if (ROOT_WORDS.has(candidate.slice(0, -1) + "y")) return true;
  }

  // "runn" → "run" (doubled consonant)
  if (candidate.length > 2 && candidate[candidate.length - 1] === candidate[candidate.length - 2]) {
    if (ROOT_WORDS.has(candidate.slice(0, -1))) return true;
  }

  // "hop" with missing 'e' → "hope"
  if (ROOT_WORDS.has(candidate + "e")) return true;

  return false;
}

/**
 * Get the root word set size (for stats/debugging)
 */
export function getRootCount(): number {
  return ROOT_WORDS.size;
}
