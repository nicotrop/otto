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

Scan the project for its stack and tooling, and note which skills (if any) the implementing agents should load for validation on each slice. Detect from the project's own signals — config files, manifests, lockfiles, existing test/lint/typecheck commands — and match against the skills installed in this environment. Record what you find so step 6 can name the right skills per slice. If the project has no relevant skills, the slice's validation is just its own native checks (build, test, lint).

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

Write slices in dependency order (blockers first) so numbering reflects execution order. Follow
[SLICE-TEMPLATE.md](SLICE-TEMPLATE.md) for the structure of each file.

### 7. Update state.json

Update `.plans/<slug>/state.json` to include all slices, following the shape in
[example.state.json](example.state.json) — `slices` keyed by slice name, each with a `status` and a
`blocked_by` array naming its blocker slices.

Valid statuses: `pending`, `review`, `done`. (otto's `Status` type is exactly these three — a
slice authored with any other status, e.g. `in-progress`, is `!== "pending"` and so is silently
never picked up as runnable.)

Do NOT modify `prd.md` or any other existing files in the plan folder.

### 8. Validate the plan (blocking auto-fix loop)

After `state.json` is written, validate the whole plan before showing the user the result — a
broken plan must never be the visible output of slicing.

**Resolve the validator.** otto is the sibling skill of this one: from this skill's own directory
(the "Base directory for this skill" path from the invocation), otto's CLI is
`../otto/index.ts`. Let `OTTO="<that path>"` — the same way otto's `LOOP.md` resolves `$OTTO` to
its own `index.ts`. If `../otto/index.ts` does not exist (otto genuinely isn't installed), warn
`"validator unavailable, skipping"` and leave `state.json` as written — do NOT fail slicing.

**Run the loop:**

1. Run `$OTTO validate <slug>`.
2. **On exit 1** (errors): read the `error: <slice>: <msg>` lines from stderr, fix the cause in
   `state.json` and/or the offending slice `.md` files (e.g. a bad `blocked_by` reference, a
   missing/invalid `**Type:**` line, a malformed `state.json`), then re-run `$OTTO validate <slug>`.
   **Repeat until validate exits 0, capped at 3 attempts.** If it still fails after the 3rd
   attempt, show the user the remaining `error:` problems and **stop** — do not silently ship a
   broken plan.
3. **Warnings do NOT trigger the loop.** validate exits 0 for warnings (e.g. `warn: <slice>: ` for
   an orphan `.md` file with no `state.json` entry). Print them for the user's awareness, but a
   warning is surfaced, not blocked on.

Only after validate exits 0 (or warnings-only, or otto is not installed) present the finished
breakdown to the user.
