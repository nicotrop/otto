# Add the alpha file

**Type:** AFK

## What to build

Create a new file `out/alpha.txt` containing exactly one line:

```
alpha
```

Trivial fixture slice — do exactly this and nothing more. Do NOT modify `out/log.txt` (a sibling
slice in this wave owns its own file; touching shared files would force a conflict). Do not touch
`.plans/`.

## Acceptance criteria

- [ ] `out/alpha.txt` exists and contains the line `alpha`.

## Skills

None — plain file edit.

## Validation

1. Run `test "$(cat out/alpha.txt)" = "alpha" && echo VALID` and confirm it prints `VALID`.
2. Set `validationClean: true` only if that command printed `VALID`.
