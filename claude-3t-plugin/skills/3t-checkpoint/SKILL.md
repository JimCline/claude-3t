---
name: 3t-checkpoint
description: Write an immediate session snapshot to MEMORY.md — captures
  current state, decisions made, open questions, known risks, and next
  recommended action. Use before switching contexts or ending a session.
---

Write a session snapshot to MEMORY.md right now. Do not wait for inactivity.

Overwrite the Current State section with:

```
## Current State

Last active: [today's date and time]

Done: [what has been completed this session — be specific]
In progress: [what is partially complete, with % estimate and details]
Next action: [exactly what to do first in the next session — one clear step]

Decisions made this session (not yet in memory files):
  - [list any decisions made that haven't been written to CONTEXT.md ADRs]

Open questions:
  - [unresolved questions that need answering]

Known risks:
  - [anything that could go wrong or needs attention]

Recommended first step next session: [specific actionable instruction]

Approval queue: [any tasks queued waiting for user approval, or: none]
Session-only expansions active: [any temporary pre-approvals, or: none]
```

After writing, tell the user:
"Snapshot written to .claude/context/MEMORY.md — session state captured."

Also update the Session Log section in MEMORY.md with a one-line entry:
  [DATE] | [what was built/changed] | [key decisions] | [override count: N]
