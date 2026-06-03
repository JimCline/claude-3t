# Claude Code 3-Tier Agent Architecture

A Claude Code **plugin** that structures your work across three model tiers, with
file-based hot/cold memory. No server, no container, no install script.

```
You
  → Executor       (your session model — runs sessions, decides, delegates, reviews)
      → advisor       (Opus — the architect tier: hard/irreversible reasoning)
      → implementor   (Haiku, latest — implementation AND artifact authorship)

Memory: file-based, in .claude/context/
  → Hot:  small files loaded in full when a session starts
  → Cold: durable facts loaded on demand via cold/INDEX.md
```

The executor runs as whatever model is selected for the session — it is not
pinned. It is simply your session model; the advisor (Opus) and implementor
(Haiku) are the two tiers the plugin actually configures. Both default models are
easy to change — see
[Choosing the advisor model](claude-3t-plugin/README.md#choosing-the-advisor-model)
and [Choosing the implementor model](claude-3t-plugin/README.md#choosing-the-implementor-model).

---

## Intent

Most Claude Code work is done by one model in one context. This plugin splits the
work the way a small team would:

- **The executor coordinates** — understands the problem, plans, delegates, reviews. It
  holds the thread but doesn't burn its context on bulk implementation.
- **The advisor (Opus) is the architect** — consulted for hard or hard-to-reverse
  decisions. It produces no artifacts; it sharpens the executor's judgement.
- **Haiku implements** — writes code, runs test loops, and authors the durable
  record (ADRs, `CONTEXT.md`) by faithful transcription from a concise spec.

Knowledge persists in plain files, split into a small always-loaded **hot** set
and an indexed **cold** store loaded only when a task needs it. The goal is to
keep each tier's context lean and let decisions, not raw bytes, flow between them.

The architecture is **opt-in twice**: per project (you initialize it) and per
session (it asks before loading). Installed globally, it stays completely
invisible in every project you haven't opted into.

---

## How it works

Everything ships in one plugin (`claude-3t-plugin/`):

| Piece | Delivered as | Tier |
|---|---|---|
| Session prompt + protocol reload | `SessionStart` hook | executor |
| `/3t-start`, `/3t-init`, `/3t-status`, `/3t-checkpoint`, `/3t-leaving` | skills | executor |
| Executor protocol (`3t-core`, `3t-reference`) | bundled context, loaded by `/3t-start` | executor |
| `implementor` | plugin subagent (`claude-3t:implementor`) | implementor |
| advisor | `advisorModel` in project `settings.json` | architect |

**The activation chain:**

1. **Install the plugin once** (globally). It does nothing until a project opts in.
2. **`/claude-3t:3t-init`** (once per project) scaffolds the writable memory files,
   writes `settings.json` with `advisorModel`, and plants a committed marker
   (`.claude/context/cold/INDEX.md`).
3. On each **session start** in a marked project, the hook asks:
   *"Start the 3-tier workflow for this session? (yes/no)"*
   - **Yes** → runs `/claude-3t:3t-start`, which loads the protocol + hot memory
     and marks the session active.
   - **No** → the session proceeds normally; nothing is loaded.
4. After a **context compaction**, the hook checks the per-session flag and, if you
   were active, tells the executor to reload the protocol automatically.

So a project is "3t" only if it carries the marker, and the protocol only engages
when you say yes — the plugin can be installed globally with zero footprint
elsewhere.

---

## Install & use

The plugin lives at **https://github.com/JimCline/claude-3t**. Install it from
the GitHub repo:

```bash
claude plugin marketplace add JimCline/claude-3t      # shorthand for the GitHub repo
claude plugin install claude-3t@claude-3t
```

`JimCline/claude-3t` is the `owner/repo` shorthand; the full
`https://github.com/JimCline/claude-3t` URL works too. Claude Code clones the
repo's default branch — a private repo works for you with your existing git/GitHub
auth; it only needs to be public for others to install without access.

> Developing the plugin locally? Point the marketplace at your clone instead:
> `claude plugin marketplace add /path/to/claude-3t` (reads the working tree, no
> push needed).

Then, in a project:

```
/claude-3t:3t-init     # once per project — scaffold + settings + marker, then restart
/claude-3t:3t-start    # each session — loads protocol + hot memory (the hook prompts you)
```

| Command | What it does |
|---|---|
| `/claude-3t:3t-init` | Initialize a project (once) |
| `/claude-3t:3t-start` | Begin/resume a session — load protocol + hot memory |
| `/claude-3t:3t-status` | Memory state, cold index, model status, compliance |
| `/claude-3t:3t-checkpoint` | Write a session snapshot now |
| `/claude-3t:3t-debrief` | Post-work debrief — route lessons to memory or upstream feedback |
| `/claude-3t:3t-leaving` | Departure protocol for autonomous work |
| `/claude-3t:3t-remove` | Deactivate or fully remove 3t from the project |

Full plugin documentation: [`claude-3t-plugin/README.md`](claude-3t-plugin/README.md).

---

## Memory model — hot / cold

| Tier | Files | Committed? | Loaded |
|---|---|---|---|
| **Hot** | `MEMORY.md`, `CONTEXT.md`, `EXECUTOR_MEMORY.md`, `IMPLEMENTOR_MEMORY.md`, `OVERRIDE_LOG.md` | `CONTEXT.md` only | in full each session |
| **Cold** | `cold/INDEX.md` + `cold/*.md` | yes | index always scanned; topic files on demand |

A fact belongs in cold storage only if it is **durable** (true after a year of
commits), **cold** (not needed every task), and **expensive to re-derive**.
Volatile facts (signatures, config values, versions) are never stored — they are
re-derived from the code. This is the same pattern Claude Code uses for its own
memory: a small index, files pulled selectively.

The handoff to the implementor is a **concise task spec in the agent prompt
itself** — not a shared file. The executor pastes the relevant `INDEX.md` rows
so the agent knows what cold knowledge exists, and the agent self-reads what it
needs. This keeps the executor lean and is parallel-safe.

---

## Optional companion resources

These are independent tools that pair well with the workflow but are not part of
the plugin. Install whichever you want:

- **Context Mode** — compresses large tool output (build logs, test runs, search
  results) so it doesn't flood your context.
  Install: `claude plugin marketplace add mksglu/context-mode` then
  `claude plugin install context-mode@context-mode`.
- **Matt Pocock skills** — `/grill-with-docs`, `/to-prd`, `/to-issues`, which the
  canonical design flow uses (`/grill-with-docs → advisor → /to-prd → /to-issues
  → execution`). Install: `npx skills@latest add mattpocock/skills`.
