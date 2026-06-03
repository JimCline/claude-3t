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
import { join } from "node:path";

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
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

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: `# POST-DELEGATION AUDIT — verify before trusting the report

The implementor just returned. Its report may be missing or truncated — do NOT
trust it alone. Before building on this work:

[ ] Existence: every deliverable named in the spec was actually written
    (a dropped tail item — the last doc/test — is the common silent failure)
[ ] Build/test: re-run the compile and tests YOURSELF — "tests pass" in the
    report is unverified, and only a build catches a wrong-scoped duplicate
[ ] Read before rebuild: if the return looks partial or ends mid-sentence, Read
    each touched file before re-doing or layering on it — do not stack a correct
    version on top of a partial one

A failed audit is handled like a HALT: finish the remainder yourself, or
re-delegate it as a smaller batch with hard files isolated.`,
    },
  })
);
process.exit(0);
