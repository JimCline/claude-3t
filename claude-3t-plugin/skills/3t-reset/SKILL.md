---
name: 3t-reset
description: Reset the current project's 3-tier setup back to ZERO so /3t-init can
  run from scratch. DESTRUCTIVE — deletes all 3t artifacts including committed
  CONTEXT.md, cold/, and docs/adr. Always dry-runs and gets explicit confirmation
  first. Built for testing the init flow repeatedly; also useful for a clean slate.
  Stops at zero — it does NOT re-init for you.
---

Wipe this project's 3t scaffolding to a clean slate. The plugin itself stays
installed — this only affects the current project. After it runs, the project
looks like 3t was never initialized here, and you run `/claude-3t:3t-init`
yourself to start fresh.

This is the heavy-duty sibling of `/claude-3t:3t-remove`: where remove (mode R)
preserves `docs/adr`, **reset is "true zero" and deletes that too.**

## Step 1 — Dry run (always first)

Show the user exactly what will be destroyed before touching anything:

```bash
node "$CLAUDE_PLUGIN_ROOT/bin/3t-reset.mjs"
```

This deletes NOTHING — it prints the full list of files, directories, the
`.gitignore` block, and the `settings.json` key that a real run would remove.
Display that output to the user verbatim.

If the dry run reports the project is already at zero, stop and tell the user —
there is nothing to reset.

## Step 2 — Confirm explicitly

This is destructive and includes **committed** files (`CONTEXT.md`, `cold/`) and
**`docs/adr`**. Ask exactly this and wait for a clear yes:

```
⚠  /3t-reset will DELETE everything listed above — including committed
   CONTEXT.md, cold/, and your docs/adr architecture records.

   Committed files can be recovered with `git restore`; anything uncommitted
   is gone permanently.

   This does NOT re-init — you'll run /3t-init yourself afterward.

   Type "reset" to proceed, or anything else to cancel:
```

Only proceed on an unambiguous confirmation. Anything else → cancel and stop.

## Step 3 — Execute

On confirmation:

```bash
node "$CLAUDE_PLUGIN_ROOT/bin/3t-reset.mjs" --confirm
```

Show the completion summary verbatim.

## Step 4 — Tell the user what's next

```
Project reset to zero. To start fresh:
  1. Run /claude-3t:3t-init
  2. Restart Claude here so the SessionStart hook picks up the new marker
  3. Run /claude-3t:3t-start

If you deleted committed files you want back instead, `git restore .` recovers
CONTEXT.md / cold/ / docs/adr from the last commit.
```

## Notes

- Scope is the current working directory. Run it from the project root.
- The two-stage flag (`--confirm`) is a backstop: the script refuses to delete on
  a bare invocation, so an accidental run only ever prints a dry run.
- `/3t-reset` intentionally stops at zero rather than auto-running `/3t-init` —
  this keeps the init step observable, which is the point when testing it.
