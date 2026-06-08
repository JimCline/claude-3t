#!/usr/bin/env node
// claude-3t SessionStart hook.
//
// GATE: this plugin may be installed globally, but the 3-tier protocol must only
// activate in projects that have been 3t-initialized. The marker is the COMMITTED
// scaffold file `.claude/context/cold/INDEX.md`, written by the /3t-init skill.
// Because it is committed (unlike the gitignored MEMORY.md), a fresh clone of an
// already-3t project auto-activates without re-running /3t-init. If the marker is
// absent, this hook emits nothing and the session is unaffected.
//
// SESSION STATE: the hook is stateless, but it needs to know after a compaction
// whether the user opted into 3t this session. We track that with a flag file,
// `.claude/.3t-active` (gitignored):
//   - startup/resume → RESET the flag (every new/resumed session begins inactive)
//     and ask the user yes/no. The /claude-3t:3t-start skill writes the flag when
//     the user says yes. So presence of the flag == "3t is active this session."
//   - compact/clear  → the session is continuing after a context reset. Read the
//     flag: if set, inject an UNCONDITIONAL reload instruction (the protocol was
//     active and must be reloaded); if unset, stay silent (the user had declined).
//
// Limitation: the flag is a single per-project file, so two concurrent sessions in
// the SAME project directory can clobber each other's flag. That is uncommon; the
// failure mode degrades to "executor judges from the summary," not an error.
//
// Output: the documented SessionStart JSON form, so the text is reliably added to
// context as additionalContext (plain stdout is the fallback).

import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

// Claude Code sets CLAUDE_PROJECT_DIR to the project root for hooks; fall back
// to cwd only if it is unset.
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const MARKER = join(projectDir, ".claude", "context", "cold", "INDEX.md");
const FLAG = join(projectDir, ".claude", ".3t-active");
const DISABLED = join(projectDir, ".claude", ".3t-disabled");

if (!existsSync(MARKER)) {
  // Not a 3t project — stay completely silent.
  process.exit(0);
}

if (existsSync(DISABLED)) {
  // 3t is initialized here but the user deactivated it (/3t-remove → deactivate).
  // Stay silent without deleting any files; reactivate by removing this flag.
  process.exit(0);
}

// Read the hook payload from stdin to learn why the session started.
let source = "startup";
try {
  const raw = readFileSync(0, "utf8");
  if (raw.trim()) source = JSON.parse(raw).source || source;
} catch {
  // No/invalid stdin — assume a fresh startup.
}

const isContinuation = source === "compact" || source === "clear";

function emit(additionalContext) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext },
    })
  );
  process.exit(0);
}

if (isContinuation) {
  // Continuing after a context reset. Reload ONLY if 3t was active this session.
  if (!existsSync(FLAG)) process.exit(0); // user had declined → silent
  emit(`# Session Protocol — Reload Required (post-${source})

The context was just reset, but the session protocol was ACTIVE this session.
Re-run \`/claude-3t:3t-start\` now to reload the full protocol and hot
memory before continuing. Do this before any other work.`);
}

// Fresh start or resume → reset the flag (session begins inactive) and ask.
try {
  unlinkSync(FLAG);
} catch {
  // Flag absent — nothing to reset.
}

emit(`# Structured Session (claude-3t) Detected

This project is initialized with the claude-3t session protocol: Sonnet executor
+ Opus advisor + file-based hot/cold memory.

BEFORE doing anything else, ask the user exactly this and wait for an answer:

  "This project uses the claude-3t structured session. Start it for this
   session? (yes/no)"

- If YES → run \`/claude-3t:3t-start\` to load the protocol and hot memory,
  then continue. (That skill marks the session active so the protocol is
  automatically reloaded after any context compaction.)
- If NO  → proceed normally and do NOT load the protocol this session. Do not
  ask again unless the user brings it up.

(Other commands: /claude-3t:3t-status, /claude-3t:3t-tokens,
/claude-3t:3t-checkpoint, /claude-3t:3t-debrief, /claude-3t:3t-leaving.)`);
