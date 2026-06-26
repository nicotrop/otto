#!/usr/bin/env bash
# Reset the e2e sandbox to a clean baseline and seed it with a fixture plan.
#
#   reset-sandbox.sh <fixture>
#
# <fixture> is a dir name under fixtures/ (basic | conflict | bad). The fixture's
# state.json "plan" field is the slug; the fixture is copied to .plans/<slug>/.
#
# Leaves the sandbox as: baseline commit checked out, working tree clean except
# for the seeded (gitignored) .plans/<slug>/. Removes any otto worktrees/branches
# left by a previous run so the run is reproducible.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
sandbox="$here/sandbox"
fixture="${1:?usage: reset-sandbox.sh <fixture>}"
src="$here/fixtures/$fixture"

[ -d "$src" ] || { echo "no such fixture: $src" >&2; exit 1; }
[ -d "$sandbox/.git" ] || { echo "sandbox not initialized: $sandbox" >&2; exit 1; }

slug="$(node -e "process.stdout.write(require('$src/state.json').plan)")"

cd "$sandbox"

# Drop any otto worktrees + plan branches from a prior run.
for wt in $(git worktree list --porcelain | awk '/^worktree /{print $2}' | grep "/.plans/.worktrees/" || true); do
  git worktree remove "$wt" --force 2>/dev/null || true
done
git worktree prune
for b in $(git for-each-ref --format='%(refname:short)' refs/heads/plan 2>/dev/null || true); do
  git branch -D "$b" 2>/dev/null || true
done

# Reset tracked files to baseline and wipe untracked run output (out/, .plans/, etc.).
base="$(git rev-list --max-parents=0 HEAD | tail -n1)"
git reset -q --hard "$base"
git clean -qfdx

# Seed the chosen fixture plan as gitignored working-tree files (the new model).
mkdir -p ".plans/$slug"
cp -R "$src/." ".plans/$slug/"

echo "sandbox reset → fixture '$fixture' (slug '$slug') at $(git rev-parse --short HEAD)"
echo "  plan seeded: .plans/$slug/  (gitignored)"
echo "  sandbox: $sandbox"
