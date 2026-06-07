#!/usr/bin/env node
// claude-3t session probe — one deterministic state scan for /3t-start.
//
// /3t-start STEP 4a, 4b, and 5 each had the executor run shell commands and read
// output: an advisor-model grep, a workflow-flag cat, and ~6 project-state checks
// (test -s, ls, git log). That is ~8 separate tool round-trips of pure
// deterministic gathering every session start. This script does all of it in ONE
// invocation and prints a compact, labeled block the executor interprets directly.
//
// This is a LATENCY / turn-count win, not primarily a token win — it trades many
// model↔tool round-trips for one. It gathers facts only; the executor still makes
// the judgement calls (which advisor fallback to use, where to resume).
//
// Run from the project root (cwd):  node "$CLAUDE_PLUGIN_ROOT/bin/session-probe.mjs"

import { existsSync, readFileSync, statSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";

const cwd = process.cwd();
const C = (...p) => join(cwd, ...p);

const nonEmpty = (path) => {
  try {
    return statSync(path).size > 0;
  } catch {
    return false;
  }
};
const read = (path) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};
const out = [];
const line = (k, v) => out.push(`${k}: ${v}`);

// ── 4a. Advisor model (committed/team or per-developer) ───────────────────────
let advisor = "not configured";
for (const f of [
  C(".claude", "settings.json"),
  C(".claude", "settings.local.json"),
  join(homedir(), ".claude", "settings.json"),
]) {
  const txt = read(f);
  if (!txt) continue;
  const m = txt.match(/"advisorModel"\s*:\s*"([^"]+)"/);
  if (m) {
    advisor = `${m[1]} (from ${f.replace(homedir(), "~")})`;
    break;
  }
}
line("advisor", advisor);

// ── 4b. Workflow-delegation mode (per-developer flag) ─────────────────────────
const wf = read(C(".claude", ".3t-workflows"));
line("workflow_mode", wf === null ? "unset (first run — offer the choice)" : /enabled/.test(wf) ? "enabled" : "disabled");

// ── hot-memory presence (STEP 2 prerequisite) ────────────────────────────────
const HOT = ["MEMORY.md", "CONTEXT.md", "EXECUTOR_MEMORY.md", "IMPLEMENTOR_MEMORY.md", "OVERRIDE_LOG.md"];
const missing = HOT.filter((f) => !existsSync(C(".claude", "context", f)));
line("hot_memory", missing.length ? `MISSING: ${missing.join(", ")} — project not initialized (run /3t-init)` : "all present");
const populated = HOT.filter((f) => nonEmpty(C(".claude", "context", f)) && (read(C(".claude", "context", f)) || "").trim().split("\n").length > 12);
line("hot_memory_populated", populated.length ? populated.join(", ") : "all near-empty (young project)");

// ── 5. Project-state artifacts ────────────────────────────────────────────────
line("CONTEXT.md", nonEmpty(C(".claude", "context", "CONTEXT.md")) ? "present" : "empty/absent");
line("PRD.md", nonEmpty(C("PRD.md")) ? "present" : "absent");
line("KANBAN.md", nonEmpty(C("KANBAN.md")) ? "present" : "absent");
line("github_issues", existsSync(C(".github", "issues")) ? "present" : "absent");
let adr = "absent";
try {
  const adrs = existsSync(C("docs", "adr"))
    ? readdirSync(C("docs", "adr")).filter((f) => f.endsWith(".md"))
    : [];
  if (adrs.length) adr = `${adrs.length} ADR file(s)`;
} catch {
  /* leave absent */
}
line("docs/adr", adr);

// cold index entry count
const cold = read(C(".claude", "context", "cold", "INDEX.md"));
const coldRows = cold ? (cold.match(/^\s*[-|]\s*\S/gm) || []).length : 0;
line("cold_index", cold === null ? "absent" : `${coldRows} entr${coldRows === 1 ? "y" : "ies"}`);

// recent git history
let git = "no git history";
try {
  git = execSync("git log --oneline -5 2>/dev/null", { cwd, encoding: "utf8" }).trim() || git;
} catch {
  /* not a repo */
}

console.log("── 3t session probe ───────────────────────────────");
console.log(out.join("\n"));
console.log("recent_commits:");
console.log(
  git
    .split("\n")
    .map((l) => "  " + l)
    .join("\n")
);
console.log("───────────────────────────────────────────────────");
