import { PlanState, runnableAfk, pendingHitl } from "../utils/state.ts";
import { ignoreWorktrees, ensureWorktree, git } from "../utils/git.ts";
import { type Mode, emit, ok, info } from "../utils/lib.ts";

export function cmdWave(slug: string, range: string | undefined, mode: Mode, wave?: number): void {
  const ps = new PlanState(slug);

  const totalSlices = Object.keys(ps.read().slices).length;
  const maxWaves = totalSlices + 1;
  const waveNum = wave ?? 1;
  if (waveNum > maxWaves) {
    info(`wave ${waveNum} exceeds max_waves ${maxWaves} (${totalSlices} slices) — halting; the loop is not making progress`);
    emit({ slug, repo: process.cwd(), base_sha: git.headSha(), mode, slices: [], halt_hitl: [], wave_num: waveNum, max_waves: maxWaves, cap_reached: true });
    return;
  }

  const afk = runnableAfk(ps, range, mode);
  const halt_hitl = pendingHitl(ps, range);

  if (afk.some((s) => s.isolation === "worktree")) ignoreWorktrees();
  const base = git.headSha();
  for (const s of afk) {
    if (s.isolation === "worktree") ensureWorktree(slug, s.key, base);
    ok(`set up ${s.key} (${s.isolation})`);
  }
  if (!afk.length) info("no runnable AFK slices — graph drained, blocked, or only HITL remains");

  emit({ slug, repo: process.cwd(), base_sha: base, mode, slices: afk, halt_hitl, wave_num: waveNum, max_waves: maxWaves, cap_reached: false });
}
