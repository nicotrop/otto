# wave e2e tests

Fast, real-agent end-to-end tests for the wave loop. Each "slice" does a trivial file edit
(create/append a line), so a full multi-wave run finishes in a couple of minutes instead of the
~40+ a real codebase plan takes — while still exercising the true `validate → wave → land` path
through real subagents and real git worktrees.

## Layout

```
tests/e2e/
  fixtures/         plan fixtures, one dir per plan (the .plans/<slug>/ shape)
    basic/          5-slice graph: inline wave, parallel worktree wave, land+rebase, HITL halt
    conflict/       two same-wave slices edit the same line → land must hard-stop
    bad/            malformed plan → validate must reject (5 distinct error classes)
  sandbox/          throwaway git repo the tests drive wave against (gitignored from the skill repo)
  reset-sandbox.sh  resets sandbox to baseline + seeds a chosen fixture's plan into .plans/
  E2E.md            this file
```

`WAVE=/Users/nico/Documents/skills/otto/skills/wave/index.ts` and run it with
`node --experimental-strip-types --no-warnings "$WAVE" …`.

The **wave** step must go through the **Workflow tool** (it fans out real subagents), so these tests
are run by Claude following the steps below — not a single shell script. Everything except the wave
fan-out is plain shell and fully deterministic.

## Reset

`./reset-sandbox.sh <fixture>` — resets the sandbox to its baseline commit, removes any wave
worktrees/branches from a prior run, wipes untracked run output, and copies `fixtures/<fixture>/`
into `sandbox/.plans/<slug>/` (slug = the plan's `state.json` "plan" field). The sandbox baseline
tracks `shared.txt`, `README.md`, `.gitignore`; only `.plans/` is gitignored inside the sandbox
(slice output like `out/` is real, committable code).

## Scenarios

### 1. validate (deterministic, no agents)

- `./reset-sandbox.sh basic` → `validate basic` exits 0, prints `✓ validated basic`.
- `./reset-sandbox.sh bad`   → `validate bad` exits 1 and prints 5 `error:` lines:
  invalid status, dangling blocked_by, dependency cycle, missing **Type:** line, slice with no file.

### 2. flags + wave cap (deterministic, no agents)

Run `./flags.test.sh` — it asserts the emitted wave JSON / exit codes for every flag and prints
`flags: N passed, M failed` (exit non-zero on any failure). Covers:

- `-s/--slices` range scoping (which slices run, and that `critical_depth` follows the scoped subgraph).
- `-m/--mode` worktree vs inline isolation (single-slice waves are always inline; isolation flips at >1).
- `-b/--buffer` and `-d/--depth` → `wave_cap = (depth-or-override) + buffer`.
- `-w/--wave` vs the cap → `cap_reached` (including the regression check that a depth-4 plan at wave 4
  does **not** trip — the old false-positive).
- arg-validation guards: `-w 0`, `-w -1`, `-b -1`, `-d 0`, `-m bogus` all die non-zero.
- `status` prints `remaining depth: <n>  (<done>/<total> slices done)`.

### 3. basic flow (real agents — the main e2e)

`./reset-sandbox.sh basic`, then loop per LOOP.md, carrying a wave counter:

1. `validate basic`
2. `wave basic -w 1` → one slice `01-seed`, **inline**. Run via Workflow (args = the wave JSON).
   `land basic 01-seed -L "…"` → commit `01-seed`, working tree clean, state → done.
3. `wave basic -w 2` → `02-alpha` + `03-beta`, **worktree** (parallel). Run via Workflow.
   `land basic 02-alpha …` then `land basic 03-beta …` — the second logs "rebasing onto current
   HEAD". Both land as commits, worktrees auto-removed.
4. `wave basic -w 3` → `04-merge`, **inline**. The agent sees alpha.txt + beta.txt (proves the
   landed waves compounded). Land it.
5. `wave basic -w 4` → only `05-review` (HITL) remains → loop must **halt** on the HITL slice
   (`cap_reached: false`, `slices: []`, `halt_hitl: ["05-review"]`). This wave is the regression
   point for the cap bug — see scenario 5.

Expected final state: `out/log.txt` = `01-seed: ok` / `alpha` / `beta`; commits
baseline → 01-seed → 02-alpha → 03-beta → 04-merge; `.plans/` never committed.

### 4. land conflict hard-stop (real agents)

`./reset-sandbox.sh conflict`, then `validate conflict`, `wave conflict -w 1` → `01-edit-top` +
`02-edit-top-too` both run in worktrees and both rewrite the **first line** of `shared.txt`. Run via
Workflow. `land conflict 01-edit-top` succeeds; `land conflict 02-edit-top-too` must **die with a
CONFLICT message** (the patch fails to apply on the rebased HEAD and is not already present). That
is the "graph under-declared a dependency" hard-stop.

### 5. wave-cap regression — `deep-chain` fixture (deterministic, no agents)

Run `./cap-regression.test.sh`. It exercises the bug that ADR 0003 had and ADR 0004 fixed: a cap
pinned to *remaining* (not-`done`) depth shrinks as slices land while the wave counter climbs, so a
healthy linear chain deeper than `buffer + 1` false-trips at its final wave.

The `deep-chain` fixture is a pure linear AFK chain `01 → 02 → 03 → 04 → 05` (structural depth 5, no
HITL). The test marks `01`–`04` done and computes wave 5:

- **Fixed (static depth):** depth 5, cap `5 + 2 = 7`, `5 ≤ 7` → `cap_reached: false`, `05` runs.
- **Old (remaining depth):** remaining depth 1, cap `1 + 2 = 3`, `5 > 3` → would false-trip.

It also asserts `critical_depth` stays `5` regardless of how many slices are `done` (the static-depth
invariant), and that a genuinely stuck run (`-w 8` past cap 7) still trips `cap_reached: true`.
