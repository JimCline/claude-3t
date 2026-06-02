---
name: 3t-remove
description: Remove or deactivate the 3-tier agent setup in the current project.
  Offers two modes — deactivate (go dormant, keep all files) or full remove
  (delete the scaffolded memory/cold files, strip the 3t .gitignore block and
  model keys). Always confirms before deleting. The reverse of /3t-init.
---

Remove 3t from this project. The plugin itself stays installed — this only
affects the current project's scaffolding.

## Step 1 — Ask which mode

Ask the user exactly this and wait:

```
How do you want to remove 3t from this project?

  D) Deactivate — stop the 3-tier workflow here but KEEP all files
     (MEMORY, CONTEXT, ADRs, cold storage). Reversible anytime.

  R) Full remove — delete the scaffolded memory + cold files, strip the 3t
     .gitignore block and the model/advisorModel keys. Keeps docs/adr and any
     unrelated settings. Committed files (CONTEXT.md, cold/) are recoverable
     via git if you change your mind.

Type D or R (or cancel):
```

## Step 2D — Deactivate

```bash
mkdir -p .claude && touch .claude/.3t-disabled
rm -f .claude/.3t-active
```

The SessionStart hook checks for `.claude/.3t-disabled` and stays silent while it
exists — so 3t goes dormant here with nothing deleted. Tell the user:

```
3t deactivated for this project. All files kept.
Reactivate anytime:  rm .claude/.3t-disabled   (or re-run /claude-3t:3t-start)
```

## Step 2R — Full remove

Confirm once more before deleting:
"Full remove will delete the 3t memory + cold files in this project. docs/adr and
your other settings are kept. Committed files are recoverable via git. Proceed? (yes/no)"

On yes:

```bash
# Scaffolded hot-memory + cold files.
# Includes the legacy SONNET_MEMORY.md / HAIKU_MEMORY.md names so projects
# initialized before the executor/implementor rename clean up fully too.
rm -f .claude/context/MEMORY.md \
      .claude/context/CONTEXT.md \
      .claude/context/EXECUTOR_MEMORY.md \
      .claude/context/IMPLEMENTOR_MEMORY.md \
      .claude/context/SONNET_MEMORY.md \
      .claude/context/HAIKU_MEMORY.md \
      .claude/context/OVERRIDE_LOG.md \
      .claude/context/cold/INDEX.md
# Dirs if now empty (run cold first, then context)
rmdir .claude/context/cold 2>/dev/null || true
rmdir .claude/context 2>/dev/null || true
# Transient flags
rm -f .claude/.3t-active .claude/.3t-disabled
```

Then:

1. **`.gitignore`** — remove the 3t block (the lines between
   `# Claude Code 3-tier — per-developer memory` and the `.claude/.3t-disabled`
   entry, inclusive). Leave the rest of `.gitignore` untouched.

2. **`.claude/settings.json`** — remove ONLY the `"model"` and `"advisorModel"`
   keys that `/3t-init` added. Preserve every other key. If those were the only
   two keys, leave `{}` (do not delete the file — the user may add settings).

3. **`docs/adr/`** — leave it. Those are the user's real architecture records,
   not 3t scaffolding.

Tell the user:

```
3t fully removed from this project.
Kept: docs/adr/ and your non-3t settings.
Deleted files were tracked in git (CONTEXT.md, cold/) — `git restore` brings them
back if needed. The claude-3t plugin is still installed globally; to remove it
everywhere: claude plugin uninstall claude-3t
```
