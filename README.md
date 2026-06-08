# claude-3t: Structured Claude Code Sessions

*Previously marketed as a "3-tier agent architecture." Read the assessment below
before adopting that pattern.*

## Honest assessment: the Haiku implementor tier does not achieve its goal

This plugin was built on the premise that delegating implementation work to a
cheaper model tier (Haiku) would save tokens. After extensive use and a
controlled experiment, that premise is false.

**The data (12-agent controlled experiment, 2 task types × 2 tiers × 3
replicates, all independently verified):**

| Task type | Haiku avg tokens | Sonnet avg tokens | Haiku tool-uses | Sonnet tool-uses |
|---|---|---|---|---|
| Determined/mechanical (ideal) | 17,216 | 15,401 | 5 | 3 |
| Unfamiliar API (realistic) | 34,754 | 33,878 | 33 | 18 |

On the best-case task, Haiku costs **12% more** than Sonnet, not less — the
tier-pricing advantage is fully absorbed by Haiku's overhead. On realistic
feature work involving any unfamiliar library API, the token cost is
**essentially identical** while Haiku burns **1.8× more build iterations** to
converge. In one run Haiku used 42 tool calls against a 50-turn budget — one
added API wrinkle away from a budget-exhaustion HALT on a simple counter app.

When a delegation fails (wrong shape of work reaches Haiku), the failure tax is
~3× a clean run: you pay executor tokens to write the spec, Haiku tokens to
flail to the turn limit, and executor tokens again to read the wreckage and redo
it. The savings window is real but so narrow that one failure per five clean
runs wipes it out.

**Why this is hard to fix in user-space.** The architecture shipped 20 PRs of
routing patches — gate cards, confidence predicates, turn-limit freezes, workflow
modes, load-shedding signals — all trying to widen the range of work Haiku can
reliably handle. The patches kept coming because the underlying problem is a
capability gap, not a protocol gap. For Haiku to reliably implement against an
unfamiliar API, it would need the same ability to reason through novel
documentation that makes Sonnet more expensive in the first place.

What would actually achieve the goal is a **native Anthropic implementor
capability** analogous to how `advisorModel` works today — a harness-level
mechanism that routes *verified mechanical work* to a cheaper tier with
guaranteed structured returns and harness-managed retry, rather than a
prompt-level protocol asking the model to self-assess whether a task is
delegation-safe. That would remove the capability-ceiling failure mode entirely.
Until that exists, user-space solutions hit the same wall this project hit.

**Recommendation:** Use **Sonnet + Advisor** (`advisorModel: "claude-opus-4-8"`).
Let the executor model (Sonnet) do all implementation work directly. Consult Opus
via `/advisor` for hard, irreversible, or design-critical decisions. This is
less architecturally interesting but it is what actually works — and the
remaining value in this plugin (memory model, session continuity, token tooling,
lifecycle skills) supports that pattern without the implementor layer.

The Haiku implementor is not removed from the plugin — it still functions for
the narrow case where it genuinely wins: explicitly mechanical batch work with no
API discovery (rename 40 files, transcribe a settled ADR to disk, apply a known
transform uniformly). But it should not be the default path for feature
implementation, and the protocol no longer pretends it is.

---

## What remains of value

- **Advisor tier (`/advisor`)** — Opus for hard/irreversible decisions. Proven,
  pays for itself on design-critical choices. Keep this.
- **Hot/cold file-based memory** — `MEMORY.md` / `CONTEXT.md` / `cold/`
  structured persistence. Solid pattern for any project.
- **SessionStart hook** — Automatic context reload after compaction. Useful
  regardless of tier count.
- **Token measurement** — `bin/session-tokens.mjs` reads real API-reported
  counts from any historical session transcript. Useful for any project.
- **Session lifecycle skills** — `/3t-debrief`, `/3t-checkpoint`, `/3t-tokens`,
  `/3t-status`. Session management that has nothing to do with the implementor.
- **Auto-verify (`.3t-verify`)** — Inject build/test results after work without
  spending a tool call. Good pattern regardless of tier.

---

```
You
  → Executor       (your session model — runs sessions, decides, implements)
      → advisor       (Opus — hard/irreversible reasoning; produces no artifacts)

Memory: file-based, in .claude/context/
  → Hot:  small files loaded in full when a session starts
  → Cold: durable facts loaded on demand via cold/INDEX.md
```

---

## What this plugin gives you

**The executor (your session model) does the implementation.** This is not an
architecture where work is split across tiers — it is a set of structural supports
that make long, complex sessions more reliable:

- **Advisor (Opus)** — escalate hard, irreversible, or design-critical decisions to
  a stronger reasoning model. It produces no artifacts; it sharpens your judgement
  and returns control to you. Set once in `settings.json`; invoked via `/advisor`.
- **Structured memory** — a small always-loaded **hot** set of files
  (`MEMORY.md`, `CONTEXT.md`, `EXECUTOR_MEMORY.md`) plus an indexed **cold** store
  pulled on demand. Sessions survive compaction; knowledge accumulates across runs.
