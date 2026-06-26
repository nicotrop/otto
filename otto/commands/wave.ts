import { PlanState, WaveGraph, runnableAfk, pendingHitl } from "../utils/state.ts";
import { ensureWorktree, git } from "../utils/git.ts";
import { type Mode, emit, ok, info } from "../utils/lib.ts";

export function cmdWave(slug: string, range: string | undefined, mode: Mode, wave: number | undefined, buffer: number, depth: number | undefined): void {
  const ps = new PlanState(slug);

  const criticalDepth = depth ?? WaveGraph.criticalDepth(ps.read(), range);
  const waveCap = criticalDepth + buffer;
  const waveNum = wave ?? 1;
  if (waveNum > waveCap) {
    info(`wave ${waveNum} exceeded the cap of ${waveCap} (critical depth ${criticalDepth} + buffer ${buffer})`);
    emit({ slug, repo: process.cwd(), base_sha: git.headSha(), mode, slices: [], halt_hitl: [], wave_num: waveNum, critical_depth: criticalDepth, buffer, wave_cap: waveCap, cap_reached: true });
    return;
  }

  const afk = runnableAfk(ps, range, mode);
  const halt_hitl = pendingHitl(ps, range);

  const base = git.headSha();
  for (const s of afk) {
    if (s.isolation === "worktree") ensureWorktree(slug, s.key, base);
    ok(`set up ${s.key} (${s.isolation})`);
  }
  if (!afk.length) info("no runnable AFK slices — graph drained, blocked, or only HITL remains");

  emit({ slug, repo: process.cwd(), base_sha: base, mode, slices: afk, halt_hitl, wave_num: waveNum, critical_depth: criticalDepth, buffer, wave_cap: waveCap, cap_reached: false });
}
