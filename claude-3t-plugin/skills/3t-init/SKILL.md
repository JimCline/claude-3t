---
name: 3t-init
description: Initialize the current project for the 3-tier agent architecture.
  Scaffolds the writable hot/cold memory files, writes settings.json with the
  advisor model, updates .gitignore, and plants the activation marker so the
  SessionStart hook engages here. Run once per project. Replaces the old
  claude-3t-init.sh installer.
---

Initialize this project for 3-tier agents. The plugin supplies the protocol,
skills, and the implementor agent — this skill only scaffolds the per-project
**writable** files and turns the project's activation marker on.

## Step 1 — Create directories

```bash
mkdir -p .claude/context/cold docs/adr
```

## Step 2 — Copy the blank memory templates (skip any that exist)

The blank templates ship with the plugin. Copy each only if it does not already
exist (never clobber a populated memory file):

```bash
SRC="${CLAUDE_PLUGIN_ROOT}/templates"
for f in MEMORY.md CONTEXT.md EXECUTOR_MEMORY.md IMPLEMENTOR_MEMORY.md OVERRIDE_LOG.md; do
  [ -f ".claude/context/$f" ] || cp "$SRC/$f" ".claude/context/$f"
done
[ -f ".claude/context/cold/INDEX.md" ] || cp "$SRC/cold/INDEX.md" ".claude/context/cold/INDEX.md"
```

`.claude/context/cold/INDEX.md` is the **activation marker** — once it exists, the
plugin's SessionStart hook engages the 3-tier protocol in this project (and stays
dormant everywhere else). It is committed, so a fresh clone of an already-3t
project auto-activates without re-running this skill. That is the per-project
opt-in switch.

## Step 3 — Write settings.json (model config)

The executor/advisor split works under **any** executor model — Sonnet, or Opus
at low effort, or anything else. So the only key the plugin actually sets is
`advisorModel`; the main `model` is left to the user's preference. Do NOT write
or overwrite `model`.

Set `advisorModel: opus` — the native, load-bearing key that routes hard or
irreversible decisions to Opus when you consult the advisor (changing its value
changes which model responds). If `.claude/settings.json` does not exist, write:

```jsonc
{
  "advisorModel": "opus"
}
```

If it already exists, do NOT overwrite it — merge in `"advisorModel": "opus"`
(or tell the user to). Confirm it is set before finishing.

**Recommendation only (don't impose):** Claude Code's advisor strategy suggests
Sonnet as the main model with Opus as the advisor — near-Opus judgement at lower
token cost (https://claude.com/blog/the-advisor-strategy), which also fits the
3t thesis of a lean executor that coordinates and delegates. Mention it, but
whatever the user runs as their executor is fine; the advisor tier is orthogonal.

## Step 3a — Configure & verify the advisor (recommended)

Ask the user: **"Configure the advisor model now? (recommended)"**

If yes:
1. Have them run **`/advisor`** — the native (experimental) picker — and select
   **Opus** as the advisor. `advisorModel` written in Step 3 is the durable
   default; `/advisor` is the interactive way to set or confirm it. (See
   https://claude.com/blog/the-advisor-strategy.)
2. **Smoke-test it:** consult the advisor once now (e.g. ask it to sanity-check
   this very setup). If it responds, the advisor tier is live in this install.
   If it does NOT respond — the feature is experimental and may be unavailable —
   tell the user the executor will fall back to explicit, labeled in-context
   reasoning for hard decisions until the advisor is enabled. The protocol works
   either way.

Note: this configures the advisor for **you**, the initializing developer. The
advisor is experimental and per-developer, so teammates who clone an
already-initialized repo will not run this skill. They are handled by
`/claude-3t:3t-start`, which checks for an advisor every session and recommends
setup if none is configured. Re-running this step is harmless (it only merges the
`advisorModel` key), so it is safe to run again.

## Step 4 — Update .gitignore

Append (only if not already present) the per-developer memory exclusions.
`CONTEXT.md` and `cold/` stay committed — they are shared institutional knowledge.

```bash
grep -q "CLAUDE.local.md" .gitignore 2>/dev/null || cat >> .gitignore <<'EOF'

# Claude Code 3-tier — per-developer memory (not version-controlled)
.claude/context/MEMORY.md
.claude/context/EXECUTOR_MEMORY.md
.claude/context/IMPLEMENTOR_MEMORY.md
.claude/context/OVERRIDE_LOG.md
.claude/CLAUDE.local.md
# 3-tier transient flags (session activation + deactivation + delegation mode)
.claude/.3t-active
.claude/.3t-disabled
.claude/.3t-workflows
EOF
```

## Step 5 — Confirm

Show the user the resulting tree and tell them:

```
Project initialized for 3-tier agents.

  .claude/
  ├── settings.json              ← model config (commit)
  └── context/
      ├── CONTEXT.md             ← domain glossary + ADRs (commit)
      ├── cold/INDEX.md          ← cold-storage index (commit)
      ├── MEMORY.md              ← activation marker + project state (gitignored)
      ├── EXECUTOR_MEMORY.md       ← delegation lessons (gitignored)
      ├── IMPLEMENTOR_MEMORY.md        ← execution lessons (gitignored)
      └── OVERRIDE_LOG.md        ← override tracking (gitignored)
  docs/adr/                      ← ADRs authored by the implementor

The protocol, slash commands, and the implementor agent come from the
claude-3t plugin — nothing else to install.

Restart Claude here (so the SessionStart hook picks up the new marker),
then run /claude-3t:3t-start to begin.
The canonical flow: /grill-with-docs → advisor → /to-prd → /to-issues → execution
```
