// Rust declaration patterns for codemap.
export default [
  ["fn", /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:const\s+)?(?:async\s+)?(?:unsafe\s+)?(?:extern\s+"[^"]*"\s+)?fn\s+([A-Za-z0-9_]+)/],
  ["type", /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:struct|enum|trait|union)\s+([A-Za-z0-9_]+)/],
  ["impl", /^\s*impl(?:\s*<[^>]*>)?\s+([A-Za-z0-9_:<>]+)/],
  ["macro", /^\s*macro_rules!\s+([A-Za-z0-9_]+)/],
];
