# 3-Tier PRE-AGENT GATE CARD

**Single source of the PRE-AGENT CHECKLIST.** The checklist below exists in
exactly one place — this file. The `pre-agent.mjs` hook reads it and injects it
into context at every implementor delegation, so the executor does NOT manually
re-read this card per gate (and never re-reads the full 23KB `3t-core.md` per
gate either — that loads once per session and is restored after compaction by the
SessionStart hook). When the hook delivers the boxes, show and confirm them.

Consult this card directly only to *shape a spec* before delegating. If you need
a limit's full definition, it lives in `3t-core.md` under the matching heading —
read that section on demand, not the whole file.

---

## THE LIMITS THIS GATE ENFORCES (one line each)

- **Tech Lead Standard** — could a competent engineer finish from exactly this
  spec with zero follow-up questions? If no, keep writing.
- **≤ ~6 file writes per delegation** — count the writes the spec implies. Over
  budget → split: fork parallel if chunks are independent, else sequential
  batches. (A single hard file can also blow the turn ceiling under budget.)
- **Own tightly-coupled / state-machine work directly** — never describe a
  complex branching state machine to Haiku via comments.
- **No stale reads** — no file in the spec was edited by you AFTER the
  implementor would have read it; if you changed a file it relies on, re-state
  the new contents/behavior in the spec.
- **Side-effecting units need a real test** — DB/metric/IO unit ⇒ require a test
  of the real side effect, not stubs.
- **Cold rows, not guesses** — paste the matching `cold/INDEX.md` rows or name
  the topics to scan.
- **Spec + file names only** — NO raw file contents or conversation history.
  Bulk content ⇒ Extended Context Override (user approval + OVERRIDE_LOG.md).

---

## PRE-AGENT CHECKLIST — BLOCKING GATE

This checklist MUST appear as visible text before EVERY Agent tool call. In
workflow mode (`Workflow` instead of `Agent`), the same discipline applies
**per spec inside the workflow** — run it for each implementor spec you hand the
script. The workflow does not exempt a spec from the gate; it just batches the
launches.

```
PRE-AGENT CHECKLIST
─────────────────────────────────────────────────────
[ ] 3t-gate.md re-read ✓

Target:  implementor
─────────────────────────────────────────────────────
[ ] Task spec satisfies the Tech Lead Standard
    (Haiku-completable with zero follow-up questions)

[ ] Write budget: spec implies ≤ ~6 file writes
    Counted: [N]. If >6 → STOP and split: fork parallel if the
    chunks are independent, else sequential batches.

[ ] No tightly-coupled / state-machine file is being
    delegated (own those directly): [confirmed | n-a]

[ ] No file in this spec was edited by me AFTER the implementor
    would have read it; any file I changed that it relies on has
    its new state re-stated in the spec: [confirmed | n-a]

[ ] If the spec introduces a side-effecting unit (DB/metric/IO),
    it requires a test of the REAL side effect, not just stubs:
    [confirmed | n-a]

[ ] Cold index rows handed to the agent (or topics to scan)
    Rows/topics: [list, or "none needed"]

[ ] Prompt contains spec + file names only — NO raw file
    contents or conversation history

[ ] If raw content/history IS included → Extended Context Override
    → User approval obtained: [yes/no/n-a]
    → Logged to OVERRIDE_LOG.md: [yes/no/n-a]
─────────────────────────────────────────────────────
CHECKLIST COMPLETE — invoking implementor
```

If any box cannot be checked: STOP. Show which box failed. Resolve visibly.
