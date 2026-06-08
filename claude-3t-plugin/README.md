# claude-3t (plugin)

Structured session management for Claude Code: **Sonnet + Advisor + file-based
memory**. No installer, no server, no container.

```
You (Sonnet — implements, decides, reviews)
  → /advisor  (Opus — hard/irreversible reasoning; produces no artifacts)

Memory: .claude/context/
  → Hot:  MEMORY.md, CONTEXT.md, EXECUTOR_MEMORY.md  — loaded each session
  → Cold: cold/INDEX.md + cold/*.md  — indexed, loaded on demand
```

---

## Install

```bash
claude plugin marketplace add JimCline/claude-3t
claude plugin install claude-3t@claude-3t
```

Local development (no push needed):
```bash
claude plugin marketplace add /path/to/claude-3t
```

---

## Per-project, even when installed globally

The plugin gates on a committed marker (`.claude/context/cold/INDEX.md`):

- **No marker** → hook emits nothing; session is untouched.
- **Marker present, session start/resume** → the executor is asked *"Start the
  workflow for this session? (yes/no)"*. Yes runs `/claude-3t:3t-start`; no
  proceeds normally.
- **Marker present, compact/clear** → if the session was active (`.claude/.3t-active`
  flag set by `/3t-start`), the protocol is reloaded automatically.

---

## Use

```
/claude-3t:3t-init        # once per project — scaffolds memory + settings.json + marker, then restart
/claude-3t:3t-start       # each session — loads protocol + hot memory
/claude-3t:3t-status      # memory state, cold index, model status
/claude-3t:3t-tokens      # measured session token usage by category / exchange
/claude-3t:3t-checkpoint  # write a session snapshot now
/claude-3t:3t-debrief     # post-work debrief — route lessons to memory / upstream
/claude-3t:3t-feedback    # capture a baseline-protocol gap for upstream
/claude-3t:3t-leaving     # departure protocol for autonomous work
/claude-3t:3t-remove      # deactivate or fully remove from this project
/claude-3t:3t-reset       # wipe to zero so /3t-init can re-run (destructive — confirms first)
```

---

## Advisor

The advisor is the native `advisorModel` escalation: when you need stronger
judgement on a hard or irreversible decision, type `/advisor` at the prompt.
Opus reasons through it and returns; the executor continues. It produces no
artifacts — only sharpens your decision.

`/claude-3t:3t-init` writes `advisorModel: "opus"` to the project
`.claude/settings.json`. Change it to any model alias or pinned ID; it takes
effect next session. It is a native Claude Code setting — survives plugin
updates.

---

## Memory model

| Layer | Files | Committed? | Loaded |
|---|---|---|---|
| **Hot** | `MEMORY.md`, `CONTEXT.md`, `EXECUTOR_MEMORY.md`, `OVERRIDE_LOG.md` | `CONTEXT.md` only | in full each session |
| **Cold** | `cold/INDEX.md` + `cold/*.md` | yes | index always scanned; topic files on demand |

Store only what is **durable** (true a year from now), **cold** (not needed
every task), and **expensive to re-derive**. Never store volatile facts
(signatures, config values, versions) — re-derive those from code.

---

## Token tooling

**`bin/session-tokens.mjs`** reads exact API-reported counts from any session
transcript — current session auto-detected, or pass a UUID / `.jsonl` path:

```bash
node bin/session-tokens.mjs                   # current session
node bin/session-tokens.mjs <uuid>            # any past session by id
node bin/session-tokens.mjs /path/to/file.jsonl
```

Reports output, cache-creation, uncached input, and cache-read separately (do
not sum them — the cache-read prefix is re-counted every turn).

**`bin/token-baseline.mjs`** statically estimates what every context artifact
costs, so optimizations are judged by a measured delta:

```bash
node bin/token-baseline.mjs [project-path]
```

---

## Auto-verify (`.claude/.3t-verify`, opt-in)

