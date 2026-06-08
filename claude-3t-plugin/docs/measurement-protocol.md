# Measuring the implementor layer: does delegation beat owning?

**Why this exists.** The 3-tier protocol has shipped 20+ routing patches on the
*assumption* that pushing legwork to Haiku saves tokens. It has never been
measured against the alternative (executor owns the work). A failed delegation
costs ~3× a clean one (spec authoring + Haiku flailing + executor redo), so the
layer is only net-positive if delegations land clean often enough. This protocol
replaces that assumption with real, API-reported token counts.

The tool: `bin/session-tokens.mjs`. It reads **any** session transcript — current
session auto-detected, or a bare session UUID / explicit `.jsonl` path as
`argv[1]`. So the baseline can be reconstructed **retroactively from history** —
no need to capture fresh control sessions first.

---

## What we're comparing

Two routing regimes, same class of task:

- **A — delegation-heavy (old posture):** "never implement directly; delegate
  everything you can." This is what every session *before* the own-by-default
  change did. Measure it from history.
- **B — own-by-default (new posture):** "own it unless confident it lands
  first-pass." Measure it from sessions run *after* the change.

The metric that decides it: **output tokens** (the dominant cost) and
**cache-creation** tokens, summed across the executor session *and* every
implementor subagent it spawned, per unit of delivered work.

> Do NOT sum `input_tokens + cache_read_input_tokens` across turns — the cached
> prefix is re-counted every turn and the total is meaningless. `session-tokens.mjs`
> already keeps the four categories separate; compare them category-by-category.

---

## Procedure

### 1. Pick comparable work units
Choose tasks of similar shape across both regimes — e.g. "implement a feature
touching 3–6 files against a partly-unfamiliar library." Avoid comparing a
trivial rename against a multi-file feature. 3–5 sessions per regime is enough
to see a direction; it is not a clean-room experiment, and that's fine — you
need a *direction*, not a p-value.

### 2. Measure each session, including subagents
For each session UUID:

```sh
node bin/session-tokens.mjs <executor-session-uuid>
```

Implementor subagents run as their own transcripts. The report attributes model
breakdown (Haiku vs Sonnet/Opus) within a session; where subagents are separate
JSONL files, measure each and add them to that session's total. Record per
session:

| field | source |
|---|---|
| output tokens (total) | report `output_tokens` |
| cache-creation tokens | report `cache_creation` |
| Haiku share of output | report model breakdown |
| delegations attempted | count implementor invocations |
| delegations that required executor rework | from the transcript / debrief notes |
| build/test passed on first audit | post-delegation audit result |

### 3. Compute the failure tax
Per regime: `failure_rate = reworked_delegations / delegations_attempted`. This
is the number the whole layer lives or dies on. Pair it with the token totals:
a regime can have higher raw tokens but lower cost-per-delivered-feature if its
failure rate is near zero.

### 4. Decide
- **B (own-by-default) wins or ties on tokens** → keep the posture flip; the
  layer is constrained to the work it's good at. Expected outcome.
- **A (delegate-heavy) clearly wins on tokens AND its failure rate is low** →
  the posture flip was too conservative; relax the confidence gate. (Unlikely
  given the failure history, but this is the falsifiable claim.)
- **Both high-tax** → the implementor layer is net-negative outside genuinely
  mechanical batch work; restrict delegation to batch-only and reconsider the
  layer's scope.

---

## Recording results

Append a dated table to this file (regime, session UUIDs, output tokens,
failure rate, verdict). Each protocol change after this should cite a row here,
not intuition — that is the whole point. The first row should be the historical
baseline reconstructed from pre-change sessions.

| date | regime | sessions | total output tok | failure rate | note |
|---|---|---|---|---|---|
| _tbd_ | A (history) | _uuids_ | _n_ | _n_ | baseline-from-history |
| _tbd_ | B (own-default) | _uuids_ | _n_ | _n_ | post-flip |

---

## 2026-06-08 — Controlled experiment: determined vs unfamiliar-API work

**Setup.** 12 subagents launched in parallel, each given identical task specs, scored by
independent build/test verification (not trusting agent self-reports).

- **Task A** — determined/mechanical: implement a Python arithmetic evaluator against a
  complete spec with a no-dep acceptance checker. Represents the *ideal* delegation case:
  nothing to figure out, clean verifiable output.
- **Task B** — unfamiliar API: implement a Terminal.Gui 2.4.4 counter app in C#.
  No API signatures given; agents had to discover current constructors from the NuGet
  package. Reproduces the exact failure mode from the TUI clock session (PR #20 root cause).

**Results — all 12 verified PASS/Build-succeeded independently:**

```
Task A (determined Python):
  Haiku  avg 17,216 tok  range [16,480–18,325]  avg 5 tool_uses  range [3–7]
  Sonnet avg 15,401 tok  range [15,299–15,482]  avg 3 tool_uses  range [3–3]
  Haiku/Sonnet ratio: 1.12× on tokens, 1.7× on tool_uses

Task B (unfamiliar API .NET):
  Haiku  avg 34,754 tok  range [29,668–37,600]  avg 33 tool_uses  range [23–42]
  Sonnet avg 33,878 tok  range [26,103–44,976]  avg 18 tool_uses  range [10–23]
  Haiku/Sonnet ratio: 1.03× on tokens, 1.8× on tool_uses
```

**Finding 1 — Token costs converge on unfamiliar-API work.**
Haiku and Sonnet cost roughly the same in raw tokens on Task B (1.03×). This contradicts
the premise "delegate to Haiku to save tokens" for reasoning-dense work — there is no
material savings, and Haiku's variance is higher (29k–38k vs 26k–45k).

**Finding 2 — Haiku flails: 1.8× more compiler round-trips.**
On Task B, Haiku averaged 33 tool_uses vs Sonnet's 18 — almost twice as many build
iterations to converge. This is the flailing pattern measured. Sonnet finds the right API
usage in fewer cycles because it's better at reading unfamiliar docs and generalizing.

**Finding 3 — Haiku runs dangerously close to maxTurns=50.**
B-haiku-1 used 42 tool_uses (84% of the 50-turn budget). In the real 3-tier protocol
with maxTurns=50, a slightly larger spec or one extra API wrinkle tips this into a
budget-exhaustion HALT — which is exactly what happened in the original TUI session.
The ceiling isn't too low; the *task shape* is wrong for Haiku.

**Finding 4 — On determined work, Haiku is not cheaper.**
Task A Haiku avg 17.2k vs Sonnet 15.4k (12% more expensive, not less). The token
savings from using a cheaper tier are largely absorbed by the token overhead of the
tier itself. The *pricing* difference matters, not just token count — but at the margin
the advantage is narrow even on ideal tasks.

**Verdict.**
The data supports the own-by-default posture flip:
- Unfamiliar-API work: delegate to Haiku saves ~nothing on tokens, burns ~2× the
  build iterations, and puts real runs within a single API wrinkle of a HALT.
- Determined work: Haiku is marginally cheaper per-token but not dramatically so;
  the risk/reward is better but still narrow.
- The failure tax (3× cost on a failed run) only needs to materialise occasionally
  to wipe out the narrow determined-work savings. With Haiku at 84% of maxTurns
  on a simple counter app, the margin of safety for real project complexity is thin.

**Decision confirmed:** Own by default. Delegate to Haiku only for genuinely mechanical
work (no API discovery, no branching state, short iteration path). Any doubt → own it.

