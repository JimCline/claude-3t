# CONTEXT.md — Domain Language & Bounded Contexts

Written and maintained by /grill-with-docs sessions.
This is the shared language of this project — used by the codebase, developers, and domain experts.
Updated inline during grill sessions. Never rewritten wholesale — only appended and refined.

---

## Glossary

<!-- Terms defined here. Format:

**Term**: Definition. Precise enough that two people reading it independently
reach the same understanding. Cross-reference related terms with **bold**.

Example:
**Order**: A confirmed intent to purchase one or more **Line Items**, owned by a
**Customer**, with a single **Shipping Address**. Distinct from a **Cart**,
which is unconfirmed.
-->

---

## Relationships

<!-- Cross-entity relationships that affect naming and structure.

Example:
- A **Customer** has zero or more **Orders**
- An **Order** has one or more **Line Items**
- A **Line Item** references exactly one **Product Variant**
-->

---

## Bounded Contexts

<!-- Only needed for large monorepos with multiple distinct domains.
Each context is a zone where all terms above mean exactly one thing.

Example:
### Billing Context
Terms: Invoice, Payment, Refund
Upstream: Order Context (consumes Order events)

### Fulfillment Context
Terms: Shipment, Carrier, Tracking
Upstream: Order Context (consumes Order events)
-->

---

## Architectural Decision Records

<!-- ADRs created during grill sessions. Only created when:
- The decision is hard to reverse
- The decision would be surprising without context
- The decision involved a real trade-off with consequences

Format:
### ADR-001: [Title]
**Date**: YYYY-MM-DD
**Status**: accepted | superseded-by ADR-NNN
**Decision**: One sentence.
**Context**: Why this decision was needed.
**Consequences**: What becomes easier. What becomes harder.
-->

---

## Open Questions

<!-- Unresolved language or design questions from grill sessions.
Move to Glossary or ADRs when resolved. -->

