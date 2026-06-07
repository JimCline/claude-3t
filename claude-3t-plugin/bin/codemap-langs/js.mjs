// JS/TS/JSX/TSX declaration patterns for codemap. [kind, regex] — first match per
// line wins, so specific declared kinds precede the generic method matcher.
export default [
  ["type", /^\s*(?:export\s+)?(?:declare\s+)?(?:interface|type|enum)\s+([A-Za-z0-9_$]+)/],
  ["class", /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)/],
  ["func", /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\*?\s+([A-Za-z0-9_$]+)/],
  ["const-fn", /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(?[^=]*\)?\s*=>/],
  ["re-export", /^\s*export\s+(?:default\s+([A-Za-z0-9_$]+)|\{)/],
  // Method: an indented `name(...) {` that is NOT a control-flow keyword.
  ["method", /^\s{2,}(?:public\s+|private\s+|protected\s+|readonly\s+|async\s+|static\s+|get\s+|set\s+|\*)*(?!(?:if|for|while|switch|catch|return|do|else|function|await|typeof|new|throw|yield|with)\b)([A-Za-z0-9_$]+)\s*\([^)]*\)\s*[:{]/],
];
