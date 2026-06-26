# Merge alpha and beta into the log

**Type:** AFK

## What to build

Both `out/alpha.txt` and `out/beta.txt` now exist (created by slices 02 and 03, which landed before
this slice runs). Append their contents to `out/log.txt` so the file ends up as exactly these three
lines, in this order:

```
01-seed: ok
alpha
beta
```

This slice depends on 02 and 03, so it proves the earlier waves' commits compounded into the base
this slice was cut from. Trivial fixture slice — do exactly this. Do not touch `.plans/`.

## Acceptance criteria

- [ ] `out/log.txt` is exactly the three lines above, in order.

## Skills

None — plain file edit.

## Validation

1. Run `printf '01-seed: ok\nalpha\nbeta\n' | diff - out/log.txt && echo VALID` and confirm it prints `VALID`.
2. Set `validationClean: true` only if that command printed `VALID`.
