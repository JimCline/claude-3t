#!/usr/bin/env node
// claude-3t codemap — deterministic structural map of source files.
//
// THE PROBLEM IT TARGETS. The largest token sink in a working 3t session is not
// the protocol or the memory files — it is reading CODE for orientation: "what's
// in these files, what are the signatures, where does X live." Whether the
// executor reads them or a Haiku recon-read does, full file bodies enter some
// context window. For the orientation question specifically, the bodies are
// waste — only the shape (declarations + line numbers) is needed.
//
// This script extracts that shape with regex (no ctags dependency — grep-class
// patterns per language), so neither tier reads full files just to learn the
// structure. Use it to answer "what's here / where is X"; fall back to a real
// read only when the BODY of a specific unit actually matters.
//
// Usage:
//   node bin/codemap.mjs <file|dir> [more...]   # map files / recurse dirs
//   node bin/codemap.mjs --measure <dir>        # also print tokens-saved vs full read
//
// Output per file: a path header, then `Lnnn  kind  name` lines. Compact and
// deterministic — same input, same output (safe to cache / diff).
//
// EXPERIMENT RESULT (measured with --measure, ~4 chars/token):
//   Python  honcho/src         119 files  324,869 → 11,997 tok   (4%)
//   TS      honcho/mcp/src       9 files   11,178 →    274 tok   (2%)
// Verdict: PASS on declaration-rich code — a real read costs 25–50× the codemap
// for the same orientation. CAVEAT: on imperative script files with few
// declarations (e.g. these hooks) the map is nearly empty — it is small because
// there is little structure to extract, not because it distilled well. Use it for
// "what's defined / where is X" on real modules; read bodies when they matter.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";

const tok = (s) => Math.round(s.length / 4);

