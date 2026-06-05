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

Use ONLY when `.claude/.3t-workflows` = `enabled` (see DYNAMIC WORKFLOW
DELEGATION in 3t-core.md). When enabled, this REPLACES fork mode / single-invoke
as the delegation path. The win is a schema-validated, truncation-proof return.

Each implementor `agent()` call MUST set `agentType: 'claude-3t:implementor'`,
`model: 'haiku'` (never inherit the session model), and `schema:
COMPLETION_SCHEMA`. Announce the delegation first ("Delegating via a workflow —
N implementor(s)").

Pick the shape from the mode-on table in 3t-core.md:
- **single task** → one `agent()` call.
- **independent batch** → `parallel(specs.map(s => () => agent(s, {...})))`.
- **independent items each needing verify** → `pipeline(items, implement, verify)`
  — a *per-item* implement→verify lifecycle. NOTE: `pipeline` runs items
  concurrently; it is for INDEPENDENT items only, not for ordering dependent work.
- **dependency chain (B needs A's output)** → sequential awaits with a barrier:
  `const a = await agent(specA, {...}); const b = await agent(specB(a), {...});`
  — NEVER `pipeline`, which would run A and B concurrently and stale-read.

Canonical fan-out:

```js
const COMPLETION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    done:            { type: 'string' },                 // one sentence
    filesChanged:    { type: 'array', items: { type: 'string' } },
    tests:           { type: 'string' },                 // "N passed / N failed | none in scope"
    coldIndexUpdated:{ type: 'string' },                 // "yes — rows … | n/a"
    assumptions:     { type: 'array', items: { type: 'string' } },
    missingContext:  { type: 'array', items: { type: 'string' } },
    alsoNoticed:     { type: 'array', items: { type: 'string' } },
    specQuality:     { type: 'string', enum: ['sufficient', 'had gaps'] },
    specGaps:        { type: 'array', items: { type: 'string' } },
    // exit-checklist items as booleans (free-text checklist → schema flags):
    noUnsolicitedGit:{ type: 'boolean' },
    onlySpecFiles:   { type: 'boolean' },
    // inline escalation is unavailable in a workflow — surface it structurally:
    escalation: {
      type: 'object',
      additionalProperties: false,
      properties: {
        status:    { type: 'string', enum: ['none', 'halt', 'escalated', 'partial'] },
        reason:    { type: 'string' },
        safeState: { type: 'string' },   // what is done and safe to keep
        remaining: { type: 'string' },   // work not done, in suggested order
      },
      required: ['status'],
    },
  },
  required: ['done', 'filesChanged', 'tests', 'specQuality', 'escalation'],
}

const specs = [ /* ≤6-write spec strings, each passing the PRE-AGENT CHECKLIST */ ]
const results = await parallel(
  specs.map(s => () =>
    agent(s, { agentType: 'claude-3t:implementor', model: 'haiku', schema: COMPLETION_SCHEMA }))
)
return results.filter(Boolean)
```

Mandatory order AFTER the workflow returns (the executor does this, not the
script):
1. **Reconcile** — show a summary of every result; surface conflicts.
2. **Handle escalation flags** — any result with `escalation.status !== 'none'`
   is dealt with NOW (finish it yourself or re-delegate a smaller batch). This is
   the post-completion substitute for inline escalation.
3. **POST-DELEGATION AUDIT** — independently re-run build/test yourself
   (3t-core.md). The schema guarantees the report arrived intact; it does NOT
   guarantee the work is complete.
4. **Memory writes** — `specQuality: 'had gaps'` → EXECUTOR_MEMORY.md (mandatory);
   durable findings → MEMORY.md / cold storage + INDEX row.

Shared-file writes (INDEX.md, CONTEXT.md, registrations) are never split across
parallel agents — route them to one agent or do them yourself at reconcile. Use
`isolation: 'worktree'` only if parallel agents would otherwise collide on files.

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
