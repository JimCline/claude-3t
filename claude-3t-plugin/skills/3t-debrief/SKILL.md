---
name: 3t-debrief
description: Run a structured post-work debrief of a 3-tier session and route the
  lessons to the right place — project execution lessons to IMPLEMENTOR_MEMORY.md,
  delegation/decision lessons to EXECUTOR_MEMORY.md, durable facts to cold storage,
  and universal protocol gaps to a plugin-feedback file for upstream. Use after a
  piece of work (an issue, a feature, a rough session) to capture what caused
  executor pickups, partial returns, or spec gaps so the next run is smoother.
---

Capture the friction from the work just completed and turn it into durable
lessons in the right files. The goal is a feedback loop: every pickup, HALT, or
spec gap should make the next session better instead of being forgotten.

## STEP 1 — Generate the debrief

Reflect on the work just completed (or ask the user to paste a debrief if they
have one). Produce a structured account — be specific and honest, name files and
error codes:

```
DEBRIEF — [issue / feature / task]
─────────────────────────────────────────────────────
Executor pickups: [count]
  For each: what the executor took over, and WHY
    (advisor pre-flag / build errors / partial return / stale read / scope gap)

Partial returns / HALTs: [count]
  What drove each (ceiling reached, blocker, contract kickback)

Spec-quality gaps: [the gaps the implementor flagged, or that surfaced as rework]

Gotchas discovered: [language/framework/DSL traps hit this session]

What worked: [delegations that went clean — worth reinforcing]
─────────────────────────────────────────────────────
```

## STEP 2 — Classify and route each lesson

Every lesson goes to exactly ONE destination. Sort them:

| Lesson type | Destination |
|---|---|
| Implementor execution trap — a code/framework/DSL gotcha the implementor should know next time it writes code here | `.claude/context/IMPLEMENTOR_MEMORY.md` |
| Delegation / decision / spec lesson — how the EXECUTOR should have sized, sequenced, or specced the work | `.claude/context/EXECUTOR_MEMORY.md` |
| Durable, cold, expensive-to-rederive fact (e.g. a project-wide DSL constraint, an architectural invariant) | `.claude/context/cold/<topic>.md` + an `INDEX.md` row |
| **Universal protocol / agent-behavior gap** — something that would help EVERY 3t project, not just this one (a missing checklist box, an implementor behavior, a hook) | `.claude/context/3t-plugin-feedback.md` (and tell the user to file it upstream — this skill cannot edit the installed plugin) |

Routing rules:
- A trap that is specific to THIS codebase's stack → project memory (IMPLEMENTOR or
  EXECUTOR), never the plugin feedback file.
- A gap in the *protocol itself* (the checklist missed a class of error, the
  implementor's exit behavior was unclear) → plugin feedback. Do NOT try to edit
  the plugin's own files from here; they are installed read-only and overwritten
  on update.
- Volatile facts (signatures, config values, versions) are NEVER stored — they
  are re-derived from code. Drop them.

## STEP 3 — Show the routing plan, get approval

Present a table: each lesson → its destination → the exact line(s) to be written.
Let the user approve, edit, or drop individual entries. Do not write yet.

## STEP 4 — Write the approved lessons

For project memory files (IMPLEMENTOR_MEMORY.md, EXECUTOR_MEMORY.md): append the
approved lines. Keep each lesson one or two tight lines — symptom + fix template.

For cold storage: this is durable-record authorship — delegate it to
`claude-3t:implementor` per the ADR/cold-write contract (write the topic file AND
its INDEX.md row; a cold file with no index row is invisible).

For `.claude/context/3t-plugin-feedback.md`: append a dated entry:

```
## [date] — from [issue/task]
Gap: [what the protocol/agent did not handle]
Evidence: [the concrete failure this session]
Proposed change: [checklist box / implementor instruction / hook / skill]
```

Tell the user: "Plugin-level gaps logged to `3t-plugin-feedback.md`. To get them
fixed in the plugin itself, file each entry as a GitHub issue on
**JimCline/claude-3t** with the label **`feedback`** — paste the entry block as
the issue body. The maintainer skill `/3t-apply-feedback` reads those issues and
applies the improvements to the plugin source. They are NOT applied to your
installed plugin automatically; run `claude plugin update claude-3t` after a new
version ships."

## STEP 5 — Confirm

Summarize what was written where. Remind the user that EXECUTOR_MEMORY.md and
IMPLEMENTOR_MEMORY.md are loaded into hot memory next `/claude-3t:3t-start`, so
the lessons take effect on the next session.
