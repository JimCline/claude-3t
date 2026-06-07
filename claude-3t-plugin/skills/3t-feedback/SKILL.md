---
name: 3t-feedback
description: Capture a single, focused piece of feedback about the BASELINE 3t
  protocol itself — a universal gap in the agent behavior, checklist, hooks, or
  skills that would improve EVERY 3t project. Produces a markdown report entry,
  appends it to .claude/context/3t-plugin-feedback.md, and tells you how to file
  it upstream. Narrower than /3t-debrief — it captures ONLY plugin-protocol gaps,
  nothing project-specific.
---

Capture one protocol-level improvement for the **claude-3t plugin itself** and
turn it into a clean, filable markdown report.

This is the **focused** counterpart to `/claude-3t:3t-debrief`. Debrief reviews a
whole session and routes lessons to several places — most of them project-local
(IMPLEMENTOR_MEMORY.md, EXECUTOR_MEMORY.md, cold storage). **This skill does only
one of those things:** it captures gaps in the *universal* 3t protocol and packages
them for the maintainer-side `/3t-apply-feedback`. If a lesson is specific to this
codebase's stack, it does NOT belong here — use `/3t-debrief` for that.

---

## STEP 1 — The qualifying gate (apply it strictly)

A piece of feedback belongs here ONLY if fixing it would help **every** 3t project,
not just this one. Concretely, it must be a gap in one of:

- **Agent behavior** — the executor or implementor did the wrong thing, and the
  cause is the protocol's wording, not this project's specifics
  (e.g. "implementor skipped StructuredOutput in workflow mode").
- **A checklist** — the PRE-AGENT gate or implementor EXIT checklist is missing a
  box, or has a box that misfires.
- **Sizing / delegation rules** — the delegate-vs-own or spec-sizing guidance gave
  a wrong answer for a general class of task.
- **Hooks** — `session-start` / `pre-agent` / `post-agent` did or didn't fire when
  they should.
- **Skills or bundled context** — a 3t skill or `3t-core.md` / `3t-gate.md` /
  `3t-reference.md` is unclear, contradictory, or missing guidance.

**Reject (do NOT capture here):**
- A code/framework/DSL gotcha specific to this project's stack → that's a
  `/3t-debrief` lesson for IMPLEMENTOR_MEMORY.md.
- A one-off delegation/sizing miss with no general pattern → EXECUTOR_MEMORY.md via
  `/3t-debrief`.
- Volatile facts (versions, signatures, config) → never; re-derived from code.

If nothing this session clears the gate, say so and stop. An empty, honest result
is correct — do not invent protocol gaps to fill a report.

---

## STEP 2 — Draft the report entry

For each qualifying gap, reflect on the session and write a specific, evidence-
backed entry. Name the exact file, checklist box, hook, or skill involved, and
quote the concrete failure — vague feedback is unactionable upstream.

Use exactly this format (it is what `/3t-apply-feedback` parses):

```
## [today's date] — from [one-line session/task description]

### Gap: [one-line title of the protocol gap]

**Evidence — concrete failure this session:**
[What actually happened. Counts, token costs, sub-turn counts, error strings —
be specific. This is the proof the gap is real.]

**Root cause:**
[Why the protocol allowed/caused it — point at the specific rule or wording.]

**Proposed change:**
[The concrete edit: which file, which section, what to add or change. If you can,
quote the suggested wording.]

**Scope:** [why this applies to every 3t project, not just this one.]
```

Keep each entry tight and self-contained — it will become a GitHub issue body
verbatim.

---

## STEP 3 — Show the entry and confirm

Show the drafted entry (or entries) to the user. Let them edit, drop, or approve
each one. Do not write until approved.

---

## STEP 4 — Append to the feedback file

Append each approved entry to `.claude/context/3t-plugin-feedback.md`. If the file
does not exist, create it with this header first:

```
# 3t Plugin Feedback

Gaps in the universal 3t protocol discovered during project work.
Each entry below should be filed as a GitHub issue on **JimCline/claude-3t** with
the label `feedback` — paste the entry block as the issue body.
Run `claude plugin update claude-3t` after a new version ships.

---
```

Then append the entry block(s) under it. Never overwrite existing entries — append.

---

## STEP 5 — Tell the user how to file it

```
Protocol feedback logged to .claude/context/3t-plugin-feedback.md.

To get it into the plugin:
  1. File each entry as a GitHub issue on JimCline/claude-3t
     with the label `feedback` — paste the entry block as the issue body.
  2. The maintainer runs /3t-apply-feedback (in the plugin source repo), which
     reads these issues and applies the improvements to the plugin.
  3. After a new version ships: claude plugin update claude-3t

These are NOT applied to your installed plugin automatically.
```

---

## Notes

- This skill writes only to `.claude/context/3t-plugin-feedback.md`. It never edits
  the installed plugin — those files are read-only and overwritten on update.
- Pair: `/3t-feedback` (downstream capture) → file as issue → `/3t-apply-feedback`
  (maintainer applies). `/3t-debrief` remains the broader tool for project-local
  lessons.
- `.claude/context/3t-plugin-feedback.md` is a transient outbound queue — once its
  entries are filed and shipped, it can be cleared. `/3t-reset` deletes it.
