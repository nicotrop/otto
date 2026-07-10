# Seed worktrees by copying `.plans/`, not by committing it

**Status:** accepted

otto runs each slice in an isolated git worktree, and the agent reads its spec and the current
`learnings.md` from disk inside that worktree. Worktrees are cut from a git SHA, so historically otto
guaranteed those files were present by *committing* `.plans/<slug>` (the `snapshot` step) — which
forced an `otto:`-authored commit into the user's history whether or not they wanted the plan tracked.

We decided otto must **never commit `.plans/`**: it seeds each worktree by **copying** the main-tree
`.plans/<slug>` into the freshly-created worktree instead of relying on a commit. Plan bookkeeping
(`state.json`, `learnings.md`) lives as **dirty working-tree files** for the duration of the run; a
user who wants the plan recorded in history simply commits it themselves. otto imposes no policy and
touches no `.gitignore` — there is nothing for otto to get wrong about the user's git intent.

The key realization: committing was never what made **compounding** work. Compounding depends on
learnings being *present in each fresh worktree* and *propagated between waves*, and that already runs
through the **main-tree** `learnings.md` (otto is its single writer, via `land -L`). Copying from the
main tree at wave-build time carries the latest learnings forward exactly as the commit did. The
commit was just the courier; swapping the courier leaves compounding untouched. (Slice *code* still
commits per wave — the next wave's worktree, cut from HEAD, must contain prior slices' code. Only plan
bookkeeping moves off the commit path.)

Safe under parallelism: all copies run sequentially inside the `wave` command *before* any agent is
spawned, each into a distinct worktree, from a source nothing is concurrently writing. Parallel agents
are all readers of their own private copy of `learnings.md`; otto remains the single sequential writer
of the real one.

`.plans/` flows in but never out. After copying it into a worktree, otto adds `.plans/` to that
worktree's `.git/info/exclude` (worktree-local, untracked, never the user's `.gitignore`), so the
agent's `git add -A` can never stage it and the slice branch stays pure code. There is therefore no
"copy back" and no plan-stripping on land — the prior `stripPlanEdits` step is removed. The only thing
that survives a session is the learning otto carries forward in the main-tree `learnings.md`.

## Reliability

The copy is deterministic code in `ensureWorktree` (never an agent action), and otto fails closed:
the copy throws on failure so `wave` exits non-zero and no agent is ever dispatched against an
unseeded worktree; otto **re-copies on every wave** (including the worktree-reuse / resume path) so a
resumed run can never read stale learnings; and `wave` asserts the slice spec exists in the worktree
before emitting the wave JSON.

## Considered options

- **Always commit `.plans/` (status quo).** Rejected: forces plan commits into the user's history
  with no opt-out.
- **A `--tracked` flag (default false) to optionally commit the plan.** Considered, then dropped:
  committing the plan is a one-line ask the user can make of their own agent ("commit `.plans/`"), so
  otto needs no flag, no end-of-loop commit, and no policy. Less surface area; the user keeps control.
- **Use `.gitignore` as the track/ephemeral signal.** Rejected: would force otto to reason about and
  potentially override the user's git intent. otto should not infer policy from `.gitignore`.
- **Temporary commit, then rewrite history to remove it.** Rejected: fragile history rewriting under
  the user, and incompatible with a user who legitimately *wants* the plan committed.
- **Inject spec + learnings directly into the agent prompt, never touch the worktree's files.** Pure
  (nothing touches worktree git state) but a larger rewrite of the spec-reading contract; kept as a
  future option if the copy approach proves limiting.
