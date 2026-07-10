---
name: wave
description: Execute a .plans/<slug> slice plan as a dependency-ordered wave loop using Claude Code subagents (no tmux) — parallel slices run in isolated git worktrees, each lands as a commit you review afterward, and learnings compound across waves. Use when the user wants to run a plan, execute or land slices, check slice progress, or mentions wave, slices, or a .plans folder.
compatibility: Claude Code
disable-model-invocation: true
---

# wave

Execution engine for slice plans. The pipeline is **`/to-plan` → `/to-slices` → `/wave run`**;
wave owns only the last stage. The `.plans/<slug>/` directory (prd.md, slices/*.md, state.json,
learnings.md) is the contract between the stages.

No tmux. Parallelism comes from Claude Code subagents; sequencing comes from the `blocked_by`
dependency graph in `state.json`.

## The two halves

- **`index.ts`** — the deterministic git + state CLI, and the *only* writer of `state.json` and
  `learnings.md` (always the main tree). Executable (a shebang carries the Node type-stripping
  flags) so you invoke it as a path — no flags to type. Set `WAVE` to `index.ts` in *this skill's
  own directory* (the "Base directory for this skill" path from the invocation):

  ```
  WAVE="<this-skill-dir>/index.ts"      # then:  $WAVE <cmd> …
  ```

  (`index.ts` dispatches to `commands/`; shared logic lives in `utils/`.)

- **`workflow/wave.js`** — the single-wave fan-out (in this skill's directory), run via the
  `Workflow` tool: one subagent per slice, each in its wave-made worktree.

## Commands

| Invocation | What it does |
|---|---|
| `/wave run <slug> [-s range] [-m worktree\|inline]` | Run the wave loop (the main thing). |
| `/wave status <slug>` | Show slice statuses. |
| `/wave list <slug> [-s range] [-m …]` | Show the next wave (AFK to run + HITL that would halt). |
| `/wave reset <slug> <slice>` | Reset a slice to pending, clean its worktree. |
| `/wave done <slug> <slice>` | Force-mark a slice done, clean its worktree. |
| `/wave validate <slug>` | Check `state.json` + slice files against wave's data model and run assumptions; report all problems (errors + warnings) and exit non-zero on any error. |

The only positional is `<slug>` (plus `<slice>` for reset/done). Selection and mode are flags:

- **`-s` / `--slices` (default: all)** — which slices, by number: `-s 3-7`, `-s 2`, `-s 3,5-6`.
- **`-m` / `--mode` (default `worktree`)**:
  - `worktree` — each slice in an isolated checkout, run **in parallel** (the default).
  - `inline` — slices run **sequentially in the main tree**, no extra checkouts. Use when the
    user doesn't want worktrees.

For `status`, `list`, `reset`, `done`, `validate`: run `$WAVE <cmd> …` and report the output —
for `validate`, report the `error:`/`warn:` lines it prints to stderr and its exit status.

## Running a plan

`/wave run` is a loop: compute the next wave from `state.json`, set up worktrees, fan out one
subagent per slice via `workflow/wave.js`, land each result as a commit (code + state + that slice's
learning), repeat — until the graph drains or only HITL slices remain (which halts for the human).

**Follow the full procedure in [LOOP.md](LOOP.md)** — it has the exact step-by-step, the conflict
hard-stop rule, and the invariants you must not violate. Read it before driving a run.

Each landed slice is a commit on your branch (wave never pushes), so the loop runs unattended and you
review the stack afterward. To review in batches, scope with `-s` (e.g. `-s 1-4`) so it stops there.

After the loop, landed slices are unstaged changes; the user reviews `git diff`, QAs, and commits
on their own terms.
