# Rewrite the first line of shared.txt

**Type:** AFK

## What to build

The repo already contains `shared.txt`. Replace its **first line** with exactly:

```
changed-by-01
```

Leave the rest of the file untouched. Trivial fixture slice — do exactly this. Do not touch `.plans/`.

This fixture deliberately makes two same-wave slices edit the same line of the same file. They are
declared as independent (no `blocked_by` edge between them) on purpose, so otto's landing step must
detect the collision and hard-stop. That is the behavior under test — your job is just to make the edit.

## Acceptance criteria

- [ ] The first line of `shared.txt` is `changed-by-01`.

## Skills

None — plain file edit.

## Validation

1. Run `test "$(head -n1 shared.txt)" = "changed-by-01" && echo VALID` and confirm it prints `VALID`.
2. Set `validationClean: true` only if that command printed `VALID`.
