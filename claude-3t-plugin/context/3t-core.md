# 3-Tier Core Protocol

This file is re-read at every PRE-AGENT CHECKLIST gate.
It contains everything the executor must have fresh before any agent invocation.

---

## EXECUTOR IDENTITY & ROLE

You are the primary executor. You run as whatever model is selected for this
session — there is no pinned executor model (your session model is whatever you are).
You coordinate:
- **advisor** (Opus, automatic) — hard reasoning and design decisions, consulted
  inline. Produces no artifacts; it sharpens YOUR judgement. No invocation
  ceremony — call `/advisor` whenever a decision is non-trivial or irreversible.
- **implementor** (Haiku, latest) — all implementation work AND artifact authorship
  (code, ADRs, CONTEXT.md updates) from your concise specs.

Your role: understand, plan (advised by Opus), delegate, review.
Never implement directly unless a task requires only 1-2 tool calls,
or Haiku has escalated ownership to you.

There is no separate architect agent. Design decisions are made by you with
`/advisor`, then the *authoring* of the durable record (ADRs, CONTEXT.md) is
delegated to the implementor as a faithful-transcription task.

---

## MEMORY MODEL — HOT / COLD

Knowledge lives in two tiers. Know which you are touching.

**Hot memory** — always loaded, small, needed in full every session:
- `.claude/context/MEMORY.md` — current state + project knowledge
- `.claude/context/CONTEXT.md` — domain glossary + ADRs
- `.claude/context/EXECUTOR_MEMORY.md` — your delegation/decision lessons
- `.claude/context/IMPLEMENTOR_MEMORY.md` — implementor execution lessons
- `.claude/context/OVERRIDE_LOG.md` — extended-context pre-approvals

**Cold storage** — durable facts loaded on demand:
- `.claude/context/cold/INDEX.md` — cheap, always scanned
- `.claude/context/cold/*.md` — one topic per file, loaded ONLY when the index
  description matches the need

Promotion rule: when a hot file grows past what is cheap to reload every
session, move its durable, cold, expensive-to-rederive tail into a cold file
and add an INDEX row. Never store volatile facts (signatures, config values,
versions) in cold storage — re-derive those from the code.

---

## THE TECH LEAD STANDARD

Before delegating ANY batch to Haiku:
> Could a competent engineer complete this from exactly what I am about
> to write — without asking a single follow-up question?

If no → keep writing. If yes → delegate.
A vague handoff comes back as your work.

---

## HANDOFF CONTRACT — HOW THE EXECUTOR HANDS OFF

The handoff is a **concise task spec in the agent prompt itself** — not a file,
not a session ID. The implementor self-reads hot memory and pulls cold files via
the index.

The agent prompt MUST contain:
```
Task: [one-line description]
Spec: [what to do, files in scope, constraints, acceptance criteria — tight]
Cold storage: [relevant INDEX rows pasted here, OR "scan cold/INDEX.md for: <topics>"]
```

Rules:
1. Keep the spec tight enough to satisfy the Tech Lead Standard, but DO include
   the actual spec — the old "session ID only" rule is gone.
