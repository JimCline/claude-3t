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

If `.claude/settings.json` does not exist, ask the user which model setup they
want, then write it. Default recommendation: `opusplan` + advisor on Opus.

```jsonc
{
  "model": "opusplan",
  "advisorModel": "opus"
}
```

If `.claude/settings.json` already exists, do NOT overwrite it. Instead show the
two keys and tell the user to merge them in manually:
`"model": "opusplan"`, `"advisorModel": "opus"`.

The advisor is the architect tier — `advisorModel` is what makes hard/irreversible
design decisions route to Opus. Confirm it is set before finishing.

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
# 3-tier transient flags (session activation + deactivation)
.claude/.3t-active
.claude/.3t-disabled
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
