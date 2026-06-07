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
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
// Plugin root, derived from this hook's own location (hooks/pre-agent.mjs → ..),
// so the SINGLE-SOURCE gate card can be read regardless of how the hook is invoked.
const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// SINGLE SOURCE OF THE CHECKLIST. The PRE-AGENT CHECKLIST text lives in exactly
// one place — context/3t-gate.md — and this hook delivers it at the delegation
// moment. The executor no longer re-reads the card every gate (that 866-token
// re-read is gone); the hook injects it instead. Keeping the boxes here AND in
// the card would be a DRY hazard, so we read them from the card and fall back to
// a minimal inline reminder only if the file cannot be read.
function gateChecklist() {
  try {
    const card = readFileSync(join(PLUGIN_ROOT, "context", "3t-gate.md"), "utf8");
    // Pull the fenced block whose first line is the checklist banner.
    const m = card.match(/```[^\n]*\n(PRE-AGENT CHECKLIST[\s\S]*?)```/);
    if (m) return m[1].trimEnd();
  } catch {
    /* fall through to the inline backstop */
  }
  return `PRE-AGENT CHECKLIST (card unreadable — minimal backstop)
[ ] Tech Lead Standard met (Haiku-completable, zero follow-ups)
[ ] ≤ ~6 file writes (count; split if more)
[ ] No tightly-coupled/state-machine file delegated
[ ] No stale read (files you edited after the implementor would read them)
[ ] Side-effecting unit → real side-effect test, not stubs
[ ] Cold index rows handed over (or topics to scan)
[ ] Spec + file names only — NO raw file contents/history`;
}
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

// Workflow delegation path (mode ON). The implementor pool is spawned INSIDE a
// background workflow, so the Task/Agent gate below never sees those calls — the
// only hook point is the top-level Workflow launch. Fire a workflow-specific
// reminder here, and only when this developer has enabled workflow delegation
// (flag .claude/.3t-workflows = "enabled"). The post-audit reminder is folded in
// because Workflow returns at LAUNCH (background) — a PostToolUse hook would fire
// before any work happened, so this is the one useful gate.
if (toolName === "Workflow") {
  const WORKFLOWS = join(projectDir, ".claude", ".3t-workflows");
  let enabled = false;
  try {
    enabled = /enabled/.test(readFileSync(WORKFLOWS, "utf8"));
  } catch {
    /* no flag → mode off → say nothing */
  }
  if (!enabled) process.exit(0);

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext: `# WORKFLOW DELEGATION — gate before launching

You are delegating implementor work via a workflow. Per 3t-core.md (DYNAMIC
WORKFLOW DELEGATION) confirm BEFORE this launch:

[ ] Announced this delegation in one line ("Delegating via a workflow — N implementor(s)")
[ ] PRE-AGENT CHECKLIST run for EACH implementor spec (Tech Lead Standard, ≤6 writes,
    no tightly-coupled file, no stale read, cold rows, spec + file names only)
[ ] Every implementor agent() call pins model: 'haiku' (never inherit the session model)
[ ] Every implementor agent() call uses agentType: 'claude-3t:implementor' + schema: COMPLETION_SCHEMA
[ ] Shared-file writes (INDEX.md, CONTEXT.md, registrations) routed to ONE agent or done by you

AFTER the workflow completes (you'll get a task-notification, not a tool return):
[ ] Reconcile results; handle any escalation flag (escalation.status !== 'none') yourself
[ ] POST-DELEGATION AUDIT — re-run build/test YOURSELF; the schema guarantees the
    report arrived, not that the work is complete
[ ] specQuality 'had gaps' → write the lesson to EXECUTOR_MEMORY.md

If any pre-launch box fails: STOP, resolve visibly, then launch.`,
      },
    })
  );
  process.exit(0);
}

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

You are about to delegate to claude-3t:implementor. The completed checklist must
appear as visible text BEFORE this call. You do NOT need to re-read 3t-gate.md —
its checklist is delivered here. If you have not just shown it, confirm each box now:

${gateChecklist()}

If any box fails: STOP, show which, resolve visibly, then re-delegate.`,
    },
  })
);
process.exit(0);