Drop one shell command into `.claude/.3t-verify` (e.g. `npm test -s` or
`dotnet build`). The `post-agent.mjs` hook runs it after tool-call-heavy work
and injects a PASS/FAIL summary — one fewer tool call for the executor to spend
on a build check. 120s timeout; absent file → no-op.

---

## Removing / deactivating

Run `/claude-3t:3t-remove`:

- **Deactivate** — drops `.claude/.3t-disabled`; 3t goes dormant while files
  stay. Reverse: `rm .claude/.3t-disabled`.
- **Full remove** — deletes scaffolded memory + cold files, strips the 3t
  `.gitignore` block and `advisorModel` key. Committed files recoverable with
  `git restore`.

To remove the plugin globally: `claude plugin uninstall claude-3t`.

---

## Contributing feedback

1. **Capture** — run `/claude-3t:3t-debrief` after a rough session (routes
   lessons to project memory and writes protocol gaps to
   `.claude/context/3t-plugin-feedback.md`), or `/claude-3t:3t-feedback` for a
   standalone protocol-gap capture.
2. **File** — open a GitHub issue on **JimCline/claude-3t** with label
   `feedback`, pasting the entry block as the body.
3. **Apply** — in this repo, run `/3t-apply-feedback` to cluster, propose, and
   apply approved changes.
4. **Update** — `claude plugin marketplace update claude-3t && claude plugin update claude-3t`.

---

## Releasing changes

Bump `version` in `.claude-plugin/plugin.json` on every change you want installs
to pick up. Without a bump, `claude plugin update` reports "already current."

```bash
claude plugin marketplace update claude-3t   # refresh cached listing
claude plugin update claude-3t               # install newer version
# restart Claude
```

---

## Layout

```
claude-3t-plugin/
├── .claude-plugin/plugin.json
├── hooks/hooks.json
├── hooks/session-start.mjs          # gated SessionStart anchor
├── hooks/pre-agent.mjs              # injects gate checklist (see Legacy)
├── hooks/post-agent.mjs             # auto-verify + post-delegation audit (see Legacy)
├── bin/session-probe.mjs            # one-shot state scan for /3t-start
├── bin/session-tokens.mjs           # measured token report from session transcript
├── bin/token-baseline.mjs           # static token-cost estimate of context artifacts
├── context/3t-core.md               # session protocol, loaded once/session
├── context/3t-reference.md          # advisor flow, fork mode, occasional protocols
├── context/3t-gate.md               # PRE-AGENT checklist (Legacy — implementor use)
├── context/3t-workflow-mode.md      # workflow delegation protocol (Legacy)
├── docs/measurement-protocol.md     # token economy experiment results
├── skills/{3t-start,3t-init,3t-status,3t-tokens,3t-checkpoint,
│          3t-debrief,3t-feedback,3t-leaving,3t-remove,3t-reset}/SKILL.md
├── agents/implementor.md            # Haiku subagent (Legacy — see below)
└── templates/                       # blank project files /3t-init copies in
```

---

## Legacy: Haiku implementor tier

The plugin ships a `claude-3t:implementor` Haiku subagent and delegation
protocol (`3t-core.md`, `3t-gate.md`, `3t-workflow-mode.md`). These are
**not removed** — they function and may be useful for narrow mechanical batch
work (apply the same transform to many files, transcribe a settled document to
disk). But they are no longer the recommended path for general feature
implementation.

The short version of why: on unfamiliar-API work, Haiku and Sonnet cost the same
in tokens while Haiku burns 1.8× more build iterations and runs near the turn
budget on tasks a real project would consider simple. The failure tax (~3× a
clean run when a delegation fails) wipes out any tier-pricing advantage. See
[`docs/measurement-protocol.md`](docs/measurement-protocol.md) for the full
controlled experiment and data.

If you want to use the implementor for an explicitly mechanical batch, it is
still there: invoke `claude-3t:implementor` directly and follow the
PRE-AGENT CHECKLIST in `3t-gate.md`. The protocol has not been removed — it
just is not the default recommendation anymore.
