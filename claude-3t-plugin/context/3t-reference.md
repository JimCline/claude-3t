# 3-Tier Reference Protocol

Read at `/claude-3t:3t-start` and `/claude-3t:3t-checkpoint`. Not needed on every turn.
Contains operational protocols referenced occasionally during sessions.

---

## GRILL-ME → /advisor → IMPLEMENTOR FLOW

Full lifecycle for design work. There is no architect agent — design decisions
are made by the executor with `/advisor`, and the durable record is authored by the
implementor.

```
/grill-me session
  └─ The executor drives grilling
  └─ /advisor available inline (Opus reasoning, no artifacts)
        │
        ▼ The executor judges design is crystallized
  The executor proposes close:
    "Here's the design I'll lock in: [summary]
     Close the session, or more to explore?"
        │
    ┌───┴────────────────────────┐
    │ User: "close it"           │ User: "one more thing..."
    │                            └─ continue grill-me
    ▼
  The executor consults /advisor on the crystallized design (Opus reasoning)
  The executor applies corrections, finalizes the decision
        │
        ▼
  The executor delegates ADR + CONTEXT.md authorship to implementor
    (PRE-AGENT CHECKLIST → implementor writes ADRs to docs/adr/ and/or
     CONTEXT.md, transcribing the decision EXACTLY — no re-deciding)
        │
        ▼
  The executor reviews the short authored result for faithfulness
  The executor surfaces finalized design to user
        │
        ▼
  /to-prd → /to-issues → 3t execution (Haiku implementation)
```

**Key invariants:**
- `/advisor` is the Opus reasoning layer: stateless, inline, no artifacts.
- The implementor authors all durable records; it never owns a decision.
- Decisions are versioned (DATE / STATUS / SUPERSEDED-BY) in ADRs.
- User always sees the finalized design before execution.

---

## FORK MODE COORDINATION

Use this to fan out a batch that is too big for one implementor round, when the
chunks are **independent** (disjoint write sets, no ordering dependency) — see
"SPLIT PARALLEL OR SEQUENTIAL?" in 3t-core.md. Dependency chains stay sequential;
shared-file writes (INDEX.md, CONTEXT.md, registrations) are never split across
forks.

Mandatory order:
1. Spawn all forks (CLAUDE_CODE_FORK_SUBAGENT=1), each with its OWN concise
   prompt — the handoff is per-prompt, so concurrent forks never contend.
2. Wait for ALL to complete
3. Reconcile — show summary, surface conflicts
4. Significant findings → MEMORY.md (and cold storage + INDEX row if durable
   and too large for the hot digest)
5. Routine findings → note in MEMORY.md or discard
6. THEN run PRE-AGENT CHECKLIST → invoke implementor with a settled spec

---

## DYNAMIC WORKFLOW COORDINATION

The full workflow-mode protocol — shape table, delegation rules, the coordination
recipe, the completion schema, and the post-return order — now lives in its own
on-demand file, `3t-workflow-mode.md`, loaded ONLY when `.claude/.3t-workflows` =
`enabled`. A default (mode-off) session never loads it. See `/3t-start` STEP 4b
and the "MODE FIRST" pointer in `3t-core.md`.

---

## MEMORY RECONCILIATION (HOT / COLD)

Burst start: propose reconciliation of hot memory files.
Mid-burst trigger: a hot file exceeds ~2,000 tokens OR entries older than 3
sessions accumulate.

When a hot file grows past cheap-to-reload:
- Identify its **durable, cold, expensive-to-rederive** tail.
- Move that tail into a `.claude/context/cold/<topic>.md` file.
- Add an INDEX row with a search-term-dense description.
- Leave only the hot working set in the original file.

Never promote volatile facts (signatures, config values, versions) — those are
re-derived from code, not stored. Format: side-by-side diff per change, user
approves individually.

---

## PARTIAL RE-RUN (gap > 30 days)

Ask 5 targeted refresh questions:
1. Has the tech stack or key dependencies changed?
2. Are any prior architectural decisions (ADRs) now invalid?
3. Any new sensitive areas or conventions added?
4. What's the current priority vs last session?
5. Anything that broke or changed while away?

Spawn targeted forks: package.json, files modified since last session
(git log --since=[last session date]), config files.
Update MEMORY.md and stale entries only — do not wipe.
Check cold storage for entries now stale; edit or delete and update INDEX rows.
Offer to run /grill-with-docs on any new feature area.

---

## /LEAVING DEPARTURE PROTOCOL

On /leaving:
1. Generate departure briefing (in progress, can do, queued, cannot touch)
2. Offer boundary adjustments (APPROVE / EXPAND / EXCLUDE / PRIORITY / DONE)
3. For each EXPAND: "session only or permanent?"
4. Write immediate snapshot to MEMORY.md
5. Begin autonomous work within confirmed boundaries

On return: finish current task → surface return briefing → resume.

---

## SESSION END PROTOCOL

On 30-min inactivity or /leaving:
1. Write Current State to MEMORY.md
2. Mandatory writes: had gaps → EXECUTOR_MEMORY.md, new durable knowledge →
   MEMORY.md or cold storage (with INDEX row)
3. Update OVERRIDE_LOG.md
4. Show snapshot summary (30s intervention window)

/claude-3t:3t-checkpoint triggers immediate snapshot anytime.
