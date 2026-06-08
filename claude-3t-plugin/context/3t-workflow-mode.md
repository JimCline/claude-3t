# 3-Tier Dynamic Workflow Delegation Mode

Load this file ONLY when `.claude/.3t-workflows` = `enabled` (the per-developer
flag set at `/claude-3t:3t-start` STEP 4b). When the flag is off or absent, this
mode is inactive — do NOT load this file and do NOT call the `Workflow` tool;
delegation behaves exactly as the default (direct execution + fork mode), and
the rest of the protocol in `3t-core.md` / `3t-reference.md` is unchanged.

Keeping this out of the always-loaded core means the default (mode-off) session
never pays for ~150 lines of workflow protocol it will not use.

---

## MODE FIRST: HOW WORKFLOW MODE CHANGES THE SPLIT DECISION

The SAME independent-vs-dependent analysis from `3t-core.md` ("SPLIT PARALLEL OR
SEQUENTIAL?") still runs; with the mode ON it chooses the workflow *shape*
instead of fork-vs-single-invoke:

| Situation | Mode OFF | Mode ON |
|---|---|---|
| 1–2 tool calls | executor does it directly | executor does it directly |
| tightly-coupled / state-machine | executor owns it directly | executor owns it directly |
| single discrete delegated task | one implementor invoke | direct invoke (a 1-agent workflow buys nothing here) |
| independent batch | fork mode | fan-out workflow (`parallel`) |
| independent items each needing verify | fork + audit | per-item implement→verify (`pipeline`) |
| dependency chain (B needs A's output) | sequential batches | sequential `await`s — barrier between steps; NEVER `pipeline` |

**`pipeline()` is NOT for dependency chains.** It runs *items* concurrently (only
the stages within ONE item are ordered), so feeding a dependency chain to
`pipeline` reintroduces the stale-read bug — chunk B reads files chunk A is still
writing. `pipeline` is a per-item *implement→verify* lifecycle for **independent**
items (a verification upgrade over plain fan-out). A genuine cross-chunk
dependency stays sequential: `await agent(A)` then `await agent(B)`, or the
executor keeps owning the sequencing.

Direct execution and "executor owns tightly-coupled work" are identical in both
modes — workflow mode only changes the *delegated* path.

---

## DYNAMIC WORKFLOW DELEGATION

**Authorization.** This skill-loaded protocol authorizes you to call the
`Workflow` tool for implementor delegation *only when the flag is enabled*. With
the flag off or absent, do NOT call `Workflow` — use direct/fork as today.

**What it changes.** When enabled, a workflow becomes *available* as a delegation
shape — it is NOT the mandatory path for all delegated work. Use it only where
your judgment says it fits: a genuinely **independent, batched, low-to-no-reasoning**
set of mechanical tasks, where running several Haiku implementors concurrently
under a validated schema is worth the rigidity. A single discrete task does NOT
need a 1-agent workflow — use direct execution. Anything reasoning-dense,
tightly-coupled, or that you are not confident lands first-pass → own it (the
default-own posture in `3t-core.md` applies in workflow mode unchanged). The
workflow's value is the reliable, truncation-proof return on a *known-safe batch*;
it does not rescue work that was the wrong shape to delegate. A workflow that
burns its budget on a doomed task is the failure tax with extra steps — the schema
makes the *report* reliable, not the *work* succeed.

**Hard rules:**
- **Announce every delegation.** Before launching, say one line:
  "Delegating this batch via a workflow — N implementor(s)." Standing
  authorization, but per-use visibility — never spawn silently.
- **Haiku only.** Every implementor `agent()` call in the workflow pins
  `model: 'haiku'`. `agent()` defaults to inheriting your (possibly larger)
  session model — workflow implementors must never run on it.
- **The audit still runs.** Schema makes the *report* reliable, not the *work*
  complete. After the workflow returns you STILL independently re-run build/test
  (POST-DELEGATION AUDIT in `3t-core.md`). Do not skip it because the report
  looks clean.
- **A workflow failure is NOT proof the work failed — audit before you believe it.**
  A long implementor run (build-fix loop, unverified library API — the exact tasks
  SPEC SIZING says to delegate) can exhaust its turn budget *before* it calls
  `StructuredOutput`, so the workflow returns `failed`
  ("subagent completed without calling StructuredOutput") with no result object —
  even though the files were written and the build passes. Treat this specific
  failure as a **SOFT HALT**, not a dead end:
  1. **Assume files may exist.** Do NOT assume the task was skipped.
  2. **Run the POST-DELEGATION AUDIT immediately** — read each spec file, run the
     build/tests. This is the same audit you run after a clean return.
  3. **Fix forward.** Build passes → accept the result and note the non-compliance.
     Incomplete → finish it yourself or re-delegate the remainder as a ≤6-write spec.
  4. Do NOT blindly re-invoke the same workflow expecting compliance — a second run
     hits the same ceiling. If it was budget exhaustion, treat it as a ROUTING
     failure (see HALT HANDLING in `3t-core.md`): the work was the wrong shape for
     Haiku. Own it or split it smaller — do NOT raise the turn cap and retry.
- **Escalation is traded for reliable returns.** A workflow runs in the
  background; you are not watching mid-run, so the inline ESCALATION
  ownership-transfer handshake cannot operate. A blocker comes back as a
  structured `escalation` flag in the schema, which you handle AFTER the workflow
  completes — never mid-flight. Therefore delegated work must be well-specified
  (Tech Lead Standard) and free of likely mid-run intervention; anything
  tightly-coupled or escalation-prone you own directly, same as mode off.
- **Shared-file writes still serialize.** INDEX.md / CONTEXT.md / registration
  files go to ONE agent or are done by you post-reconcile — same rule as fork
  mode. Use `isolation: 'worktree'` only when parallel agents would otherwise
  collide on the same files.

---

## DYNAMIC WORKFLOW COORDINATION

For an independent batch you've judged a good workflow fit, this is the delegation
path; single discrete tasks and reasoning-dense work do NOT use it (see "What it
changes" above). The win is a schema-validated, truncation-proof return on a
known-safe batch.

Each implementor `agent()` call MUST set `agentType: 'claude-3t:implementor'`,
`model: 'haiku'` (never inherit the session model), and `schema:
COMPLETION_SCHEMA`. Announce the delegation first ("Delegating via a workflow —
N implementor(s)").

Pick the shape from the mode-on table above:
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
   (`3t-core.md`). The schema guarantees the report arrived intact; it does NOT
   guarantee the work is complete.
4. **Memory writes** — `specQuality: 'had gaps'` → EXECUTOR_MEMORY.md (mandatory);
   durable findings → MEMORY.md / cold storage + INDEX row.

Shared-file writes (INDEX.md, CONTEXT.md, registrations) are never split across
parallel agents — route them to one agent or do them yourself at reconcile. Use
`isolation: 'worktree'` only if parallel agents would otherwise collide on files.
