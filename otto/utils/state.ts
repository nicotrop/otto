import { existsSync, readFileSync, writeFileSync, mkdtempSync, renameSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { type Status, type SliceType, type Mode, type PlanFile, type RunnableSlice, die } from "./lib.ts";

export class PlanState {
  readonly slug: string;
  readonly dir: string;
  readonly stateFile: string;
  readonly learningsFile: string;

  constructor(slug: string) {
    this.slug = slug;
    this.dir = join(".plans", slug);
    this.stateFile = join(this.dir, "state.json");
    this.learningsFile = join(this.dir, "learnings.md");
    if (!existsSync(this.dir)) die(`plan not found: ${this.dir}`);
    if (!existsSync(this.stateFile)) die(`no state.json in ${this.dir}`);
  }

  read(): PlanFile {
    return JSON.parse(readFileSync(this.stateFile, "utf8")) as PlanFile;
  }

  private write(plan: PlanFile): void {
    const tmp = join(mkdtempSync(join(tmpdir(), "otto-")), "state.json");
    writeFileSync(tmp, JSON.stringify(plan, null, 2) + "\n");
    renameSync(tmp, this.stateFile);
  }

  setStatus(slice: string, status: Status): void {
    const plan = this.read();
    if (!plan.slices[slice]) die(`slice not found: ${slice}`);
    plan.slices[slice].status = status;
    this.write(plan);
  }

  sliceSpec(key: string): { spec: string; type: SliceType } {
    const path = join(this.dir, "slices", `${key}.md`);
    if (!existsSync(path)) die(`slice spec not found: ${path}`);
    const spec = readFileSync(path, "utf8");
    const m = spec.match(/\*\*Type:\*\*\s*(HITL|AFK)/i);
    return { spec, type: (m?.[1]?.toUpperCase() as SliceType) ?? "AFK" };
  }

  appendLearnings(entries: { key: string; learnings: string }[]): void {
    const fresh = entries.filter((e) => e.learnings?.trim());
    if (!fresh.length) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const block = fresh
      .map((e) => `\n## ${e.key} (${stamp})\n\n${e.learnings.trim()}\n`)
      .join("");
    const existing = existsSync(this.learningsFile)
      ? readFileSync(this.learningsFile, "utf8")
      : `# Learnings — ${this.slug}\n\nNotes left by slice agents for the agents that follow.\n`;
    writeFileSync(this.learningsFile, existing + block);
  }
}

export const WaveGraph = {
  unblocked(plan: PlanFile): string[] {
    return Object.entries(plan.slices)
      .filter(([, s]) => s.status === "pending")
      .filter(([, s]) => s.blocked_by.every((dep) => plan.slices[dep]?.status === "done"))
      .map(([key]) => key)
      .sort();
  },

  inRange(keys: string[], range: string | undefined): string[] {
    if (!range) return keys;
    const wanted = parseRange(range);
    return keys.filter((k) => {
      const n = Number(k.match(/^(\d+)/)?.[1]);
      return Number.isFinite(n) && wanted.has(n);
    });
  },
};

function parseRange(expr: string): Set<number> {
  const out = new Set<number>();
  for (const part of expr.split(",")) {
    const span = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!span) die(`bad range: ${part} (use slice numbers like 3-7, 2, or 3,5-6)`);
    const lo = +span[1];
    const hi = span[2] ? +span[2] : lo;
    for (let i = lo; i <= hi; i++) out.add(i);
  }
  return out;
}

export function runnableAfk(ps: PlanState, range: string | undefined, mode: Mode): RunnableSlice[] {
  const plan = ps.read();
  const afk = WaveGraph.inRange(WaveGraph.unblocked(plan), range)
    .map((key) => ({ key, ...ps.sliceSpec(key) }))
    .filter((s) => s.type === "AFK");
  const isolate = mode === "worktree" && afk.length > 1;
  return afk.map((s) => ({
    key: s.key,
    type: s.type,
    spec: s.spec,
    isolation: isolate ? "worktree" : "inline",
  }));
}

export function pendingHitl(ps: PlanState, range?: string): string[] {
  const plan = ps.read();
  return WaveGraph.inRange(WaveGraph.unblocked(plan), range)
    .filter((key) => ps.sliceSpec(key).type === "HITL");
}
