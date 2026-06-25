# The `/otto run` wave loop

How to drive `/otto run <slug> [-s range] [-m mode]`. Carry the user's `-s`/`-m` flags (defaults:
all slices, `worktree`) through **every** `start`/`init` call so they agree.

Let `OTTO="<this-skill-dir>/index.ts"` (the skill's own directory — the "Base directory for this
skill" path from the invocation).

**Step 0 — once, before anything else:** run `$OTTO snapshot <slug>`. It first **validates the plan**
(same path as `$OTTO validate`): on any error it prints the `error:` lines to stderr, exits non-zero,
and does **not** commit — an invalid, hand-edited plan can't start a run. Warnings (e.g. an orphan
slice `.md`) print but don't block. If validation passes, it commits the plan dir so it is tracked for
the whole run; worktrees cut from HEAD then contain the slice specs an agent needs to read. (The commit
is a no-op if the plan is already committed.)

Then repeat until `wave` yields no slices:

1. **Compute AND set up the next wave — one command.** Run `$OTTO wave <slug> [-s range] [-m mode]`.
   In `worktree` mode it branches a worktree off the *current* HEAD for each slice and gitignores
   `.worktrees/`; in `inline` mode it sets up nothing (agents edit the main tree). Then it prints the
   wave JSON on stdout: `{ slug, repo, base_sha, mode, slices: [...], halt_hitl: [...] }`. Slices stay
   `pending` until `land` marks them `done`, so the call is naturally idempotent — re-running it
   recomputes the same wave and reuses any worktree it already made.
   - `slices` empty **and** `halt_hitl` non-empty → the only runnable slices are HITL.
     **Stop the loop.** Tell the user which slices need them and why (read each slice `.md` to
     summarize the decision/QA needed). Do not run them.
   - `slices` empty **and** `halt_hitl` empty → graph drained. **Done** — report what shipped.
   - Otherwise continue to step 2 with this wave's JSON.

2. **Run the wave.** Call the `Workflow` tool with `scriptPath` = `workflow/wave.js` in this skill's
   directory, and **`args` = the wave JSON object from step 1**.
   ⚠️ Pass it as an actual JSON **object**, never a stringified blob — `workflow/wave.js` reads
   `args.slices`, and a string has no `.slices` (it throws loudly rather than silently running zero agents).
   Each subagent reads its slice spec + `learnings.md` from disk, implements, validates, and (in a
   worktree) commits. Worktree mode runs slices in parallel; inline mode sequentially. The workflow
   returns `{ ran, results: [{ key, result: { changedFiles, summary, validationClean, learnings } }] }`.

3. **Land each slice, in order.** For each `key` in `ran`, run
   `$OTTO land <slug> <key> -L "<that slice's learnings from the result>"`. This rebases the slice's
   branch onto current HEAD, applies *only its deltas*, appends the learning to `learnings.md`, and
   **commits the slice's code + state + learning as one commit** (message = the slice key). Committing
   is what lets the next wave compound — its worktrees are cut from this new HEAD.
   - **On CONFLICT** (otto exits non-zero with a conflict message): **STOP the loop.** A same-wave
     conflict on a real file means the graph under-declared a dependency. Report the conflicting
     files and tell the user to add a `blocked_by` edge (so the slices run in different waves) then
     re-run. Do not auto-resolve.

4. **Report the wave** briefly (what ran, validation status, anything flagged) and **loop to step 1.**

## Invariants — do not violate

- **Single writer.** Only otto writes `state.json` / `learnings.md`, only in the main tree.
  Subagents *return* learnings (in their result JSON); the skill passes them to `land -L`. Never
  hand-edit `state.json` mid-run.
- **Base ref is always current HEAD.** otto handles this; never point worktrees at develop/main.
- **Every landed slice is committed.** That is what makes the next wave compound. The loop runs
  unattended; you review the commit stack afterward (`git log`), and can squash/amend since otto
  never pushes.
- **AFK auto-flows, HITL halts.** Never run a HITL slice unattended.
- **Conflicts hard-stop.** A real-file conflict is a graph bug for the human, not something to merge.
- **Worktree agents commit in their worktree; inline agents leave work unstaged** — `land` commits it
  either way. Agents never push.

## After the loop

Each landed slice is a commit on your branch (otto never pushes). Review with `git log` / `git diff`,
QA in preview, and squash/amend/reset as you like. To review in batches, scope the run with `-s`
(e.g. `/otto run <slug> -s 1-4`) so it stops after slice 4 — then inspect those commits before
running the next range.

## Resuming

If a run is interrupted, just `/otto run <slug>` again. Unfinished slices are still `pending`, so
`wave` recomputes the same wave; `ensureWorktree` reuses any worktree left behind, and `land` picks
up committed branches. `status` shows a ◎ for any pending slice with a live worktree (work was in
flight). Use `/otto reset <slug> <slice>` to scrap a stuck slice and start it over.
