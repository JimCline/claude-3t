#!/usr/bin/env node
// claude-3t token baseline — measure what the 3-tier protocol costs in context.
//
// This project has been optimizing on UNMEASURED assumptions (a prior pass acted
// on a "~40K session-start" claim that turned out false). This tool replaces
// guessing with a static estimate: it weighs every artifact that lands in the
// executor's context window and every block the hooks inject, so an optimization
// can be judged by a before/after delta instead of intuition.
//
// Estimate model: ~4 chars/token (GPT/Claude-family BPE average for English+code).
// This is an approximation, not a tokenizer — good enough for relative deltas,
// which is what optimization decisions need. Absolute numbers are ±15%.
//
// Usage:
//   node bin/token-baseline.mjs            # measure the plugin's own files
//   node bin/token-baseline.mjs /path/proj # also measure a project's hot memory
//
// Output: a per-artifact table + the three aggregate costs that actually recur:
//   SESSION-START LOAD  — paid once when /3t-start runs (core+ref+5 hot+cold index)
//   PER-GATE RE-READ    — paid every delegation (the gate card)
//   HOOK INJECTIONS     — paid automatically by the 3 hooks (pre/post/session)

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectDir = process.argv[2] || null;

const CHARS_PER_TOKEN = 4;
const tok = (s) => Math.round(s.length / CHARS_PER_TOKEN);

function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

// Pull every additionalContext template literal a hook injects, so we measure the
// real injected payload rather than the whole script (imports, gates, comments).
function hookInjectedTokens(hookFile) {
  const src = read(join(PLUGIN, "hooks", hookFile));
  if (!src) return 0;
  // Capture each injected backtick block, whether assigned to `additionalContext:`
  // (pre/post hooks) or passed through an `emit(`...`)` helper (session-start).
  // Sum only the LARGEST block — the hooks emit one payload per fired path, not
  // all blocks at once — to avoid double-counting mutually-exclusive branches.
  const blocks = [
    ...src.matchAll(/additionalContext:\s*`([\s\S]*?)`/g),
    ...src.matchAll(/emit\(\s*`([\s\S]*?)`/g),
  ];
  return blocks.reduce((max, m) => Math.max(max, tok(m[1])), 0);
}

const rows = [];
function measure(label, path, bucket) {
  const content = read(path);
  if (content === null) return 0;
  const t = tok(content);
  rows.push({ label, tokens: t, lines: content.split("\n").length, bucket });
  return t;
}

// ── Protocol files (executor context) ────────────────────────────────────────
const core = measure("3t-core.md", join(PLUGIN, "context", "3t-core.md"), "session");
const ref = measure("3t-reference.md", join(PLUGIN, "context", "3t-reference.md"), "session");
const gate = measure("3t-gate.md", join(PLUGIN, "context", "3t-gate.md"), "gate");
measure("3t-workflow-mode.md (on-demand)", join(PLUGIN, "context", "3t-workflow-mode.md"), "ondemand");

// ── Hot memory (templates here; real project files if a path was given) ───────
const HOT = ["MEMORY.md", "CONTEXT.md", "EXECUTOR_MEMORY.md", "IMPLEMENTOR_MEMORY.md", "OVERRIDE_LOG.md"];
let hotTotal = 0;
let hotEmpty = 0;
for (const f of HOT) {
  const path = projectDir
    ? join(projectDir, ".claude", "context", f)
    : join(PLUGIN, "templates", f);
  const content = read(path);
  if (content === null) continue;
  const t = tok(content);
  hotTotal += t;
  // Rough "scaffolding" estimate: lines that are headings, separators, or blank.
  const empty = content
    .split("\n")
    .filter((l) => /^\s*$/.test(l) || /^#{1,6}\s/.test(l) || /^[-=_]{3,}\s*$/.test(l)).length;
  const lines = content.split("\n").length;
  hotEmpty += Math.round((t * empty) / Math.max(lines, 1));
  rows.push({ label: `hot: ${f}`, tokens: t, lines, bucket: "session" });
}
const coldIndex = measure("cold/INDEX.md", projectDir
  ? join(projectDir, ".claude", "context", "cold", "INDEX.md")
  : join(PLUGIN, "templates", "cold", "INDEX.md"), "session");

// ── Hook injections (paid automatically, per event) ───────────────────────────
const preHook = hookInjectedTokens("pre-agent.mjs");
const postHook = hookInjectedTokens("post-agent.mjs");
const sessHook = hookInjectedTokens("session-start.mjs");

// ── Report ────────────────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

console.log(`\nclaude-3t token baseline  (~${CHARS_PER_TOKEN} chars/token, ±15%)`);
console.log(`source: ${projectDir ? `project ${projectDir}` : "plugin templates"}\n`);
console.log(`${pad("artifact", 38)}${lpad("tokens", 8)}${lpad("lines", 7)}`);
console.log("─".repeat(53));
for (const r of rows.sort((a, b) => b.tokens - a.tokens)) {
  console.log(`${pad(r.label, 38)}${lpad(r.tokens, 8)}${lpad(r.lines, 7)}`);
}

const sessionLoad = core + ref + hotTotal + coldIndex;
console.log("\nRECURRING COSTS");
console.log("─".repeat(53));
console.log(`${pad("SESSION-START LOAD (once per /3t-start)", 44)}${lpad(sessionLoad, 9)}`);
console.log(`${pad("  of which hot-memory scaffolding (strippable)", 44)}${lpad(hotEmpty, 9)}`);
console.log(`${pad("3t-gate.md card (delivered BY the hook)", 44)}${lpad(gate, 9)}`);
console.log(`${pad("HOOK: pre-agent injection (every delegation)", 44)}${lpad(preHook, 9)}`);
console.log(`${pad("HOOK: post-agent injection (every delegation)", 44)}${lpad(postHook, 9)}`);
console.log(`${pad("HOOK: session-start injection (once)", 44)}${lpad(sessHook, 9)}`);
console.log(
  `\nper-delegation context tax (2 hook injections): ${preHook + postHook} tok`
);
console.log(
  `note: the checklist lives ONCE in 3t-gate.md (${gate} tok) and pre-agent.mjs\n` +
    `reads + injects it at the gate. The executor no longer re-reads it manually,\n` +
    `so the old ~${gate}-tok per-delegation re-read is gone — that was the compounding win.\n`
);
