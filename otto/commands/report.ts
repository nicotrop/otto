import { PlanState, runnableAfk, pendingHitl } from "../utils/state.ts";
import { git, worktreePath } from "../utils/git.ts";
import { type Mode, type Status, info } from "../utils/lib.ts";

export function cmdStatus(slug: string): void {
  const plan = new PlanState(slug).read();
  const glyph: Record<Status, string> = { done: "✓", review: "◉", pending: "○" };
  console.log(`\nPlan: ${slug}\n`);
  for (const [key, s] of Object.entries(plan.slices).sort()) {
    const working = s.status === "pending" && git.worktreeExists(worktreePath(slug, key));
    const mark = working ? "◎" : glyph[s.status];
    const tail =
      working ? "  ← agent working (worktree live)"
      : s.status === "review" ? "  ← ready for QA"
      : s.status === "pending" && s.blocked_by.length ? `  (blocked by: ${s.blocked_by.join(", ")})`
      : "";
    console.log(`  ${mark} ${key}${tail}`);
  }
  const count = (st: Status) => Object.values(plan.slices).filter((s) => s.status === st).length;
  console.log(`\n  ${count("done")} done  ${count("review")} review  ${count("pending")} pending\n`);
}

export function cmdList(slug: string, range: string | undefined, mode: Mode): void {
  const ps = new PlanState(slug);
  const afk = runnableAfk(ps, range, mode);
  const hitl = pendingHitl(ps, range);
  if (!afk.length && !hitl.length) return info("no unblocked slices ready to run");
  if (afk.length) {
    const how = mode === "inline" ? "inline, sequential" : "parallel worktrees";
    console.log(`Next wave (AFK, ${how}):`);
    for (const s of afk) console.log(`  ○ ${s.key}`);
  }
  if (hitl.length) {
    console.log("Halts the loop (HITL — needs you):");
    for (const k of hitl) console.log(`  ◌ ${k}`);
  }
}
