---
name: 3t-leaving
description: Departure protocol — generate a pre-departure briefing, offer
  boundary adjustments for autonomous work, write an immediate session
  snapshot, then begin working within confirmed boundaries.
---

Run the departure protocol now. The user is stepping away.

## Step 1 — Generate Departure Briefing

Read MEMORY.md, OVERRIDE_LOG.md, and current session state, then display:

```
DEPARTURE BRIEFING
─────────────────────────────────────────────────────
IN PROGRESS (will complete before starting anything new):
  [current task if any, estimated completion]

CAN DO AUTONOMOUSLY:
  Standard contract work (concise spec handoff, no extended context)
  [list pre-approved categories from OVERRIDE_LOG.md]

  Available work in this category:
  [list specific tasks that qualify]

QUEUED — needs your approval before starting:
  [list any tasks requiring extended context or unmade design decisions]

CANNOT TOUCH without you:
  ✗ Hard/irreversible design decisions (consult you, advised by the advisor)
  ✗ Non-pre-approved extended context tasks
  ✗ [sensitive areas from MEMORY.md]
─────────────────────────────────────────────────────
```

## Step 2 — Offer Boundary Adjustments

Tell the user:
"You can adjust these boundaries before I start. Type any of:

  APPROVE [task]      — unblock a queued task now
  EXPAND [category]   — add a temporary or permanent pre-approval
  EXCLUDE [task/area] — explicitly block something
  PRIORITY [task]     — set what to tackle first
  DONE                — confirm and begin autonomous work

Or just type DONE to proceed with current boundaries."

Wait for user input.

## Step 3 — Handle Adjustments

For each EXPAND the user requests, ask:
"Apply this session only or save permanently to OVERRIDE_LOG.md?"
- SESSION → note it, revert on return
- PERMANENT → update OVERRIDE_LOG.md pre-approved categories

## Step 4 — Confirm and Snapshot

When user types DONE, display confirmed boundaries:

```
CONFIRMED AUTONOMOUS BOUNDARIES
─────────────────────────────────────────────────────
Will work on:    [list]
Session-only expansions: [list or: none]
Excluded:        [list or: none]
Priority order:  [ordered task list]
─────────────────────────────────────────────────────
```

Write an immediate snapshot to MEMORY.md Current State including:
- All fields from /claude-3t:3t-checkpoint
- Departure: manual (/claude-3t:3t-leaving)
- Autonomous boundaries this session: [expansions and exclusions]
- Priority queue: [ordered task list]

Tell the user: "Snapshot written. Working autonomously within confirmed boundaries."

## Step 5 — On Return

When the user sends any message, detect return and:
1. Finish the current task cleanly before starting anything new
2. Display return briefing:

```
WELCOME BACK
─────────────────────────────────────────────────────
Completed while you were away:
  [list with status]

Not started (excluded or not reached):
  [list]

Session-only expansions now reverted:
  [list or: none]

Ready for your next instruction.
─────────────────────────────────────────────────────
```