- **Session lifecycle tools** — `/3t-start`, `/3t-checkpoint`, `/3t-debrief`,
  `/3t-tokens` — so you can open a session with full context, snapshot progress,
  and capture lessons without ceremony.
- **Token measurement** — `bin/session-tokens.mjs` reads exact API-reported counts
  from any session transcript; `bin/token-baseline.mjs` estimates what each
  context artifact costs statically.

The plugin is **opt-in twice**: per project (you initialize it) and per session
(it asks before loading). Installed globally, it stays invisible everywhere else.

---

## How it works

Everything ships in one plugin (`claude-3t-plugin/`):

| Piece | Delivered as | Purpose |
|---|---|---|
| Session prompt + protocol reload | `SessionStart` hook | loads context on start and after compaction |
| `/3t-start`, `/3t-init`, `/3t-status`, `/3t-checkpoint`, `/3t-tokens`, `/3t-leaving` | skills | session lifecycle |
| Session protocol (`3t-core`, `3t-reference`) | bundled context, loaded by `/3t-start` | working memory + advisor flow |
| advisor | `advisorModel` in project `settings.json` | Opus for hard decisions |

**The activation chain:**

1. **Install the plugin once** (globally). It does nothing until a project opts in.
2. **`/claude-3t:3t-init`** (once per project) scaffolds the memory files,
   writes `settings.json` with `advisorModel`, and plants a committed marker
   (`.claude/context/cold/INDEX.md`).
3. On each **session start** in a marked project, the hook asks:
   *"Start the workflow for this session? (yes/no)"*
   - **Yes** → runs `/claude-3t:3t-start`, which loads the protocol + hot memory.
   - **No** → the session proceeds normally; nothing is loaded.
4. After a **context compaction**, the hook checks the per-session flag and, if
   active, tells the executor to reload the protocol automatically.

---

## Install & use

```bash
claude plugin marketplace add JimCline/claude-3t
claude plugin install claude-3t@claude-3t
```

> Local development: `claude plugin marketplace add /path/to/claude-3t` (reads
> the working tree, no push needed).

Then, in a project:

```
/claude-3t:3t-init     # once per project — scaffold + settings + marker, then restart
/claude-3t:3t-start    # each session — loads protocol + hot memory (the hook prompts you)
```

| Command | What it does |
|---|---|
| `/claude-3t:3t-init` | Initialize a project (once) |
| `/claude-3t:3t-start` | Begin/resume a session — load protocol + hot memory |
| `/claude-3t:3t-status` | Memory state, cold index, model status |
| `/claude-3t:3t-tokens` | Measured session token usage by category and exchange |
| `/claude-3t:3t-checkpoint` | Write a session snapshot now |
| `/claude-3t:3t-debrief` | Post-work debrief — route lessons to memory or upstream feedback |
| `/claude-3t:3t-leaving` | Departure protocol for autonomous work |
| `/claude-3t:3t-remove` | Deactivate or fully remove from the project |

Full plugin documentation: [`claude-3t-plugin/README.md`](claude-3t-plugin/README.md).

---

## Memory model — hot / cold

| Tier | Files | Committed? | Loaded |
|---|---|---|---|
| **Hot** | `MEMORY.md`, `CONTEXT.md`, `EXECUTOR_MEMORY.md`, `OVERRIDE_LOG.md` | `CONTEXT.md` only | in full each session |
| **Cold** | `cold/INDEX.md` + `cold/*.md` | yes | index always scanned; topic files on demand |

A fact belongs in cold storage only if it is **durable** (true after a year of
commits), **cold** (not needed every task), and **expensive to re-derive**.
Volatile facts (signatures, config values, versions) are never stored — they are
re-derived from the code.

---

## Built-in tooling

- **`bin/session-tokens.mjs`** — reads exact API-reported token counts from any
  session transcript (current or historical by UUID/path). Breaks down output,
  cache-creation, uncached input, and cache-read separately so comparisons are
  meaningful. Run: `node bin/session-tokens.mjs [uuid-or-path]`.
- **`bin/token-baseline.mjs`** — static estimate of what every context artifact
  costs (protocol files, hot memory, hook injections). Use for before/after deltas
  when trimming context. Run: `node bin/token-baseline.mjs [project-path]`.
- **Auto-verify (`.claude/.3t-verify`, opt-in)** — drop one shell command into
  this file (e.g. `npm test -s` or `dotnet build`). After tool-call-heavy work,
  the `post-agent.mjs` hook runs it and injects a PASS/FAIL summary. 120s timeout.
- **Transient-output policy** (protocol guidance) — the executor summarizes
  read-once output (build/test/search/logs) at the source rather than holding raw
  bytes, but all MCP output and canonical reference content are kept verbatim.

---

## Optional companion resources

- **Context Mode** — compresses large tool output so it doesn't flood context.
  `claude plugin marketplace add mksglu/context-mode && claude plugin install context-mode@context-mode`
- **Matt Pocock skills** — `/grill-with-docs`, `/to-prd`, `/to-issues`.
  `npx skills@latest add mattpocock/skills`
