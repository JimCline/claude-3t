#!/usr/bin/env node
// claude-3t session token report — measured usage from the current session JSONL.
//
// Unlike token-baseline.mjs (which estimates protocol artifact sizes statically),
// this script reads actual usage data recorded by the API and reported in the
// session transcript. Numbers here are exact API-reported counts, not estimates.
//
// Locating the session file:
//   Derives the project slug from cwd (non-alphanumeric chars → "-"), then picks
//   the newest-mtime .jsonl in ~/.claude/projects/<slug>/. This is "current
//   session" in the common case. Pass an explicit path or session ID as argv[1]
//   to override — required if two sessions share a project simultaneously.
//
// Cost model (four separate quantities, not one sum):
//   output_tokens          — generated tokens; the most expensive category
//   cache_creation         — tokens written to prompt cache (paid once per block)
//   input_tokens           — uncached new input each turn
//   cache_read_input_tokens — cached context re-read each turn (cheap, but large)
//
// Summing input+cache_read across turns counts the cached prefix repeatedly and
// produces a meaningless total. This report keeps them separate.
//
// Usage:
//   node bin/session-tokens.mjs                  # auto-detect current session
//   node bin/session-tokens.mjs /path/to/file.jsonl
//   node bin/session-tokens.mjs <session-uuid>   # uuid only, auto-finds path

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

// ── locate session file ──────────────────────────────────────────────────────

function cwdToSlug(dir) {
  return dir.replace(/[^a-zA-Z0-9]/g, "-");
}

