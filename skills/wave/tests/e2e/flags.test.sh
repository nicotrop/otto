#!/usr/bin/env bash
# Deterministic assertions for `wave wave`/`status`/`list` flags — no agents.
#
#   ./flags.test.sh
#
# Resets the sandbox to the `basic` fixture, then drives wave with various flag
# combinations and asserts the emitted wave JSON / exit codes. Exercises:
#   -s/--slices   range scoping
#   -m/--mode     worktree vs inline isolation
#   -b/--buffer   cap = depth + buffer
#   -d/--depth    static-depth override of the cap
#   -w/--wave     wave counter + cap_reached
# and the arg-validation guards for -w/-b/-d.
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WAVE="$here/../../index.ts"
wave() { node --experimental-strip-types --no-warnings "$WAVE" "$@"; }
# Pull one top-level field out of a `wave` JSON emission (stdout only).
# Usage: field <fieldname> <wave args...>
field() { local f="$1"; shift; wave "$@" 2>/dev/null | FIELD="$f" node -e "const w=JSON.parse(require('fs').readFileSync(0));process.stdout.write(String(w[process.env.FIELD]))"; }

pass=0 fail=0
check() { # check <label> <expected> <actual>
  if [ "$2" = "$3" ]; then pass=$((pass+1)); printf '  ✓ %s\n' "$1"
  else fail=$((fail+1)); printf '  ✗ %s — expected %q, got %q\n' "$1" "$2" "$3"; fi
}
# checks that a command exits non-zero (arg-validation guards)
check_dies() { # check_dies <label> <args...>
  if wave "${@:2}" >/dev/null 2>&1; then fail=$((fail+1)); printf '  ✗ %s — expected non-zero exit\n' "$1"
  else pass=$((pass+1)); printf '  ✓ %s\n' "$1"; fi
}

"$here/reset-sandbox.sh" basic >/dev/null
cd "$here/sandbox"

echo "flags.test.sh — basic fixture (5 slices, structural depth 4)"

# -s / --slices: scope the wave to a range.
keys() { wave "$@" 2>/dev/null | node -e "const w=JSON.parse(require('fs').readFileSync(0));process.stdout.write(w.slices.map(s=>s.key).join(','))"; }
check "no -s → wave 1 has 1 slice (01-seed)" "01-seed" "$(keys wave basic -w 1)"
# Range 2-3 with 01 not done → nothing unblocked in range (both need 01).
check "-s 2-3 before 01 done → empty wave" "" "$(keys wave basic -w 1 -s 2-3)"

# -s changes the critical depth (scoped subgraph is shorter).
check "no -s → critical_depth 4"  "4" "$(field critical_depth wave basic -w 1)"
check "-s 1-2 → critical_depth 2" "2" "$(field critical_depth wave basic -w 1 -s 1-2)"
check "-s 1   → critical_depth 1" "1" "$(field critical_depth wave basic -w 1 -s 1)"

# -b / --buffer: cap = depth + buffer.
check "default buffer 2 → cap 6" "6" "$(field wave_cap wave basic -w 1)"
check "-b 0 → cap 4"             "4" "$(field wave_cap wave basic -w 1 -b 0)"
check "-b 5 → cap 9"             "9" "$(field wave_cap wave basic -w 1 -b 5)"

# -d / --depth: override the static depth used for the cap.
check "-d 1 -b 0 → cap 1"  "1"  "$(field wave_cap wave basic -w 1 -d 1 -b 0)"
check "-d 10 → cap 12"     "12" "$(field wave_cap wave basic -w 1 -d 10)"

# -w / --wave + cap interaction: cap_reached only when counter passes the cap.
check "w4 vs cap 6 → not reached (the old false-trip)" "false" "$(field cap_reached wave basic -w 4)"
check "w7 vs cap 6 → reached"                          "true"  "$(field cap_reached wave basic -w 7)"
check "w2 vs -d 1 -b 0 cap 1 → reached"                "true"  "$(field cap_reached wave basic -w 2 -d 1 -b 0)"

# -m / --mode: a single-slice wave is always inline; isolation flips only with >1.
check "mode default worktree, 1 slice → inline isolation" "inline" \
  "$(wave wave basic -w 1 2>/dev/null | node -e "const w=JSON.parse(require('fs').readFileSync(0));process.stdout.write(w.slices[0]?.isolation||'')")"
check "-m inline → mode inline" "inline" \
  "$(wave wave basic -w 1 -m inline 2>/dev/null | node -e "const w=JSON.parse(require('fs').readFileSync(0));process.stdout.write(w.mode)")"

# status prints remaining depth for resume.
check "status shows remaining depth 4 (fresh)" "remaining depth: 4  (0/5 slices done)" \
  "$(wave status basic 2>/dev/null | grep -o 'remaining depth:.*')"

# arg-validation guards.
check_dies "-w 0 dies"   wave basic -w 0
check_dies "-w -1 dies"  wave basic -w -1
check_dies "-b -1 dies"  wave basic -b -1
check_dies "-d 0 dies"   wave basic -d 0
check_dies "-m bogus dies" wave basic -m bogus

# multi-slice worktree isolation: mark 01 done so 02+03 unblock.
wave done basic 01-seed >/dev/null
check "2-slice wave → worktree isolation" "worktree,worktree" \
  "$(wave wave basic -w 2 2>/dev/null | node -e "const w=JSON.parse(require('fs').readFileSync(0));process.stdout.write(w.slices.map(s=>s.isolation).join(','))")"
check "2-slice wave -m inline → inline isolation" "inline,inline" \
  "$(wave wave basic -w 2 -m inline 2>/dev/null | node -e "const w=JSON.parse(require('fs').readFileSync(0));process.stdout.write(w.slices.map(s=>s.isolation).join(','))")"
check "after 01 done, remaining depth 3" "remaining depth: 3  (1/5 slices done)" \
  "$(wave status basic 2>/dev/null | grep -o 'remaining depth:.*')"

"$here/reset-sandbox.sh" basic >/dev/null
echo ""
printf 'flags: %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
