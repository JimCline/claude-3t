# claude-3t (plugin)

Three-tier Claude Code agent architecture, packaged as a plugin — no installer
script, no server, no container.

| Tier | Model | Delivered by |
|---|---|---|
| **Executor** | your session model (primary session) | SessionStart hook anchor + `/claude-3t:3t-start` skill |
| **Architect** | Opus | native advisor (experimental), set by `advisorModel` in project `settings.json` (`/claude-3t:3t-init`) |
| **Implementor** | Haiku (default — configurable, see below) | `claude-3t:implementor` subagent |

## Install

```bash
claude plugin marketplace add JimCline/claude-3t
claude plugin install claude-3t@claude-3t
```

(For local development from a clone: `claude plugin marketplace add /path/to/claude-3t`.)

## Per-project, even when installed globally

The plugin can be installed globally but stays **dormant** in every project until
you initialize it. The SessionStart hook gates on the activation marker
`.claude/context/cold/INDEX.md` (committed, so clones auto-activate):

- No marker → hook emits nothing; the session is untouched.
- Marker present, on session **start/resume** → the executor asks you
  *"Start the 3-tier workflow for this session? (yes/no)"*. Yes runs
  `/claude-3t:3t-start`; no proceeds normally with nothing loaded.
- Marker present, on **compact/clear** → no re-prompt. A per-session flag
  (`.claude/.3t-active`, set by `/claude-3t:3t-start`, reset on each new session)
  tells the hook whether you'd opted in: if so it injects an unconditional
  "reload the protocol" instruction; if not, it stays silent.

So there are two opt-in layers: initializing a project (the marker) decides where
the plugin *offers* itself, and the per-session yes/no decides whether it actually
loads. Both must be yes for the protocol to engage.

## Use

```
/claude-3t:3t-init        # once per project — scaffolds writable memory + settings.json,
                # plants the activation marker. Restart Claude afterward.
/claude-3t:3t-start       # begin/resume a session — loads protocol + hot memory
/claude-3t:3t-status      # memory state, cold index, model status, compliance
/claude-3t:3t-checkpoint  # write a session snapshot now
/claude-3t:3t-leaving     # departure protocol for autonomous work
/claude-3t:3t-remove      # deactivate or fully remove 3t from this project
```

Delegate implementation to `claude-3t:implementor`. Hard/irreversible design
decisions route to the advisor (Opus) — the architect tier.

## Removing or deactivating 3t in a project

Run `/claude-3t:3t-remove`. It offers two modes (and confirms before deleting):

- **Deactivate** — drops a `.claude/.3t-disabled` flag the hook checks, so 3t goes
  dormant in this project while every file stays put. Reversible: `rm
  .claude/.3t-disabled`.
- **Full remove** — deletes the scaffolded memory + cold files, strips the 3t
  `.gitignore` block and the `advisorModel` key, and leaves `docs/adr` and your
  other settings (including your `model`) intact. Committed files (`CONTEXT.md`,
  `cold/`) are recoverable with `git restore`.

Either way the plugin stays installed globally. To remove it everywhere:
`claude plugin uninstall claude-3t`.

## Choosing the advisor model

The advisor (architect tier) is the native, **experimental** advisor escalation:
when the executor needs stronger judgement it escalates to the advisor model,
then resumes. It is set by the `advisorModel` key in the project's `.claude/settings.json`.
The executor/advisor split works under **any** executor model, so `/claude-3t:3t-init`
sets only `advisorModel` and leaves your main `model` alone:

```json
{
  "advisorModel": "opus"
}
```

Claude Code's advisor strategy recommends Sonnet as the main model with Opus as
the advisor — near-Opus judgement at lower token cost
(https://claude.com/blog/the-advisor-strategy) — but that's a recommendation, not
a requirement: run Opus at low effort or any other executor and the advisor tier
still works. To change the advisor, edit `advisorModel` to any model alias
(`opus`, `sonnet`, `haiku`) or a pinned model ID (e.g. `claude-opus-4-8`); it
takes effect next session. This is a **native, per-project** setting — no plugin
file involved — so it survives plugin updates.

For interactive setup or a one-off change in the current session, type
`/advisor` at the prompt to pick or confirm the advisor model (Opus / Sonnet /
no advisor) without editing `settings.json`. Because the feature is experimental
and may be unavailable, the executor falls back to explicit, labeled in-context
reasoning for hard decisions when no advisor responds.

## Choosing the implementor model

The implementor defaults to the `haiku` alias (latest Haiku, default effort),
set in `agents/implementor.md`:

```yaml
model: haiku
```

To use a different model, change that one line to any model alias (`sonnet`,
`opus`, `haiku`) or a pinned model ID (e.g. `claude-sonnet-4-6`). The executor
and advisor are set elsewhere — only the implementor's model lives here.

Where the file is depends on how you installed the plugin:

- **Local marketplace** (`marketplace add /path/to/claude-3t`) → edit
  `claude-3t-plugin/agents/implementor.md` in your clone; the change is live next
  session.
- **GitHub marketplace** → the file lives under your Claude Code plugins
  directory (e.g. `~/.claude/plugins/.../claude-3t/agents/implementor.md`). Edits
  there work but are **overwritten when you update the plugin**, so for a durable
  change, fork the repo and point your marketplace at the fork.

Note: dropping a project-scoped `.claude/agents/implementor.md` does **not**
override this — the executor invokes the namespaced `claude-3t:implementor`, so a
plain project `implementor` is a separate agent. Editing the plugin file is the
reliable lever.

## Development — releasing changes

**Bump `version` in `.claude-plugin/plugin.json` on every change you want installs
to pick up.** It is the signal `claude plugin update` compares — without a bump,
`update` reports "already at the latest version" even though files changed.

To pull a new version into a project after bumping:

```bash
claude plugin marketplace update claude-3t   # refresh the cached marketplace listing
claude plugin update claude-3t               # installs the newer version
# restart Claude
```

If `update` still says you're current, reinstall: `claude plugin uninstall
claude-3t && claude plugin install claude-3t@claude-3t`. Optionally use `claude
plugin tag` to cut a validated `claude-3t--vX.Y.Z` git tag for a real release.

## Layout

```
claude-3t-plugin/
├── .claude-plugin/plugin.json
├── hooks/{hooks.json, session-start.mjs}   # gated SessionStart anchor
├── context/{3t-core,3t-reference}.md        # executor protocol (read by /claude-3t:3t-start)
├── skills/{3t-start,3t-init,3t-status,3t-checkpoint,3t-leaving}/SKILL.md
├── agents/implementor.md                    # Haiku subagent
└── templates/                               # blank project files /claude-3t:3t-init copies in
```
