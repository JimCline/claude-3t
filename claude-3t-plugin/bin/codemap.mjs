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
// Per-language patterns live in ./codemap-langs/<lang>.mjs and are imported ON
// DEMAND — only the languages present in the target set are loaded, so a JS-only
// run never parses the Python/Go/Rust/etc. patterns.
//
// Usage:
//   node bin/codemap.mjs <file|dir> [more...]   # map files / recurse dirs
//   node bin/codemap.mjs --measure <dir>        # also print tokens-saved vs full read
//
// Output per file: a path header, then `Lnnn  kind  name` lines. Compact and
// deterministic — same input, same output (safe to cache / diff).
//
// EXPERIMENT RESULT — all 7 languages validated against real repos (--measure):
//   TS      honcho/mcp/src         9 files   11,178 →    274 tok   (2%)
//   Python  honcho/src           119 files  324,869 → 11,997 tok   (4%)
//   Go      flatted/golang                                          (5%)
//   Rust    byteorder/src                                           (5%)
//   Ruby    homebrew/cmd                                            (6%)
//   C#      clitimer/CliTimer                                       (8%)
//   Java    msgpack jruby ext                                      (11%)
// Verdict: PASS everywhere — a real read costs 9–50× the codemap for the same
// orientation. Validation also caught + fixed real pattern bugs (JS captured
// keywords as names; C# matched `else if (` as a method) before shipping.
// CAVEAT: on imperative script files with few declarations (e.g. these hooks, or
// a top-level Ruby script) the map is nearly empty — small because there is
// little structure to extract, not because it distilled well. Use it for
// "what's defined / where is X" on real modules; read bodies when they matter.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const tok = (s) => Math.round(s.length / 4);

// Per-language declaration patterns live in ./codemap-langs/<lang>.mjs and are
// loaded ON DEMAND — only the languages actually present in the target file set
// are imported, so a JS-only run never parses the Python/Go/Rust/etc. patterns.
// Each module default-exports [[kind, regex], ...]; first match per line wins, so
// specific declared kinds precede the generic method matcher.
const EXT_MAP = {
  ".js": "js", ".mjs": "js", ".cjs": "js", ".jsx": "js", ".ts": "js", ".tsx": "js",
  ".py": "py", ".go": "go", ".rs": "rs", ".cs": "cs", ".java": "java", ".rb": "rb",
};

const LANGS_DIR = join(dirname(fileURLToPath(import.meta.url)), "codemap-langs");
const _patternCache = new Map();
async function patternsFor(lang) {
  if (!_patternCache.has(lang)) {
    const mod = await import(pathToFileURL(join(LANGS_DIR, `${lang}.mjs`)).href);
    _patternCache.set(lang, mod.default);
  }
  return _patternCache.get(lang);
}

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

function mapFile(path, patterns) {
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
    const patterns = await patternsFor(EXT_MAP[extname(file)]);
    const r = mapFile(file, patterns);
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
