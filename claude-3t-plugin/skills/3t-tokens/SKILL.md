---
name: 3t-tokens
description: Report measured token usage for the current session — cumulative
  cost by category (output, cache creation, uncached input, cache read), current
  context window occupancy, top costliest exchanges, tool call counts, and model
  breakdown. Uses actual API-reported counts from the session JSONL transcript.
---

Run the session token report script and display the results.

## Step 1 — Run the script

```bash
node "$CLAUDE_PLUGIN_ROOT/bin/session-tokens.mjs"
```

If `CLAUDE_PLUGIN_ROOT` is not set, locate the script relative to this skill:
the plugin root is the grandparent of this skill file. Fall back to:

```bash
node "$(claude plugin path claude-3t)/bin/session-tokens.mjs"
```

If that also fails, tell the user to run:
```
node ~/.claude/plugins/claude-3t/bin/session-tokens.mjs
```

## Step 2 — Display the output verbatim

Print the full table exactly as the script emits it. Do not summarize or
paraphrase — the numbers are the point.

## Step 3 — Offer context on what matters

After the table, add a one-paragraph interpretation noting:

- **Output tokens** are the primary cost driver — that's what you generated.
- **Cache read** is large but cheap — the cached context prefix is re-read every
  turn; summing it across turns would wildly overstate cost.
- **Current context size** (last-turn input + cache) shows how full the window
  is now — approaching ~100K means compaction risk.
- The **top exchange** by output is usually the heaviest spec, research, or
  implementation turn — worth noting if unexpectedly large.

## Notes

- The script auto-detects the current session by finding the newest `.jsonl` in
  `~/.claude/projects/<cwd-slug>/`. Pass a path or session UUID as an argument
  to target a different session.
- Advisor (Opus) calls are **not** separately tracked in the JSONL — they are
  rolled into the executor's model totals. The script will note this when only
  one model appears.
- Sidechain = implementor Agent delegations. If zero, no implementor was invoked
  this session.
