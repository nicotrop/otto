#!/usr/bin/env bash
# Regression test for the wave-cap bug (ADR 0003 → ADR 0004) — no agents.
#
#   ./cap-regression.test.sh
#
# The `deep-chain` fixture is a pure linear AFK chain 01→02→03→04→05 (depth 5).
# The bug: a cap pinned to REMAINING (not-done) depth shrinks as slices land
# while the wave counter climbs, so a healthy chain deeper than buffer+1
# false-trips at its final wave. With the static-depth cap (ADR 0004), depth
# stays 5 no matter how many slices are done, so the cap stays 7 and wave 5
# does not trip.
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OTTO="$here/../../index.ts"
otto() { node --experimental-strip-types --no-warnings "$OTTO" "$@"; }
field() { local f="$1"; shift; otto "$@" 2>/dev/null | FIELD="$f" node -e "const w=JSON.parse(require('fs').readFileSync(0));process.stdout.write(String(w[process.env.FIELD]))"; }

pass=0 fail=0
check() { if [ "$2" = "$3" ]; then pass=$((pass+1)); printf '  ✓ %s\n' "$1"
  else fail=$((fail+1)); printf '  ✗ %s — expected %q, got %q\n' "$1" "$2" "$3"; fi; }

"$here/reset-sandbox.sh" deep-chain >/dev/null
cd "$here/sandbox"

echo "cap-regression.test.sh — deep-chain fixture (linear depth 5, buffer 2 → cap 7)"

# Static-depth invariant: depth is 5 at the start AND after slices land.
check "fresh: critical_depth 5" "5" "$(field critical_depth wave deep-chain -w 1)"
otto done deep-chain 01-a >/dev/null
otto done deep-chain 02-b >/dev/null
otto done deep-chain 03-c >/dev/null
otto done deep-chain 04-d >/dev/null
check "after 01-04 done: critical_depth STILL 5 (not collapsed to 1)" \
  "5" "$(field critical_depth wave deep-chain -w 5)"
check "remaining depth (status) is 1" "remaining depth: 1  (4/5 slices done)" \
  "$(otto status deep-chain 2>/dev/null | grep -o 'remaining depth:.*')"

# THE REGRESSION: wave 5 with only the depth-1 remainder left.
#   old (remaining depth): cap = 1+2 = 3, 5 > 3  → false-trip
#   new (static depth):    cap = 5+2 = 7, 5 ≤ 7  → runs the last slice
check "wave 5: cap is 7 (static depth), not 3" "7" "$(field wave_cap wave deep-chain -w 5)"
check "wave 5: cap_reached FALSE (the fixed bug)" "false" "$(field cap_reached wave deep-chain -w 5)"
check "wave 5: 05-e actually runs" "05-e" \
  "$(otto wave deep-chain -w 5 2>/dev/null | node -e "const w=JSON.parse(require('fs').readFileSync(0));process.stdout.write(w.slices.map(s=>s.key).join(','))")"

# A genuinely stuck run still trips: counter climbs past the static cap.
check "wave 8 > cap 7: cap_reached TRUE (real stall still caught)" \
  "true" "$(field cap_reached wave deep-chain -w 8)"

# The -d override still tightens the cap for a deliberate resume.
check "resume tighten: -d 1 → cap 3, wave 5 trips" \
  "true" "$(field cap_reached wave deep-chain -w 5 -d 1)"

"$here/reset-sandbox.sh" deep-chain >/dev/null
echo ""
printf 'cap-regression: %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
