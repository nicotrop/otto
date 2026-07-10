# The `/otto run` wave loop

How to drive `/otto run <slug> [-s range] [-m mode]`. Carry the user's `-s`/`-m` flags (defaults:
all slices, `worktree`) through **every** `start`/`init` call so they agree.

Let `OTTO="<this-skill-dir>/index.ts"` (the skill's own directory — the "Base directory for this
skill" path from the invocation).

**Step 0 — once, before anything else:** run `$OTTO validate <slug>`. On any error it prints the
`error:` lines to stderr, exits non-zero, and stops the run — an invalid, hand-edited plan can't start.
Warnings (e.g. an orphan slice `.md`) print but don't block. otto does **not** commit `.plans/`; it
stays as dirty working-tree files for the run
and is copied into each worktree at wave time (see below). If the user wants the plan in their history,
they commit `.plans/` themselves.

Keep a wave counter starting at 1. Then repeat until `wave` yields no slices:

1. **Compute AND set up the next wave — one command.** Run `$OTTO wave <slug> -w <N> [-s range] [-m mode] [-b buffer]`,
   where `<N>` is the current wave count (1 on the first pass, +1 each loop). `-b` sets how many extra
   waves past the graph's critical-path depth otto tolerates before halting (default 2).
   In `worktree` mode it branches a worktree off the *current* HEAD for each slice, copies the current
   `.plans/<slug>` (specs + the latest `learnings.md`) into each worktree so the agent can read them,
   and excludes `.plans/` inside that worktree so the agent can't commit it back; in `inline` mode it
   sets up nothing (agents edit the main tree, which already has `.plans/`). Then it prints the wave
   JSON on stdout: `{ slug, repo, base_sha, mode, slices: [...], halt_hitl: [...], wave_num, critical_depth, buffer, wave_cap, cap_reached }`.
   Slices stay `pending` until `land` marks them `done`, so the call is naturally idempotent —
   re-running it recomputes the same wave and reuses any worktree it already made.
   - `cap_reached: true` → the wave count passed `wave_cap` (≈ critical-path depth + buffer), so the loop is
     spinning without landing slices. **Stop the loop.** Report that otto hit the iteration cap, run
     `$OTTO status <slug>` to list what's still `pending`, and tell the user the loop isn't making
     progress — likely a slice that keeps failing validation or returning nothing. Do not keep looping.
   - `slices` empty **and** `halt_hitl` non-empty → the only runnable slices are HITL.
     **Stop the loop.** Tell the user which slices need them and why (read each slice `.md` to
     summarize the decision/QA needed). Do not run them.
   - `slices` empty **and** `halt_hitl` empty → graph drained. **Done** — report what shipped.
   - Otherwise continue to step 2 with this wave's JSON.

2. **Run the wave.** Call the `Workflow` tool with `scriptPath` = `workflow/wave.js` in this skill's
   directory, and **`args` = the wave JSON object from step 1**.
   ⚠️ Pass the **entire** stdout JSON from step 1, verbatim, as an actual JSON **object** (it carries
   `slug`, `repo`, `slices`, `halt_hitl`; full field list is `wave.ts`'s `emit({...})`). Never a
   stringified blob and never a partial/paraphrased copy — `workflow/wave.js` reads `args.slices`/`args.slug`
   and throws loudly rather than silently running zero agents.
   Each subagent reads its slice spec + `learnings.md` from disk, implements, validates, and (in a
   worktree) commits. Worktree mode runs slices in parallel; inline mode sequentially. The workflow
   returns `{ ran, results: [{ key, result: { changedFiles, summary, validationClean, validationCommands, learnings, notes } }] }`.

3. **Land each slice, in order.** For each `key` in `ran`, **first check its result**:
   - If `validationClean` is `false`, **do NOT land it.** The slice agent says its own validation
     didn't pass (see `notes`). Landing it would commit broken code that every later wave compounds on.
     Leave the slice `pending` and skip to the next `key` — this is a **retry, not a dead end**: it
     stays unblocked, so the next wave recomputes and runs it again with a *fresh* agent and a worktree
     cut from the new HEAD (now carrying this wave's landed siblings), which often clears the failure.
     The wave cap is the only backstop — if it keeps failing wave after wave with nothing else landing,
     the cap eventually halts the loop so a human looks. Just note the failure and loop on.
   - Otherwise run `$OTTO land <slug> <key> -L "<that slice's learnings from the result>"`. This rebases
   the slice's branch onto current HEAD, applies *only its code deltas* (never `.plans/`), and
   **commits the slice's code as one commit** (message = the slice key). It also updates the main-tree
   `state.json` (→ `done`) and appends the learning to the main-tree `learnings.md` — both left
   **uncommitted** (otto never commits `.plans/`). Committing the code is what lets the next wave
   compound on real code; the next wave's worktrees are cut from this new HEAD and re-seeded with the
   updated `learnings.md`.
   - **On CONFLICT** (otto exits non-zero with a conflict message): **STOP the loop.** A same-wave
     conflict on a real file means the graph under-declared a dependency. Report the conflicting
     files and tell the user to add a `blocked_by` edge (so the slices run in different waves) then
     re-run. Do not auto-resolve.

4. **Report the wave** briefly (what ran, validation status, anything flagged) and **loop to step 1.**

## Invariants — do not violate

- **Single writer.** Only otto writes `state.json` / `learnings.md`, only in the main tree.
  Subagents *return* learnings (in their result JSON); the skill passes them to `land -L`. Never
  hand-edit `state.json` mid-run.
- **otto never commits `.plans/`.** Specs, `state.json`, and `learnings.md` stay as dirty
  working-tree files for the run; otto copies them into each worktree at wave time and excludes them
  there so an agent can't commit them back. The user commits `.plans/` themselves if they want it.
- **Base ref is always current HEAD.** otto handles this; never point worktrees at develop/main.
- **Every landed slice's code is committed.** That is what makes the next wave compound. The loop
  runs unattended; you review the commit stack afterward (`git log`), and can squash/amend since otto
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

If a run is interrupted, just `/otto run <slug>` again. Unfinished slices are still `pending` (their
status lives in the on-disk `state.json`), so `wave` recomputes the same wave, re-seeds and reuses any
worktree left behind, and `land` picks up committed branches. `status` shows a ◎ for any pending slice
with a live worktree (work was in flight). Use `/otto reset <slug> <slice>` to scrap a stuck slice and
start it over.

The wave cap is `critical-path depth + buffer`, and depth is the **static** depth of the whole plan —
so a resume of a mostly-done plan gets the full original budget (loose, but it never false-halts since
the wave counter restarts at 1). To tighten the backstop on a resume, run `$OTTO status <slug>` first:
it prints `remaining depth: <n>`, the depth of the still-unfinished subgraph. Pass that as `-d <n>`
on the `wave` calls (`$OTTO wave <slug> -w <N> -d <n> …`) so otto halts a stuck resume sooner.

Because `state.json` / `learnings.md` are uncommitted working-tree files, a resume works as long as
the working tree survives. A `git clean -fdx` (or otherwise wiping untracked files) between runs would
discard the plan's progress — commit `.plans/` yourself first if you need that safety.