// Per-extension declaration patterns. Each entry: [kind, regex with one capture].
// Patterns are intentionally line-oriented and conservative — better to miss an
// exotic declaration than to emit noise. Order matters only for labeling.
const LANGS = {
  // Order matters: the first matching pattern wins (one symbol per line), so the
  // specific declared kinds come before the generic method matcher.
  js: [
    ["type", /^\s*(?:export\s+)?(?:declare\s+)?(?:interface|type|enum)\s+([A-Za-z0-9_$]+)/],
    ["class", /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)/],
    ["func", /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\*?\s+([A-Za-z0-9_$]+)/],
    ["const-fn", /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(?[^=]*\)?\s*=>/],
    ["re-export", /^\s*export\s+(?:default\s+([A-Za-z0-9_$]+)|\{)/],
    // Method: an indented `name(...) {` that is NOT a control-flow keyword.
    ["method", /^\s{2,}(?:public\s+|private\s+|protected\s+|readonly\s+|async\s+|static\s+|get\s+|set\s+|\*)*(?!(?:if|for|while|switch|catch|return|do|else|function|await|typeof|new|throw|yield|with)\b)([A-Za-z0-9_$]+)\s*\([^)]*\)\s*[:{]/],
  ],
  py: [
    ["class", /^\s*class\s+([A-Za-z0-9_]+)/],
    ["def", /^\s*(?:async\s+)?def\s+([A-Za-z0-9_]+)/],
  ],
  go: [
    ["func", /^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z0-9_]+)/],
    ["type", /^\s*type\s+([A-Za-z0-9_]+)/],
  ],
  rs: [
    ["fn", /^\s*(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)/],
    ["type", /^\s*(?:pub\s+)?(?:struct|enum|trait)\s+([A-Za-z0-9_]+)/],
    ["impl", /^\s*impl(?:\s*<[^>]*>)?\s+([A-Za-z0-9_:<>]+)/],
  ],
  cs: [
    ["type", /^\s*(?:public|private|internal|protected|abstract|sealed|static|partial|\s)*(?:class|interface|struct|enum|record)\s+([A-Za-z0-9_<>]+)/],
    ["method", /^\s*(?:public|private|internal|protected|static|virtual|override|async|\s)+[A-Za-z0-9_<>\[\],.?]+\s+([A-Za-z0-9_]+)\s*\(/],
  ],
  java: [
    ["type", /^\s*(?:public|private|protected|abstract|final|static|\s)*(?:class|interface|enum|record)\s+([A-Za-z0-9_<>]+)/],
    ["method", /^\s*(?:public|private|protected|static|final|synchronized|abstract|\s)+[A-Za-z0-9_<>\[\],.?]+\s+([A-Za-z0-9_]+)\s*\(/],
  ],
  rb: [
    ["class", /^\s*(?:class|module)\s+([A-Za-z0-9_:]+)/],
    ["def", /^\s*def\s+([A-Za-z0-9_.?!]+)/],
  ],
};

const EXT_MAP = {
  ".js": "js", ".mjs": "js", ".cjs": "js", ".jsx": "js", ".ts": "js", ".tsx": "js",
  ".py": "py", ".go": "go", ".rs": "rs", ".cs": "cs", ".java": "java", ".rb": "rb",
};

const SKIP_DIR = new Set(["node_modules", ".git", "dist", "build", "bin", "obj", "target", ".next", "vendor"]);

function* walk(path) {
  let st;
  try {
    st = statSync(path);
  } catch {
    return;
  }
  if (st.isDirectory()) {
    if (SKIP_DIR.has(path.split("/").pop())) return;
    for (const e of readdirSync(path).sort()) yield* walk(join(path, e));
  } else if (EXT_MAP[extname(path)]) {
    yield path;
  }
}

function mapFile(path) {
  const lang = EXT_MAP[extname(path)];
  const patterns = LANGS[lang];
  let src;
  try {
    src = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  const lines = src.split("\n");
  const syms = [];
  const seen = new Set();
  lines.forEach((line, i) => {
    if (line.length > 400) return; // skip minified / data lines
    for (const [kind, re] of patterns) {
      const m = line.match(re);
      if (m && m[1]) {
        const key = i + ":" + m[1];
        if (seen.has(key)) continue;
        seen.add(key);
        syms.push(`L${String(i + 1).padStart(4)}  ${kind.padEnd(8)} ${m[1]}`);
        break; // one kind per line
      }
    }
  });
  return { syms, fileTokens: tok(src), lines: lines.length };
}

// ── CLI ───────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const measure = args[0] === "--measure";
const targets = measure ? args.slice(1) : args;
if (!targets.length) {
  console.error("usage: codemap.mjs [--measure] <file|dir> [...]");
  process.exit(2);
}

const base = process.cwd();
let totalFileTokens = 0;
let mapTokens = 0;
let fileCount = 0;
const chunks = [];

for (const t of targets) {
  for (const file of walk(t)) {
    const r = mapFile(file);
    if (!r) continue;
    fileCount++;
    totalFileTokens += r.fileTokens;
    const header = `\n${relative(base, file)}  (${r.lines} lines, ${r.syms.length} symbols)`;
    const body = r.syms.length ? r.syms.join("\n") : "  (no top-level declarations matched)";
    chunks.push(header + "\n" + body);
  }
}

const report = chunks.join("\n");
mapTokens = tok(report);
console.log(report);

if (measure) {
  const pct = totalFileTokens ? Math.round((mapTokens / totalFileTokens) * 100) : 0;
  console.log(`\n── measure ─────────────────────────────────────`);
  console.log(`files mapped:        ${fileCount}`);
  console.log(`full-read tokens:    ${totalFileTokens}`);
  console.log(`codemap tokens:      ${mapTokens}`);
  console.log(`codemap is ${pct}% of a full read  (saves ~${totalFileTokens - mapTokens} tok for orientation)`);
  console.log(`verdict: ${pct <= 30 ? "PASS — materially smaller, worth using for orientation" : "FAIL — not small enough; just read the files"}`);
}
