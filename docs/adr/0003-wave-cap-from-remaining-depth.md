# The wave cap is remaining critical-path depth plus a user buffer

**Status:** superseded by [0004](0004-wave-cap-from-static-depth.md)

> **Superseded.** The "anchored to this run's start" argument below is wrong: within a single run
> the wave counter climbs while remaining depth shrinks as slices land, so they diverge *during* the
> run. A healthy linear chain deeper than `buffer + 1` reaches a 1-deep remainder at its final wave
> while the counter already sits at the original depth — tripping the cap on a run that made perfect
> progress (reproduced: the `basic` e2e plan, depth 4 buffer 2, falsely trips at wave 4). ADR 0004
> replaces remaining depth with static structural depth, computed statelessly per `wave` call.

The wave loop needs a non-progress backstop: if the same unfinished slice keeps failing validation,
the next `wave` recomputes the identical frontier and the loop spins forever without the graph
draining. wave halts when the wave counter passes a cap.

The cap is `criticalDepth + buffer`:

- **`criticalDepth`** — the longest `blocked_by` chain through the **in-range, not-`done`** subgraph,
  recomputed at every `wave` call. `done` and out-of-range dependencies terminate a chain. This is
  the number of waves a healthy run still needs, because a wave drains the whole unblocked frontier
  at once — so the minimum waves to completion is the depth of the remaining DAG, not the slice count.
- **`buffer`** — user slack (`--buffer`/`-b`, default 2). Past the depth, it's the number of extra
  waves of retries wave tolerates on the stuck frontier before declaring livelock.

The cap is **mode-independent**. `inline` and `worktree` differ only in whether a wave's slices run
sequentially or in parallel; both drain the same frontier per wave, so both take `criticalDepth`
waves. An earlier design split the baseline (slice count for inline, wave count for worktree) on the
assumption that inline runs one slice per wave — it does not; inline runs the whole frontier
sequentially within a single wave.

## Why remaining depth, and the invariant it depends on

We compute depth over the **not-`done`** subgraph rather than the whole plan so the cap tightens as
work lands — a run stuck on a 1-deep remainder trips after `1 + buffer` waves on that frontier, not
after the full original depth.

This is only safe because **the wave counter is per-run and not persisted**: `LOOP.md` starts the
counter at 1 on each `/wave run`, and it climbs only within one continuous loop. Counter and depth
are therefore both anchored to "this run's start." If the counter were ever persisted across
resumes while depth kept excluding `done` slices, a healthy run that completed several waves and now
has a shallow remainder would compare a large counter against a small cap and **falsely halt**.
Treat "the wave counter is per-run / non-persisted" as a load-bearing invariant of this cap.

## Considered options

- **`totalSlices + 1` (status quo).** Rejected: not overridable, and loose — it assumes a fully
  serial chain, so a wide graph of independent slices (depth 1) is allowed to spin for as many waves
  as there are slices.
- **A flat user-named ceiling (`--max-waves N`).** Rejected for this knob: that is a cost budget,
  indifferent to progress. The backstop we want is structural — derived from the graph — so it
  scales with the plan. A flat ceiling could be layered on later as a separate concern.
- **Whole-graph (static) depth + buffer.** Rejected: looser than remaining depth; would not tighten
  as slices land.
- **Remaining critical-path depth + buffer (chosen).** Tightest correct non-progress signal, given
  the per-run counter invariant.
