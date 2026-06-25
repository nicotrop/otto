import { PlanState } from "../utils/state.ts";
import { removeWorktree } from "../utils/git.ts";
import { ok } from "../utils/lib.ts";

export function cmdReset(slug: string, slice: string): void {
  const ps = new PlanState(slug);
  ps.setStatus(slice, "pending");
  removeWorktree(slug, slice);
  ok(`${slice} → pending (worktree cleaned up)`);
}

export function cmdDone(slug: string, slice: string): void {
  const ps = new PlanState(slug);
  ps.setStatus(slice, "done");
  removeWorktree(slug, slice);
  ok(`${slice} → done`);
}
