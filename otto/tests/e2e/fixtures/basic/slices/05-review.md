# Human review of the merged log

**Type:** HITL

## What to build

A human must eyeball `out/log.txt` and confirm the merge looks right. This slice is HITL on purpose:
otto must **halt** the loop here rather than run it unattended. No agent should ever execute this
slice automatically.

## Acceptance criteria

- [ ] A human has reviewed `out/log.txt` and approved it.

## Skills

None.

## Validation

Manual — performed by a human.
