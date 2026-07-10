# `land`'s code-delta apply is made idempotent with a reverse-check, not `--3way`

**Status:** accepted

When `land`s a slice, wave rebases the slice branch onto current HEAD, computes the slice's
code-only delta (`git diff <base>...<branch> -- . ':!.plans'`), and applies it to the main working
tree with `git apply`. Plain `git apply` is **not idempotent**: if the delta is already present in
the working tree, it fails with `error: patch does not apply`. This bites the normal retry path —
if a `land` attempt applies the patch and then dies before committing (or the operator re-runs
`land` for any reason), every retry fails on a patch that is, in fact, already applied. The error
message ("review manually before landing") wrongly implies a real conflict.

We make the apply **idempotent**: when the initial `git apply` fails, wave runs
`git apply --reverse --check` on the same patch. If the reverse-check passes, the change is already
in the tree — wave logs an `info` line and proceeds (no-op success). Only if the reverse-check also
fails does wave treat it as a genuine conflict and `die`.

```
apply patch
  ├─ success            → done
  └─ fail
       reverse --check
         ├─ success     → already applied → info, no-op, proceed
         └─ fail        → real conflict   → die
```

## Why not `git apply --3way`

`--3way` is the textbook answer for "make apply resilient," and was the first candidate. We tested
it against the exact failing scenario (the slice's change already present, unstaged, in the working
tree) and it **also failed**, with `error: does not match index`. `--3way` reconstructs the
patch's ancestor blob from the `index abc..def` line and three-way-merges against the **index**;
when the working tree has the change but the index does not, that comparison fails. So `--3way`
does not cover the precise case that bites wave. `--reverse --check` does — it directly answers the
only question that matters here ("is this delta already in the tree?") and is verified across the
clean / already-applied / genuine-conflict cases.

## Why not `--3way` as a fallback either

A natural follow-up: keep the reverse-check but add `--3way` as a last resort (try plain apply →
reverse-check → `--3way` → die), so `land` could merge through benign context drift instead of
halting. We tested whether that fallback is even reachable in `land`'s flow. It is not — for any
case that would change behavior:

- `land` applies the slice delta **after rebasing the branch onto current HEAD**. The rebase
  already realigns context, so **non-overlapping drift applies cleanly via plain `git apply`** —
  verified: slice A edits the top of a file, slice B the bottom; B's patch `--check`s clean against
  a HEAD that already has A's edit. `--3way` is never needed here.
- The **already-applied** case is caught by the reverse-check.
- The only thing that reaches a `--3way` fallback is a **true overlap** (two slices edit the same
  lines) — and there `--3way` produces conflict markers and exits non-zero. Committing markers is
  exactly the auto-resolve LOOP.md forbids, so we `die` anyway.

So `--3way` would add code and soften the "do not auto-resolve" invariant while changing **zero**
reachable outcomes. The rebase is what makes it redundant: if `land` ever drops the rebase and
applies the delta directly onto HEAD, revisit this — that is the world where `--3way` would earn
its keep.

## Considered options

- **Plain `git apply` (status quo).** Rejected: not idempotent; retries crash on already-applied
  deltas with a misleading "conflict" message.
- **`git apply --3way` (as primary).** Rejected: empirically fails with "does not match index" in
  the unstaged-working-tree case that is exactly the one we need to survive.
- **`git apply --3way` (as a fallback after reverse-check).** Rejected: unreachable for any
  behavior-changing case given `land`'s rebase (see above); benign drift already applies cleanly,
  true overlaps still must halt.
- **Reverse-check guard (chosen).** Detects already-applied as a no-op success; preserves a true
  `die` for genuine overlapping-code conflicts, honoring "do not auto-resolve."
