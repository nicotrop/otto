# The wave cap is static critical-path depth plus a user buffer

**Status:** accepted (supersedes [0003](0003-wave-cap-from-remaining-depth.md))

The wave loop needs a non-progress backstop: if the same unfinished slice keeps failing validation,
the next `wave` recomputes the identical frontier and the loop spins without the graph draining. otto
halts when the wave counter passes a cap of `criticalDepth + buffer`.

## What the cap measures

The cap bounds the **whole run's length**: a depth-`D` plan should finish in `D + buffer` waves
(one wave drains the entire unblocked frontier, so the minimum waves to completion is the depth of
the DAG, not the slice count). Needing more waves than that means the loop is spinning. The cap is
**mode-independent** — `inline` and `worktree` both drain a full frontier per wave, so both take
`criticalDepth` waves.

## criticalDepth is static and stateless

`criticalDepth` is the longest `blocked_by` chain through the **in-range** subgraph, counting **all**
slices regardless of status. It does **not** exclude `done` slices. This makes it a constant for a
given plan + range: every `wave` call computes the same number, so the cap basis never moves while
the wave counter climbs.

This is the correction over ADR 0003, which computed depth over the **not-`done`** subgraph. That
number shrinks as slices land, so within one run it diverges from the monotonically climbing wave
counter — and a healthy chain deeper than `buffer + 1` falsely trips at its final wave (the remainder
is then 1-deep but the counter already equals the original depth). Pinning depth to the static graph
removes the divergence: the counter can only reach `criticalDepth` on a run that is genuinely
draining one layer per wave, and a stuck run climbs past `criticalDepth + buffer` to trip correctly.

Because depth is stateless, the loop carries **no** depth state — `wave` is correct standalone on
every call, the same way the per-run wave counter (ADR 0003's load-bearing invariant) is the only
loop state.

## Resume tightens the budget via an override, not loop state

A static cap is loose on **resume**: a depth-8 plan resumed with 6 slices already done still gets a
cap of `8 + buffer`, even though only a 2-deep remainder is left. This can never *falsely* trip (the
counter restarts at 1 per run), but it tolerates more spinning than ideal before halting a genuinely
stuck resume.

To tighten it, `wave` accepts `--depth`/`-d <n>` as an explicit override of the computed depth. On
resume the run loop reads the **remaining** (not-`done`) depth from `otto status` — which prints it
alongside the done/total count — and passes `-d <that>`. `WaveGraph.remainingDepth` is the not-`done`
variant used only for that human/agent-facing number; the cap itself never computes it. This keeps
the resume-specific number where someone already looks before resuming, instead of as standing loop
state.

## Considered options

- **Remaining critical-path depth + buffer (ADR 0003).** Rejected: tightens as slices land, which is
  exactly what makes it diverge from the wave counter and falsely halt healthy deep runs.
- **Carry an initial depth `D0` captured at wave 1 and echoed via `-d` each wave.** Rejected: forces
  the loop to capture and thread `D0` through every call. Equivalent cap to static depth on a fresh
  run, but reintroduces loop state for no gain — a stateless structural computation is already
  constant across the run.
- **Waves-since-last-landing (barren-wave counter).** Rejected for now: the most direct non-progress
  signal, but the cap stops being computable by `wave` alone — it needs landed-count feedback from
  `land` into the loop. More moving parts than the backstop warrants.
- **Static structural depth + buffer, with `-d` override (chosen).** Stateless, never false-trips,
  and the override covers the one looseness (resume) without adding loop state.