function findSessionFile(arg) {
  if (arg) {
    // explicit path
    if (arg.includes("/") || arg.endsWith(".jsonl")) return resolve(arg);
    // bare UUID — scan all project dirs
    const base = join(homedir(), ".claude", "projects");
    for (const proj of readdirSync(base)) {
      const candidate = join(base, proj, `${arg}.jsonl`);
      try { statSync(candidate); return candidate; } catch { /* continue */ }
    }
    throw new Error(`Session file not found for id: ${arg}`);
  }
  const slug = cwdToSlug(process.cwd());
  const dir = join(homedir(), ".claude", "projects", slug);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => ({ f, mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!files.length) throw new Error(`No session files found in ${dir}`);
  return join(dir, files[0].f);
}

// ── parse ────────────────────────────────────────────────────────────────────

const sessionFile = findSessionFile(process.argv[2]);
const lines = readFileSync(sessionFile, "utf8").trim().split("\n");

const assistantTurns = [];
const userPrompts = [];
const toolCallCounts = {};
const modelCounts = {};

let currentUserText = "(session start)";
let currentUserIdx = 0;

for (const raw of lines) {
  let rec;
  try { rec = JSON.parse(raw); } catch { continue; }

  if (rec.type === "user") {
    const msg = rec.message || {};
    // Extract text from user message content
    const content = msg.content || [];
    const textParts = Array.isArray(content)
      ? content.filter((b) => b?.type === "text").map((b) => b.text).join(" ")
      : typeof content === "string" ? content : "";
    if (textParts && !rec.isSidechain) {
      currentUserText = textParts.slice(0, 80).replace(/\n/g, " ");
      currentUserIdx++;
    }
  }

  if (rec.type === "assistant") {
    const msg = rec.message || {};
    const usage = msg.usage || {};
    // Don't use iterations[] — it repeats top-level numbers
    const model = msg.model || "unknown";
    modelCounts[model] = (modelCounts[model] || 0) + 1;

    const turn = {
      output: usage.output_tokens || 0,
      input: usage.input_tokens || 0,
      cacheCreate: usage.cache_creation_input_tokens || 0,
      cacheRead: usage.cache_read_input_tokens || 0,
      isSidechain: rec.isSidechain || false,
      model,
      userPromptIdx: currentUserIdx,
      userPromptText: currentUserText,
      tools: [],
    };

    for (const block of msg.content || []) {
      if (block?.type === "tool_use") {
        const name = block.name || "unknown";
        turn.tools.push(name);
        toolCallCounts[name] = (toolCallCounts[name] || 0) + 1;
      }
    }

    assistantTurns.push(turn);
  }
}

// ── aggregate ────────────────────────────────────────────────────────────────

const totals = { output: 0, input: 0, cacheCreate: 0, cacheRead: 0 };
const mainChain = { output: 0, input: 0, cacheCreate: 0, cacheRead: 0 };
const sideChain = { output: 0, input: 0, cacheCreate: 0, cacheRead: 0 };

for (const t of assistantTurns) {
  totals.output += t.output;
  totals.input += t.input;
  totals.cacheCreate += t.cacheCreate;
  totals.cacheRead += t.cacheRead;
  const bucket = t.isSidechain ? sideChain : mainChain;
  bucket.output += t.output;
  bucket.input += t.input;
  bucket.cacheCreate += t.cacheCreate;
  bucket.cacheRead += t.cacheRead;
}

// Per user-prompt segment aggregates
const byPrompt = {};
for (const t of assistantTurns) {
  const key = t.userPromptIdx;
  if (!byPrompt[key]) byPrompt[key] = { text: t.userPromptText, output: 0, input: 0, turns: 0 };
  byPrompt[key].output += t.output;
  byPrompt[key].input += t.input;
  byPrompt[key].turns++;
}

const topPrompts = Object.values(byPrompt)
  .sort((a, b) => b.output - a.output)
  .slice(0, 5);

const lastTurn = assistantTurns[assistantTurns.length - 1] || {};

// ── render ────────────────────────────────────────────────────────────────────

const fmt = (n) => n.toLocaleString().padStart(10);
const bar = "─".repeat(60);

console.log(`\nSESSION TOKEN REPORT`);
console.log(bar);
console.log(`File:    ${sessionFile}`);
console.log(`Turns:   ${assistantTurns.length} assistant  |  ${currentUserIdx} user prompts`);
console.log();

console.log(`CUMULATIVE COST (all turns)`);
console.log(`  Output (generated):   ${fmt(totals.output)}  ← primary cost`);
console.log(`  Cache creation:       ${fmt(totals.cacheCreate)}  ← paid once per block`);
console.log(`  Input (uncached):     ${fmt(totals.input)}`);
console.log(`  Cache read:           ${fmt(totals.cacheRead)}  ← cheap; prefix re-read every turn`);
console.log();

console.log(`CURRENT CONTEXT SIZE (last turn)`);
const ctxNow = (lastTurn.input || 0) + (lastTurn.cacheRead || 0) + (lastTurn.cacheCreate || 0);
console.log(`  Input + cache:        ${fmt(ctxNow)}  tokens in context window now`);
console.log(`  Output last turn:     ${fmt(lastTurn.output || 0)}`);
console.log();

if (Object.keys(sideChain).some((k) => sideChain[k] > 0)) {
  console.log(`MAIN vs SIDECHAIN (implementor delegations)`);
  console.log(`  Main chain output:    ${fmt(mainChain.output)}`);
  console.log(`  Sidechain output:     ${fmt(sideChain.output)}`);
  console.log();
} else {
  console.log(`SIDECHAIN: no implementor delegations recorded this session`);
  console.log();
}

console.log(`TOP ${topPrompts.length} COSTLIEST EXCHANGES (by output tokens)`);
for (const p of topPrompts) {
  const label = p.text.length > 60 ? p.text.slice(0, 57) + "..." : p.text;
  console.log(`  "${label}"`);
  console.log(`    output: ${p.output.toLocaleString()}  input: ${p.input.toLocaleString()}  turns: ${p.turns}`);
}
console.log();

console.log(`TOOL CALL COUNTS`);
const sortedTools = Object.entries(toolCallCounts).sort((a, b) => b[1] - a[1]);
const toolLine = sortedTools.map(([n, c]) => `${n}: ${c}`).join("  |  ");
console.log(`  ${toolLine || "(none)"}`);
console.log();

console.log(`MODELS`);
for (const [m, c] of Object.entries(modelCounts)) {
  console.log(`  ${m}: ${c} turns`);
}
const hasSonnet = Object.keys(modelCounts).some(m => m.includes("sonnet"));
const hasOpus   = Object.keys(modelCounts).some(m => m.includes("opus"));
if (hasSonnet && !hasOpus) {
  console.log(`  Note: advisor (Opus) calls are not separately tracked in the`);
  console.log(`  JSONL — they appear under the executor's model entry above.`);
}
console.log(bar);
