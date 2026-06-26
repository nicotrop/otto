<img src="otto.svg" width="88" alt="otto the octopus" align="left" />

# otto

otto runs a plan to completion in [Claude Code](https://www.claude.com/product/claude-code) (only runtime for now). You break a feature into slices with dependencies, otto runs the independent ones in parallel git worktrees, lands each as a commit, and moves to the next wave until the work is done or it hits something that needs you.

## Why I built it

[This workshop](https://www.youtube.com/watch?v=-QFHIoCo-Ko) got me wanting to run [Ralph loops](https://ghuntley.com/ralph/) again. A Ralph loop is a single agent in a shell `while` loop, fresh context each pass, with state surviving in the repo (a TODO/state file plus git history). otto keeps that shape but runs on Claude Code subagents instead of a shell, and turns the flat loop into a dependency graph: it runs each wave of independent slices in parallel, compounding on the last.

Planning is already solved. Matt Pocock's [grill-me](https://github.com/mattpocock/skills/tree/main/skills/productivity/grill-me) / [grill-with-docs](https://github.com/mattpocock/skills/tree/main/skills/engineering/grill-with-docs) interrogate an idea until it's sharp, then [to-prd](https://github.com/mattpocock/skills/tree/main/skills/engineering/to-prd) / [to-issues](https://github.com/mattpocock/skills/tree/main/skills/engineering/to-issues) write it up as [tracer-bullet](https://www.aihero.dev/tracer-bullets) slices. However, to-issues drops them in your GitHub issue tracker; I wanted to stay local.

```
grill-me / grill-with-docs   →   sharpen the idea
to-plan / to-slices          →   write slices to .plans/   (local files, not GitHub issues)
/otto run                    →   execute them
```

So `to-plan` / `to-slices` (bundled here) do the same job but write `.plans/` files instead of issues. otto is the execution half that runs them.

It compounds on both: Matt's grilling and tracer-bullet slices arranged into a dependency graph for the plan, Ralph's loop-until-done patterns for the run. Then it leans on that graph to run a whole wave of independent slices in parallel instead of one task at a time. Now that [Claude Code workflows](https://www.claude.com/product/claude-code) have dropped, it fans each wave out as a workflow, one subagent per slice. Everything stays local: plans are files in `.plans/`, the loop is a workflow, the state is git, so there's no issue tracker, no API token, and no separate harness to run.

## Install

```
git clone https://github.com/nicotrop/otto
cp -r otto/{otto,to-plan,to-slices} ~/.claude/skills/
```

Drop the folders in your Claude Code skills directory (otto is Claude Code only for now). Needs Node 23+ (otto runs its TypeScript directly).

## Skills

- **`/to-plan`** — turn a sharpened idea into a plan
- **`/to-slices`** — break the plan into dependency-ordered slices in `.plans/<slug>/`
- **`/otto run`** — execute the slices wave by wave until done or a slice needs you

## How it works

A plan is `.plans/<slug>/`: a `state.json` keyed by slice with `blocked_by` edges, plus a markdown spec per slice. Each slice is a tracer bullet — a thin vertical cut through the whole system, not a horizontal layer — so it can build and verify on its own before anything depends on it. otto topologically sorts the graph and runs each wave of unblocked slices in parallel, one git worktree per slice off current HEAD. Each slice lands as a commit (code, state bump, and the learnings it leaves for later slices); the next wave branches off that, so work compounds.

```
validate → wave → land    (repeat until the graph drains or hits a slice that needs you)
```

otto never pushes, so review the stack afterward and squash/amend as you like. Scope a run to stop after a range:

```
/otto run <slug>          run the whole plan
/otto run <slug> -s 1-4   run slices 1–4, then stop so you can review the commits
/otto run <slug> --mode inline   skip worktrees, run slices sequentially in the main tree
```

Worktree isolation means parallel slices can't clobber each other. If two in a wave do conflict on a real file, the graph under-declared a dependency, so otto stops and points you at the `blocked_by` edge to add rather than guessing a merge.
