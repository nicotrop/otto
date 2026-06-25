import { PlanState } from "../utils/state.ts";
import { ignoreWorktrees, commitPlanDir } from "../utils/git.ts";
import { ok } from "../utils/lib.ts";

export function cmdSnapshot(slug: string): void {
  const ps = new PlanState(slug);
  ignoreWorktrees();
  commitPlanDir(ps.dir, `otto: snapshot ${slug} plan`);
  ok(`snapshot ${slug}`);
}
