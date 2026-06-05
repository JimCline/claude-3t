---
name: 3t-start
description: Start or resume a 3-tier agent session. Loads the bundled
  executor protocol, all hot-memory files, scans the cold-storage index,
  verifies the implementor agent, detects project state, and routes into the
  design flow. Run at the start of every session in a 3t project.
---

## STEP 0 — Mark the session active

Running this skill means 3t is active for this session. Set the flag the
SessionStart hook reads, so the protocol is reloaded automatically after any
context compaction:

```bash
mkdir -p .claude && touch .claude/.3t-active
```

## STEP 1 — Load the executor protocol (bundled with the plugin)

Read both protocol files now, from the plugin root. Do not proceed until read.

```
Read: ${CLAUDE_PLUGIN_ROOT}/context/3t-core.md
Read: ${CLAUDE_PLUGIN_ROOT}/context/3t-reference.md
```

These define your operating instructions as the executor tier.

---

## STEP 2 — Load hot memory (explicit reads, in order)

Read each project file now. Do not proceed until all are read.

```
Read: .claude/context/MEMORY.md
Read: .claude/context/CONTEXT.md
Read: .claude/context/EXECUTOR_MEMORY.md
Read: .claude/context/IMPLEMENTOR_MEMORY.md
Read: .claude/context/OVERRIDE_LOG.md
```

If any are missing, the project was not initialized — tell the user to run
`/claude-3t:3t-init` first, then stop.

Confirm to user: "Protocol + hot memory loaded."

---

## STEP 3 — Scan cold-storage index (do NOT load the files)

```
Read: .claude/context/cold/INDEX.md
```

The cheap retrieval layer. Hold the index in mind — read individual cold files
later ONLY when a task's need matches an index description. Do not bulk-load the
cold directory.

Tell user: "Cold index scanned — [N] entries available on demand."

---

## STEP 4 — Verify the implementor agent

The implementor ships with this plugin as the subagent `claude-3t:implementor`
(Haiku). Confirm it is available before delegating. If `/agents` does not list
it, the plugin is not fully loaded — tell the user to run `/reload-plugins`,
then continue.

---

## STEP 4a — Verify the advisor (per-developer, every session)

The advisor is the architect tier, but it is **experimental and per-developer**:
a committed `advisorModel` in `settings.json` is only a team default — it does
not guarantee each teammate has the advisor enabled in their own client. `/3t-init`
runs once per project, so a teammate who clones an already-initialized repo never
sees the advisor setup. This step closes that gap on every session start.

Check whether an advisor model is configured:

```bash
grep -hs '"advisorModel"' .claude/settings.json .claude/settings.local.json ~/.claude/settings.json 2>/dev/null | head -1
```

- **Found** → tell the user: "Advisor configured: [model]." No action needed.
- **Not found** → recommend setup, do NOT block:

  ```
  No advisor model configured for you yet. The architect tier routes hard or
  irreversible decisions to a stronger model. To enable it, run /advisor and
  pick Opus (experimental). Until then I'll fall back to explicit, labeled
  in-context reasoning ("Advisor pass:") for hard decisions.
  ```

Do not run a token-spending smoke-test every session — the grep is enough. The
first actual advisor consult this session reveals whether the feature responds;
if it doesn't, use the labeled in-context fallback.

---

## STEP 4b — Delegation mode (per-developer, first run only)

Workflow delegation is an opt-in **mode switch**: when enabled, the executor
routes ALL delegated implementor work through dynamic workflows (the `Workflow`
tool) instead of fork mode / single-implementor invokes, so every delegation
returns a schema-validated report that cannot truncate. When disabled (default),
delegation behaves exactly as today (direct + fork mode). See "DYNAMIC WORKFLOW
DELEGATION" in `3t-core.md`. The choice is per-developer and stored in a
gitignored flag.

Read the stored preference:

```bash
test -f .claude/.3t-workflows && cat .claude/.3t-workflows
```

- **Flag present** → report state in ONE line and move on; do NOT re-prompt:
  "Workflow delegation: enabled." or "Workflow delegation: off (direct + fork)."
- **Flag absent (first run)** → offer the choice, do NOT block. Explain briefly:

  ```
  Optional: dynamic-workflow delegation. With it on, I route every delegated
  implementor batch through a background workflow that returns a structured,
  truncation-proof completion report — and can fan a large independent batch out
  to a Haiku implementor pool. The tradeoff: a workflow runs in the background,
  so I can't take over an escalation mid-run — a blocker comes back as a flag I
  handle after the batch finishes. Off (default) keeps today's direct + fork
  delegation. You can change this anytime by editing .claude/.3t-workflows.

  Enable workflow delegation? (yes / no)
  ```

  Write the answer to the flag (`enabled` or `disabled`):

  ```bash
  printf 'enabled\n'  > .claude/.3t-workflows   # if yes
  printf 'disabled\n' > .claude/.3t-workflows   # if no
  ```

Keep it cheap — no smoke-test in this routine path. Implementor agents spawned by
a workflow always run as **Haiku** (the recipe pins `model: 'haiku'`); workflow
delegation must never run an implementor on a larger model.

---

## STEP 5 — Detect project state

Scan for artifacts:

```bash
test -s .claude/context/CONTEXT.md && echo "CONTEXT_EXISTS"
test -s PRD.md && echo "PRD_EXISTS"
test -s KANBAN.md && echo "KANBAN_EXISTS"
ls .github/issues 2>/dev/null && echo "GITHUB_ISSUES"
ls docs/adr/*.md 2>/dev/null | head -1 && echo "ADRS_EXIST"
git log --oneline -5 2>/dev/null
```

Form a judgement. Show assessment to user:

```
── Project State ──────────────────────────────────────
I can see:
  [bullet per artifact found]

My read: [one sentence — where you think things are]

Is that right, or should we pick up from a different point?
──────────────────────────────────────────────────────
```

Wait for confirmation. Then offer:

```
Where would you like to pick up?

  A) Start fresh — /grill-with-docs from the beginning
  B) Continue grill session — more domain language work
  C) Write the PRD — domain resolved, ready to synthesise
  D) Create issues — PRD approved, break into tickets
  E) Execute — start on a specific issue
  F) Status review — show what's in progress

[default: X based on what I found]
```

If ALL memory files empty AND no artifacts → true cold start. Recommend the
canonical flow: `/grill-with-docs → /advisor → /to-prd → /to-issues → execution`.
For implementation, delegate to `claude-3t:implementor`; for hard or irreversible
design decisions, consult the advisor (Opus) — it is the architect tier.

---

## STEP 6 — Surface queued approvals

Check MEMORY.md approval queue. Surface any pending items before proceeding.
