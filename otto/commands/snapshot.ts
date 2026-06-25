import { PlanState } from "../utils/state.ts";
import { ignoreWorktrees, commitPlanDir } from "../utils/git.ts";
import { ok } from "../utils/lib.ts";
import { runValidate } from "./validate.ts";

export function cmdSnapshot(slug: string): void {
  // LOOP.md step 0 gate: validate before committing so a hand-edited or
  // hand-authored plan that never went through /to-slices can't start a run.
  // runValidate prints every problem to stderr and returns 1 on any error
  // (warnings print but return 0). On error we abort here, BEFORE constructing
  // PlanState or committing the plan dir, so the invalid plan is never
  // snapshotted. (runValidate owns check #1 without die-ing, unlike PlanState.)
  const code = runValidate(slug);
  if (code !== 0) process.exit(code);

  const ps = new PlanState(slug);
  ignoreWorktrees();
  commitPlanDir(ps.dir, `otto: snapshot ${slug} plan`);
  ok(`snapshot ${slug}`);
}
