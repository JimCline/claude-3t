#!/usr/bin/env node
// claude-3t PreToolUse hook — checklist enforcement at the delegation moment.
//
// The PRE-AGENT CHECKLIST lives in 3t-core.md, but having it in context is not
// the same as using it: nothing forces the executor to emit the boxes before a
// delegation, and that compliance drifts after a compaction. SessionStart only
// fires on the reset event; THIS hook fires on the delegation event itself —
// the one moment the checklist must be applied.
//
// GATES (stay completely silent unless all hold):
//   1. The project is 3t-initialized      → marker .claude/context/cold/INDEX.md
//   2. 3t is active this session           → flag .claude/.3t-active
//   3. The tool call is a Task delegation to the implementor subagent
//
// When all hold, emit additionalContext reminding the executor to show the
// completed PRE-AGENT CHECKLIST before this delegation proceeds. This injects,
// it does not hard-block: the hook cannot read the model's intent, but placing
// the checklist at the gate is a large step up from honor-system prose.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const MARKER = join(projectDir, ".claude", "context", "cold", "INDEX.md");
const FLAG = join(projectDir, ".claude", ".3t-active");
const DISABLED = join(projectDir, ".claude", ".3t-disabled");

// Gate 1 + 2: only in an active 3t session.
if (!existsSync(MARKER) || existsSync(DISABLED) || !existsSync(FLAG)) {
  process.exit(0);
}

// Read the tool-call payload.
let payload = {};
try {
  const raw = readFileSync(0, "utf8");
  if (raw.trim()) payload = JSON.parse(raw);
} catch {
  process.exit(0); // no/invalid payload — say nothing
}

const toolName = payload.tool_name || "";
const input = payload.tool_input || {};
const subagent = String(input.subagent_type || "");

// Gate 3: only the implementor delegation. Other agent calls pass silently.
// The subagent-spawning tool is named "Task" in some harnesses and "Agent" in
// others — accept either so the hook is not silently inert.
const isAgentTool = toolName === "Task" || toolName === "Agent";
const isImplementor = /implementor/i.test(subagent);
if (!isAgentTool || !isImplementor) {
  process.exit(0);
}

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: `# PRE-AGENT CHECKLIST — required before this implementor delegation

You are about to delegate to claude-3t:implementor. Per 3t-core.md, the completed
PRE-AGENT CHECKLIST must appear as visible text BEFORE this call. If you have not
just shown it, stop and show it now, confirming each box:

[ ] 3t-core.md re-read ✓
[ ] Task spec satisfies the Tech Lead Standard (Haiku-completable, zero follow-ups)
[ ] Write budget ≤ ~6 files (count them) — if more, split into batches
[ ] No tightly-coupled / state-machine file delegated (own those directly)
[ ] No file edited by you AFTER the implementor would read it (or its new state re-stated)
[ ] Side-effecting unit? spec requires a REAL side-effect test, not just stubs
[ ] Cold index rows handed to the agent (or topics to scan) — list or "none needed"
[ ] Prompt is spec + file names only — NO raw file contents or conversation history
[ ] If raw content/history IS included → Extended Context Override approved + logged

If any box fails: STOP, show which, resolve visibly, then re-delegate.`,
    },
  })
);
process.exit(0);
