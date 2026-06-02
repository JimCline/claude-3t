---
name: 3t-status
description: Show current 3-tier agent status — hot memory state, cold-storage
  index, model configuration, approval queue, and session overview.
  Run anytime to get a full picture of where things stand.
---

Generate a full status report. Check each item and report honestly.

## Hot Memory Files

Read each memory file and report:
- MEMORY.md — last active date, what's in progress, next action
- CONTEXT.md — domain terms count, ADR count
- EXECUTOR_MEMORY.md — number of entries, most recent task type logged
- IMPLEMENTOR_MEMORY.md — number of entries, most recent escalation cause
- OVERRIDE_LOG.md — override count this session, pre-approved categories

Format as:
```
HOT MEMORY STATUS
─────────────────────────────────────────────
MEMORY.md          Last active: [date]
                   In progress: [brief]
                   Next action: [brief]

CONTEXT.md         [N] domain terms | [N] ADRs
EXECUTOR_MEMORY.md   [N] entries | Latest: [task type]
IMPLEMENTOR_MEMORY.md    [N] entries | Latest: [cause]
OVERRIDE_LOG.md    [N] overrides this session
                   Pre-approved: [list or: none]
```

## Cold Storage

Read `.claude/context/cold/INDEX.md` and report:

```
COLD STORAGE
─────────────────────────────────────────────
Index entries: [N]
Topics:        [comma-separated list of cold file topics, or: none]
Orphan check:  [any cold/*.md file with no INDEX row? list, or: clean]
```

The orphan check matters — an unindexed cold file is invisible. If found,
flag it: the INDEX must be updated or the file removed.

## Model & Reasoning Status

```
MODEL STATUS
─────────────────────────────────────────────
Executor:      the model selected for this session (your session model)
Implementor:   Haiku, latest (claude-3t:implementor subagent)
Reasoning:     Opus via advisor (architect tier, automatic, no artifacts)
opusplan:      [active if Shift+Tab plan mode configured | not configured]

Run /status for live quota consumption.
```

## Approval Queue

Check MEMORY.md Current State for any queued approvals:

```
APPROVAL QUEUE
─────────────────────────────────────────────
[list queued tasks or: none pending]
```

## Session Summary

Provide a one-paragraph summary of what has been accomplished
this session and what is recommended next.

## Protocol Compliance Check

Review this session for protocol violations and report honestly:

```
PROTOCOL COMPLIANCE
─────────────────────────────────────────────────────
PRE-AGENT CHECKLIST shown before agent calls? [yes | no | no agents invoked]
Cold index handed to agents that needed it?   [yes | n/a]
Hot memory loaded at session start?           [yes | no]
ADRs authored by implementor (not executor)?  [yes | n/a]
Extended context overrides logged?            [yes | N/A | violation]
─────────────────────────────────────────────────────
[list any violations found, or: none detected]
```

If violations are found, show them explicitly. Do not minimise.

End with:
"Run /claude-3t:3t-checkpoint to save current state. Run /claude-3t:3t-leaving before stepping away."
