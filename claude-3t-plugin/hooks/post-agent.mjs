#!/usr/bin/env node
// claude-3t PostToolUse hook — post-delegation audit reminder.
//
// The implementor's completion report can be missing or truncated (cut off
// mid-sentence before it summarizes). So the executor must independently verify
// the work after every implementor return, never trusting the report alone.
// This hook fires right when the Task call returns and injects the audit steps,
// so the reminder lands even when the report itself never arrived.
//
// GATES (silent unless all hold), mirroring pre-agent.mjs:
//   1. 3t-initialized project   → marker .claude/context/cold/INDEX.md
//   2. 3t active this session    → flag .claude/.3t-active
//   3. The completed call was a Task/Agent delegation to the implementor

import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

// OPT-IN AUTO-VERIFY. The POST-DELEGATION AUDIT requires the executor to re-run
// build/test itself after every delegation. A project can delegate that to this
// hook by writing the command to `.claude/.3t-verify` (one shell command, e.g.
// `npm test -s` or `dotnet build -clp:ErrorsOnly`). When present, the hook runs
// it and injects a SUMMARY (exit code + the tail / first failure) — not the full
// log, which would cost as many tokens as the executor's own run. When absent,
// the hook stays advisory (just the audit reminder), exactly as before.
//
// Risk, by design: this runs the command SYNCHRONOUSLY inside the hook. A slow or
// hanging build blocks the turn, so we cap it with a timeout and keep it opt-in —
// never run an unconfigured/guessed command.
const VERIFY_TIMEOUT_MS = 120_000;
const VERIFY_TAIL_LINES = 20;

function autoVerify() {
  const cmdFile = join(projectDir, ".claude", ".3t-verify");
  let cmd;
  try {
    cmd = readFileSync(cmdFile, "utf8").trim();
  } catch {
    return null; // not configured → advisory mode
  }
  if (!cmd) return null;

  let output = "";
  let ok = false;
  try {
    output = execSync(cmd, {
      cwd: projectDir,
      encoding: "utf8",
      timeout: VERIFY_TIMEOUT_MS,
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024,
    });
    ok = true;
  } catch (e) {
    if (e.killed) {
      return { cmd, summary: `TIMED OUT after ${VERIFY_TIMEOUT_MS / 1000}s — run it yourself; the build may hang or be slow.` };
    }
    output = `${e.stdout || ""}\n${e.stderr || ""}`;
  }
  // Summary only: pass/fail + the tail (where failures and counts surface).
  const tail = output
    .split("\n")
    .filter((l) => l.trim())
    .slice(-VERIFY_TAIL_LINES)
    .join("\n");
  return { cmd, summary: `${ok ? "PASSED (exit 0)" : "FAILED (non-zero exit)"}\n--- last ${VERIFY_TAIL_LINES} non-blank lines ---\n${tail}` };
}
const MARKER = join(projectDir, ".claude", "context", "cold", "INDEX.md");
const FLAG = join(projectDir, ".claude", ".3t-active");
const DISABLED = join(projectDir, ".claude", ".3t-disabled");

if (!existsSync(MARKER) || existsSync(DISABLED) || !existsSync(FLAG)) {
  process.exit(0);
}

let payload = {};
try {
  const raw = readFileSync(0, "utf8");
  if (raw.trim()) payload = JSON.parse(raw);
} catch {
  process.exit(0);
}

const toolName = payload.tool_name || "";
const subagent = String((payload.tool_input || {}).subagent_type || "");
const isAgentTool = toolName === "Task" || toolName === "Agent";
if (!isAgentTool || !/implementor/i.test(subagent)) {
  process.exit(0);
}

const verify = autoVerify();
const buildLine = verify
  ? `[✓] Build/test: AUTO-VERIFY ran \`${verify.cmd}\` for you — result below. Still
    confirm it covers this delegation's scope; re-run targeted tests if not.`
  : `[ ] Build/test: re-run the compile and tests YOURSELF — "tests pass" in the
    report is unverified, and only a build catches a wrong-scoped duplicate`;
const verifyBlock = verify
  ? `\n\n--- AUTO-VERIFY RESULT (${verify.cmd}) ---\n${verify.summary}`
  : "";

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: `# POST-DELEGATION AUDIT — verify before trusting the report

The implementor just returned. Its report may be missing or truncated — do NOT
trust it alone. Before building on this work:

[ ] Existence: every deliverable named in the spec was actually written
    (a dropped tail item — the last doc/test — is the common silent failure)
${buildLine}
[ ] Read before rebuild: if the return looks partial or ends mid-sentence, Read
    each touched file before re-doing or layering on it — do not stack a correct
    version on top of a partial one

A failed audit is handled like a HALT: finish the remainder yourself, or
re-delegate it as a smaller batch with hard files isolated.${verifyBlock}`,
    },
  })
);
process.exit(0);
