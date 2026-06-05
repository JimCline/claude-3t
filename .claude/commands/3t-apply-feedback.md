---
description: Read feedback filed from downstream /3t-debrief sessions, cluster it,
  propose specific plugin improvements, and apply approved changes through the
  standard 3t workflow. Maintainer-only — runs in the plugin source repo.
---

# /3t-apply-feedback

You are the **maintainer-side counterpart to `/3t-debrief`**. Downstream projects
use `/3t-debrief` to capture protocol gaps and tell users to file them as GitHub
issues on this repo. This skill reads those issues (or pasted content), clusters
the gaps, and applies approved improvements to the plugin source files.

Editing plugin files here **IS correct** — these are the source files, not the
installed read-only copies.

---

## STEP 1 — Intake

**Try GitHub issues first:**

```bash
gh issue list \
  --label feedback \
  --repo JimCline/claude-3t \
  --state open \
  --json number,title,body,createdAt,url \
  --limit 50
```

Parse each issue body for the structured entry format:

```
Gap: [what the protocol/agent did not handle]
Evidence: [the concrete failure]
Proposed change: [checklist box / instruction / hook / skill]
```

**Fallback — if no open issues or `gh` is unavailable:**

> "No open feedback issues found (or `gh` unavailable). Paste the content of
> your project's `.claude/context/3t-plugin-feedback.md` here, or specific
> entries, and I'll process them."

Accept the pasted content and parse the same format:

```
## [date] — from [issue/task]
Gap: ...
Evidence: ...
Proposed change: ...
```

---

## STEP 2 — Filter

Not everything in a feedback file is truly plugin-level. Remove entries that are:
- **Project-specific** — a code/framework/DSL gotcha specific to one stack (no
  protocol change fixes this; it belongs in that project's IMPLEMENTOR_MEMORY.md)
- **Duplicate of existing behavior** — already covered by a checklist box,
  section, or hook (cite the specific line and explain why it's covered)
- **Volatile/environment facts** — config values, credentials, version-specific
  quirks that belong in a project's cold storage, not the protocol

Flag the filtered items with a reason rather than silently dropping them — the
user may disagree.

---

## STEP 3 — Cluster and prioritize

Group the remaining entries by theme. Common clusters:

| Theme | Likely plugin touch-points |
|---|---|
| Checklist gap (missing box) | `3t-core.md` PRE-AGENT or implementor EXIT CHECKLIST |
| Implementor behavior (execution trap) | `agents/implementor.md` |
| Executor delegation/sizing lesson | `3t-core.md` SPEC SIZING / SPLIT sections |
| Hook missing or wrong trigger | `hooks/hooks.json`, `hooks/pre-agent.mjs`, `hooks/post-agent.mjs` |
| Skill step missing or unclear | the relevant `skills/*/SKILL.md` |
| New skill needed | `skills/<name>/SKILL.md` (new file) |
| Reference recipe missing | `context/3t-reference.md` |
| ADR / architectural decision | `context/3t-core.md` + `CONTEXT.md` entry |

Rank clusters by: **frequency** (how many independent projects hit this?) ×
**severity** (did it cause lost work, a silent failure, or just friction?).

---

## STEP 4 — Propose

Show the user a prioritized table before touching anything:

```
FEEDBACK ANALYSIS
─────────────────────────────────────────────────────
Filtered out (N):
  • [entry] — reason: [why it's not plugin-level]

Proposed changes (ranked):
  1. [cluster title] — N reports, severity: high/med/low
     Gap: [summary]
     Touch: [file:section]
     Change: [one sentence]

  2. …
─────────────────────────────────────────────────────
Approve all / approve individually / drop any?
```

Wait for approval. Do NOT write yet.

---

## STEP 5 — Advisor check

For any approved change that is:
- A new section or behavioral rule in `3t-core.md`
- A new hook or trigger
- A new skill
- An architectural decision (new delegation tier, new memory tier, etc.)

→ Consult the advisor (Opus) before delegating implementation. Smaller changes
(additional checklist box, clarifying prose, a new recipe in `3t-reference.md`)
can go directly to the implementor.

---

## STEP 6 — Implement approved changes

These are plugin source files. Use the standard 3t workflow:

1. Run the **PRE-AGENT CHECKLIST** for each implementor spec.
2. Delegate to `claude-3t:implementor` (or a workflow if mode is enabled and the
   batch is large/independent enough to warrant it).
3. For a new skill: create `claude-3t-plugin/skills/<name>/SKILL.md`. Also add
   its entry to the skills table in `README.md` and the layout section.
4. For an architectural decision: author an ADR entry in
   `claude-3t-plugin/context/3t-core.md` (or a `docs/adr/` file if substantial)
   via the implementor faithful-transcription flow.
5. **Bump `claude-3t-plugin/.claude-plugin/plugin.json` version:**
   - Patch (0.x.Y → 0.x.Z): prose clarifications, additional checklist boxes,
     recipe additions — no behavioral change visible to downstream executors.
   - Minor (0.X.0): new behavior, new skill, new hook, new delegation tier.

---

## STEP 7 — POST-DELEGATION AUDIT

After every implementor return, verify independently:
- Every proposed change was actually written.
- The plugin still reads coherently (cross-references point to real sections,
  new sections are reachable from the right starting points).
- `plugin.json` version was bumped.

---

## STEP 8 — Close the loop

**For GitHub issues:**

```bash
gh issue close <number> \
  --repo JimCline/claude-3t \
  --comment "Applied in plugin v<version> — <one-line summary of change>."
```

Close each issue that was fully applied. Leave open issues where the proposed
change was filtered or deferred, and add a comment explaining why.

**For pasted content:**

Append a dated archive entry to `.claude/context/applied-feedback.md` (create
if absent) — one line per entry: `[date applied] v<version> — [gap summary]`.
This prevents re-processing on the next run.

---

## STEP 9 — Confirm

Tell the user:
- What changed and in which files
- The new plugin version
- Which issues were closed (or entries archived)
- Which entries were filtered/deferred and why
- Reminder: "Run `claude plugin marketplace update claude-3t && claude plugin
  update claude-3t` in downstream projects to pick up these changes."
