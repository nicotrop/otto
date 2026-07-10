# Seed the output log

**Type:** AFK

## What to build

Create a file `out/log.txt` (create the `out/` directory if needed) containing exactly one line:

```
01-seed: ok
```

This is a deliberately trivial fixture slice — do exactly what is asked, nothing more. Do not create
any other files. Do not touch `.plans/`.

## Acceptance criteria

- [ ] `out/log.txt` exists and its first line is `01-seed: ok`.

## Skills

None — plain file edit.

## Validation

1. Run `test "$(head -n1 out/log.txt)" = "01-seed: ok" && echo VALID` and confirm it prints `VALID`.
2. Set `validationClean: true` only if that command printed `VALID`.
