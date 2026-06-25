import { PlanState, runnableAfk, pendingHitl } from "../utils/state.ts";
import { ignoreWorktrees, ensureWorktree, git } from "../utils/git.ts";
import { type Mode, emit, ok, info } from "../utils/lib.ts";

export function cmdWave(slug: string, range: string | undefined, mode: Mode): void {
  const ps = new PlanState(slug);
  const afk = runnableAfk(ps, range, mode);
  const halt_hitl = pendingHitl(ps, range);

  if (afk.some((s) => s.isolation === "worktree")) ignoreWorktrees();
  const base = git.headSha();
  for (const s of afk) {
    if (s.isolation === "worktree") ensureWorktree(slug, s.key, base);
    ok(`set up ${s.key} (${s.isolation})`);
  }
  if (!afk.length) info("no runnable AFK slices — graph drained, blocked, or only HITL remains");

  emit({ slug, repo: process.cwd(), base_sha: base, mode, slices: afk, halt_hitl });
}
