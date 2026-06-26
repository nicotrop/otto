# Slice file template

Write one markdown file per slice to `.plans/<slug>/slices/`, named with zero-padded numbers in
dependency order (blockers first): `01-short-name.md`, `02-short-name.md`, …

Use this template for each file:

```md
# <Slice title>

**Type:** HITL | AFK

## What to build

A concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer
implementation.

Avoid specific file paths or code snippets — they go stale fast. Exception: if a prototype produced
a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type
shape), inline it here and note briefly that it came from a prototype. Trim to the decision-rich
parts — not a working demo, just the important bits.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked by

- `01-slice-name` (if any)

Or "None — can start immediately" if no blockers.

## Skills

Skills the implementing agent should load for this slice (reference docs + validation tooling) —
name the ones detected in step 3 of to-slices.

## Validation

Steps to complete before marking the slice `review`: run the validation tooling from the skills
above on all changed files, fix every error (warnings ok), and confirm the acceptance criteria are met.
```
