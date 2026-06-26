# Rewrite the first line of shared.txt (conflicting)

**Type:** AFK

## What to build

The repo already contains `shared.txt`. Replace its **first line** with exactly:

```
changed-by-02
```

Leave the rest of the file untouched. Trivial fixture slice — do exactly this. Do not touch `.plans/`.

This intentionally collides with slice `01-edit-top`, which rewrites the same line in the same wave.
otto must detect the conflict when landing the second slice and hard-stop. Your job is just to make
the edit.

## Acceptance criteria

- [ ] The first line of `shared.txt` is `changed-by-02`.

## Skills

None — plain file edit.

## Validation

1. Run `test "$(head -n1 shared.txt)" = "changed-by-02" && echo VALID` and confirm it prints `VALID`.
2. Set `validationClean: true` only if that command printed `VALID`.