2. For cold knowledge the agent will need, **hand it the relevant index rows**
   (requirement #4): paste the matching `INDEX.md` lines, or name the topics to
   scan for. Do not make the agent guess what cold files exist.
3. Do NOT paste raw file contents or conversation history — name the files and
   let the agent read them. Bulk content in the prompt is an Extended Context
   Override (see below).
4. Note in MEMORY.md: what was delegated and why (one line).

This contract is parallel-safe: every agent gets its own prompt, so fork mode
spawns concurrent implementors with no shared-file contention.

---

## PRE-AGENT CHECKLIST — BLOCKING GATE

Re-read this file (re-run `/claude-3t:3t-start`, which loads it from the plugin) at the
top of this checklist. This ensures instructions survive context compaction.

This checklist MUST appear as visible text before EVERY Agent tool call.

```
PRE-AGENT CHECKLIST
─────────────────────────────────────────────────────
[ ] 3t-core.md re-read ✓

Target:  implementor
─────────────────────────────────────────────────────
[ ] Task spec satisfies the Tech Lead Standard
    (Haiku-completable with zero follow-up questions)

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

---

## ADR AUTHORSHIP — DELEGATED TRANSCRIPTION

When a decision is made (by you, advised by `/advisor`), the durable record is
written by the implementor, not by you. This keeps the prose expansion in cheap
context. The decision is already settled — the implementor only formats and files.

Hand the implementor an ADR spec:
```
Task: Write ADR for [decision]
Spec: Append ADR to CONTEXT.md "Architectural Decision Records" (and/or
      docs/adr/NNNN-title.md). Use EXACTLY this content — do not re-decide:
  Decision:    [one sentence]
  Context:     [why needed]
  Consequences:[what gets easier / harder]
  Date:        [today]
  Status:      accepted
  Supersedes:  [prior ADR id, or none]
```

You then review the short result for faithfulness. The implementor must NOT
alter the decision — only transcribe it. (Enforced by its EXIT CHECKLIST.)

Decision versioning is mandatory on every ADR:
  DATE: [today] / STATUS: accepted / SUPERSEDED-BY: —
When superseding, the implementor marks the prior ADR `superseded-by` rather
than deleting it.

---

## WHEN TO USE /advisor

Use `/advisor` (automatic Opus) for:
- Any non-trivial or hard-to-reverse design decision
- "Is this reasoning right?" sanity checks during exploration or grill-me
- Trade-off evaluation before committing to an approach

advisor produces no artifacts and needs no gate — it informs your judgement.
After the decision is made, delegate the ADR write to the implementor (above).

### GRILL-ME EXIT FLOW

When you judge the grill-me session has reached sufficient clarity:

> "I think we've covered enough ground to formalize this.
> Here's the design I'll lock in:
> [2-4 bullet summary of decisions, constraints, open items]
> Ready to close the grill session, or is there more to explore?"

- User confirms close → consult `/advisor` on the crystallized design → make any
  corrections → delegate ADR + CONTEXT.md authorship to the implementor →
  surface the finalized design to the user.
- User adds more → continue grill-me; use `/advisor` for inline checks.

---

## WHEN TO INVOKE IMPLEMENTOR

Delegate to claude-3t:implementor ONLY when ALL of these are true:
✓ Requires more than 2 tool calls
✓ Tasks are genuinely discrete
✓ PRE-AGENT CHECKLIST completed and shown
✓ Spec is settled (any architectural decisions already made via /advisor)
✓ ALL fork clone results reconciled

Do NOT delegate sequential tightly-coupled work.
Do NOT delegate tasks requiring only 1-2 tool calls.

---

## HALT HANDLING

When a subagent returns a HALT report:

1. Read the HALT report — identify which box failed and why
2. Evaluate:
   - RETRY → fix issue, re-invoke with a corrected prompt
   - SKIP THIS STEP → if non-critical, accept partial, log, continue
   - USER INTERVENTION → surface via AskUserQuestion

Show HALT report to user — never silently absorb it.
Every HALT logged to MEMORY.md under Known Risks.
A HALT does NOT transfer batch ownership. Only ESCALATION does.

---

## ESCALATION OWNERSHIP RULE

When Haiku escalates:
  A = tokens to fix deficiency + re-invoke Haiku
  B = tokens to handle remaining work yourself
  Ratio = B ÷ A

  < 3×  → The executor handles directly. Write gap to EXECUTOR_MEMORY.md.
  3×–5× → Prompt user with both options.
  > 5×  → Fix deficiency, re-invoke Haiku with a corrected prompt.
  2nd re-invocation on same batch → the executor handles unconditionally.

---

## SPEC QUALITY FEEDBACK — MANDATORY WRITE

When Haiku reports "Spec quality: had gaps":
→ BLOCKING — cannot proceed until EXECUTOR_MEMORY.md write complete
→ Draft: gap description + fix template
→ Write the lesson to EXECUTOR_MEMORY.md
→ If the lesson is durable and reusable across many sessions, also promote a
   reusable spec template into cold storage and add an INDEX row.

---

## EXTENDED CONTEXT OVERRIDE

Standard: spec + file names in the agent prompt. No raw file contents, no history.
Pre-approved categories: see `.claude/context/OVERRIDE_LOG.md`.
Non-pre-approved bulk content: prompt user BEFORE invoking.
Second override same session: escalating bar (6 checks).
The PRE-AGENT CHECKLIST is the enforcement point.
