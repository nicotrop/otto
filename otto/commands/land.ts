import { PlanState } from "../utils/state.ts";
import {
  branchName, worktreePath, removeWorktree, stripPlanEdits, commitSliceWork, git,
} from "../utils/git.ts";
import { ok, info, die } from "../utils/lib.ts";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export function cmdLand(slug: string, slice: string, learning?: string): void {
  const ps = new PlanState(slug);
  const branch = branchName(slug, slice);

  if (!git.branchExists(branch)) {
    ps.setStatus(slice, "done");
    if (learning) ps.appendLearnings([{ key: slice, learnings: learning }]);
    commitSliceWork(slice);
    ok(`${slice} → done (inline, committed)`);
    return;
  }

  const head = git.headSha();
  const base = git.tryRun(["merge-base", "HEAD", branch]);
  if (!base) die(`cannot find common ancestor with ${branch}`);

  git.tryRun(["worktree", "remove", worktreePath(slice), "--force"]);
  stripPlanEdits(branch, base);

  if (base !== head) {
    info(`${slice}: rebasing branch onto current HEAD…`);
    const restore = git.currentBranch();
    const rebased = git.tryRun(["rebase", "--onto", head, base, branch]);
    if (rebased === null) {
      const conflicts = git.tryRun(["diff", "--name-only", "--diff-filter=U"]) ?? "";
      git.tryRun(["rebase", "--abort"]);
      git.tryRun(["checkout", restore]);
      die(
        `CONFLICT landing ${slice} on: ${conflicts.replace(/\n/g, ", ")}\n` +
          `These slices are not actually independent — add a blocked_by edge so they run in different waves, then re-run.`,
      );
    }
    git.tryRun(["checkout", restore]);
  }

  const newBase = git.tryRun(["merge-base", "HEAD", branch]);
  if (!newBase) die(`lost track of ${slice}'s base after rebase — land manually`);
  const diff = git.run(["diff", `${newBase}...${branch}`, "--", ".", ":!.plans"]);
  if (diff.trim()) {
    const patch = join(mkdtempSync(join(tmpdir(), "otto-")), `${slice}.diff`);
    writeFileSync(patch, diff + "\n");
    if (git.tryRun(["apply", patch]) === null) {
      die(`patch for ${slice} failed to apply cleanly — review manually before landing`);
    }
  }
  ps.setStatus(slice, "done");
  if (learning) ps.appendLearnings([{ key: slice, learnings: learning }]);
  commitSliceWork(slice);
  removeWorktree(slug, slice);
  ok(`${slice} → done (committed)`);
}
