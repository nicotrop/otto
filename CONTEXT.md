# wave — domain glossary

The shared vocabulary for wave, a slice-plan runner for Claude Code. Glossary only — no
implementation details.

## plan

A unit of work to run to completion, living at `.plans/<slug>/`: a PRD, a set of slice specs, a
`state.json` dependency graph, and a `learnings.md`. The plan is the **contract** between the
`/to-plan` → `/to-slices` → `/wave run` stages.

## slice

A thin vertical tracer-bullet through every layer of the work — demoable on its own. Each slice has
a spec (`slices/NN.md`), a status, and `blocked_by` edges to its prerequisite slices. Typed **AFK**
(runs unattended) or **HITL** (halts for a human).

## wave

The set of slices that are unblocked at one moment — all their `blocked_by` slices are `done`. wave
runs a whole wave at once.

## critical depth

The longest `blocked_by` chain through the in-range subgraph, measured in **waves**. Because a wave
drains the whole unblocked frontier at once, this is the minimum number of waves a run needs. It is
**static** — computed over all in-range slices regardless of status — so it stays constant across a
run. (See ADR 0004.)

## wave cap

The non-progress backstop: wave halts the loop when the per-run wave counter passes
`critical depth + buffer`. A healthy run drains one depth-layer per wave and never reaches the cap;
a run spinning on a stuck frontier climbs past it and halts. `buffer` (`--buffer`/`-b`, default 2) is
user slack for retries. On a **resume**, the loop tightens the cap by passing `--depth`/`-d` with the
**remaining** (not-`done`) depth from `wave status`. (See ADR 0004.)

## worktree seeding

Making a slice's spec and the current learnings **present on disk inside the isolated worktree** an
agent runs in. wave seeds by **copying** the main-tree `.plans/<slug>` into each fresh worktree, so
seeding is independent of git. wave never commits `.plans/` — bookkeeping lives as dirty working-tree
files for the run; a user who wants the plan in history commits it themselves. (See ADR 0001.)

## compounding

Each landed wave's learnings flow forward into the next wave. The mechanism: wave writes learnings to
the **main-tree** `learnings.md` (wave is the single writer, via `land -L`), and the next wave's
worktrees are seeded by **copying** that updated main tree — so wave N+1 reads what wave N left.
Compounding depends on **presence + propagation of learnings**, not on the plan being committed. Slice
*code* still commits per wave (so the next worktree, cut from HEAD, contains prior code); only plan
bookkeeping stays uncommitted.

## land

Taking a finished slice's work and committing it onto the user's branch (rebased onto current HEAD),
appending its learning to the main-tree `learnings.md`, and marking it `done`. `land` never commits
`.plans/` into a slice commit — plan bookkeeping is main-tree-only.

`land` is **idempotent**: re-running it after a partial failure is safe. If a prior attempt already
applied the slice's code delta to the working tree, the retry detects that (the patch is already
present) and treats it as a no-op success rather than a failure. (See ADR 0002.)
