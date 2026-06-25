---
name: to-slices
description: Break a plan or PRD into independently-grabbable vertical slices written to .plans/ as markdown files. Use when user wants to break down a plan into implementation slices, create action items, or decompose work.
disable-model-invocation: true
---

# To Slices

Break a plan into independently-grabbable vertical slices (tracer bullets) and write them to the `.plans/` folder.

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes a plan folder path as an argument (e.g., `.plans/dark-mode`), read `prd.md` from that folder. Otherwise, look for the most recent `.plans/*/prd.md` or synthesize from conversation.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code. Slice titles and descriptions should use the project's domain glossary vocabulary, and respect ADRs in the area you're touching.

### 3. Detect project skills

Scan the project to determine which skills implementing agents should use for validation. Look for:

- **Shopify theme** (contains `shopify.theme.toml`, `sections/`, `templates/` with `.liquid` files): recommend `shopify-liquid`, `shopify-liquid-themes`, `liquid-theme-standards`
- **TypeScript/JavaScript** (contains `tsconfig.json`, `package.json`): recommend running typecheck
- **Other patterns**: adapt based on what you find

### 4. Draft vertical slices

Break the plan into **tracer bullet** slices. Each slice is a thin vertical slice that cuts through ALL integration layers end-to-end, NOT a horizontal slice of one layer.

Slices may be 'HITL' or 'AFK'. HITL slices require human interaction, such as an architectural decision or a design review. AFK slices can be implemented and merged without human interaction. Prefer AFK over HITL where possible.

<vertical-slice-rules>
- Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests)
- A completed slice is demoable or verifiable on its own
- Prefer many thin slices over few thick ones
</vertical-slice-rules>

### 5. Quiz the user

Present the proposed breakdown as a numbered list. For each slice, show:

- **Title**: short descriptive name
- **Type**: HITL / AFK
- **Blocked by**: which other slices (if any) must complete first
- **User stories covered**: which user stories this addresses (if the source material has them)

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any slices be merged or split further?
- Are the correct slices marked as HITL and AFK?

Iterate until the user approves the breakdown.

### 6. Write the slice files

For each approved slice, write a markdown file to `.plans/<slug>/slices/`. Use zero-padded numbering: `01-short-name.md`, `02-short-name.md`, etc.

Write slices in dependency order (blockers first) so numbering reflects execution order.

Use this template for each slice file:

<slice-template>
# <Slice title>

**Type:** HITL | AFK

## What to build

A concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer implementation.

Avoid specific file paths or code snippets — they go stale fast. Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it here and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked by

- `01-slice-name` (if any)

Or "None — can start immediately" if no blockers.

## Skills

List of skills the implementing agent should load for this slice. These provide reference documentation and validation tooling.

<!-- Example for Shopify theme work: -->
<!-- - `shopify-liquid` — search docs before coding, validate all changed .liquid files before marking review -->
<!-- - `shopify-liquid-themes` — schema, LiquidDoc, translation patterns -->
<!-- - `liquid-theme-standards` — BEM, design tokens, web components, CSS/JS standards -->

## Validation

Steps the implementing agent must complete before marking this slice as `review`:

1. Run validation tooling from the skills listed above (e.g., `shopify-liquid` validate.mjs on all changed files)
2. Fix all errors — warnings are acceptable
3. Ensure acceptance criteria are met

</slice-template>

### 7. Update state.json

Update `.plans/<slug>/state.json` to include all slices:

```json
{
  "plan": "<slug>",
  "created": "<YYYY-MM-DD>",
  "slices": {
    "01-short-name": { "status": "pending", "blocked_by": [] },
    "02-short-name": { "status": "pending", "blocked_by": ["01-short-name"] },
    "03-short-name": { "status": "pending", "blocked_by": [] }
  }
}
```

Valid statuses: `pending`, `in-progress`, `review`, `done`.

Do NOT modify `prd.md` or any other existing files in the plan folder.
