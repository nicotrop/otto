# Add the beta file

**Type:** AFK

## What to build

Create a new file `out/beta.txt` containing exactly one line:

```
beta
```

Trivial fixture slice — do exactly this and nothing more. Do NOT modify `out/log.txt` or
`out/alpha.txt` (sibling slices own those; touching shared files would force a conflict). Do not
touch `.plans/`.

## Acceptance criteria

- [ ] `out/beta.txt` exists and contains the line `beta`.

## Skills

None — plain file edit.

## Validation

1. Run `test "$(cat out/beta.txt)" = "beta" && echo VALID` and confirm it prints `VALID`.
2. Set `validationClean: true` only if that command printed `VALID`.
