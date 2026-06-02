# Cold Storage Index

This is the **manually-curated retrieval layer** for durable project knowledge.

The index is cheap and always loaded at session start. The cold files it
points to are loaded **only when an entry's description matches what you need**.
That selective load is the entire point — you read the one relevant 300-token
file instead of reloading the whole archive every session.

---

## How this works

- **Hot memory** (always loaded): `MEMORY.md`, `CONTEXT.md`, `EXECUTOR_MEMORY.md`,
  `IMPLEMENTOR_MEMORY.md`, `OVERRIDE_LOG.md`. Small, needed in full, every session.
- **Cold storage** (this directory): durable facts that have grown past the hot
  digest. One file per topic, semantically named, loaded on demand via this index.

**The rule for what belongs in cold storage** — a fact qualifies only if it is:
1. **Durable** — still true after a year of commits (intent, rationale, gotchas —
   NOT signatures, config values, versions, or anything `git pull` could change).
2. **Cold** — not needed on every task (else it belongs in hot memory).
3. **Worth the re-discovery cost** — expensive to re-derive from scratch.

If a fact fails any of these, it does NOT go here. Volatile facts are
re-derived from the code; always-needed facts stay in hot memory.

---

## Index discipline (the one real cost of this design)

A cold file with no index entry is **invisible** — no one will find it. Therefore:

- **Never** add a file to `cold/` without adding its row below.
- Write the description to carry the **semantic load**: include the words a future
  agent would *search by*, not just the filename. The description is how lexical
  lookup approximates semantic search.
- When a fact goes stale, **edit or delete** the cold file and update its row —
  do not append a contradicting file. (See supersession in `CONTEXT.md` ADRs.)

Good description (findable by "concurrency", "threading", "race"):
> `order-service.md` — OrderService mutates state inside property getters;
> NOT thread-safe, never parallelize calls. Concurrency landmine.

Weak description (only findable if you already know the filename):
> `order-service.md` — notes about OrderService

---

## Index

<!-- One row per cold file. Keep descriptions rich and search-term-dense.
Format:

- `filename.md` — what it covers, in the vocabulary someone would search by.
  [as-of: YYYY-MM-DD]
-->

_No cold-storage entries yet. Add them as durable knowledge accumulates past
the hot digest._
