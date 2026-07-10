import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { type Status, type SliceType, type Mode, type PlanFile, type RunnableSlice, type Problem, die } from "./lib.ts";

export function parseSliceType(spec: string): SliceType | null {
  const t = spec.match(/\*\*Type:\*\*\s*(\w+)/i)?.[1]?.toUpperCase();
  return t === "AFK" || t === "HITL" ? t : null;
}

function writeFileAtomic(file: string, contents: string): void {
  const tmp = join(dirname(file), `.${basename(file)}.wave-tmp`);
  writeFileSync(tmp, contents);
  renameSync(tmp, file);
}

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
    writeFileAtomic(this.stateFile, JSON.stringify(plan, null, 2) + "\n");
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
    return { spec, type: parseSliceType(spec) ?? "AFK" };
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
    writeFileAtomic(this.learningsFile, existing + block);
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

  validate(plan: PlanFile, sliceKeys: string[], sliceTypes: Record<string, SliceType | null>): Problem[] {
    const problems: Problem[] = [];
    const slices = plan.slices ?? {};
    const keySet = new Set(Object.keys(slices));
    const fileSet = new Set(sliceKeys);

    for (const [key, s] of Object.entries(slices)) {
      if (s?.status !== "pending" && s?.status !== "review" && s?.status !== "done") {
        problems.push({ severity: "error", slice: key, message: `invalid status "${s?.status}" (must be pending | review | done)` });
      }

      const deps = s?.blocked_by;
      if (!Array.isArray(deps) || !deps.every((d) => typeof d === "string")) {
        problems.push({ severity: "error", slice: key, message: `blocked_by must be an array of strings` });
      } else {
        for (const dep of deps) {
          if (!keySet.has(dep)) {
            problems.push({ severity: "error", slice: key, message: `blocked_by references unknown slice "${dep}"` });
          }
        }
      }

      if (!fileSet.has(key)) {
        problems.push({ severity: "error", slice: key, message: `no matching slice file slices/${key}.md` });
      }
    }

    for (const cycle of findCycles(slices, keySet)) {
      problems.push({ severity: "error", slice: cycle[0], message: `dependency cycle: ${cycle.join(" -> ")}` });
    }

    for (const key of sliceKeys) {
      if (keySet.has(key) && sliceTypes[key] == null) {
        problems.push({ severity: "error", slice: key, message: `missing or unparseable **Type:** line (must be HITL or AFK)` });
      }

      if (!keySet.has(key)) {
        problems.push({ severity: "warn", slice: key, message: `slice file has no entry in state.json (never runs)` });
      }
    }

    return problems;
  },

  inRange(keys: string[], range: string | undefined): string[] {
    if (!range) return keys;
    const wanted = parseRange(range);
    return keys.filter((k) => {
      const n = Number(k.match(/^(\d+)/)?.[1]);
      return Number.isFinite(n) && wanted.has(n);
    });
  },

  criticalDepth(plan: PlanFile, range: string | undefined, excludeDone = false): number {
    const slices = plan.slices ?? {};
    const inScope = new Set(
      WaveGraph.inRange(Object.keys(slices), range).filter(
        (k) => !excludeDone || slices[k]?.status !== "done",
      ),
    );

    const memo = new Map<string, number>();
    const depth = (k: string): number => {
      const cached = memo.get(k);
      if (cached !== undefined) return cached;
      const deps = (slices[k]?.blocked_by ?? []).filter((d) => inScope.has(d));
      const d = deps.length ? 1 + Math.max(...deps.map(depth)) : 1;
      memo.set(k, d);
      return d;
    };

    let max = 0;
    for (const k of inScope) max = Math.max(max, depth(k));
    return max;
  },
};

function findCycles(slices: PlanFile["slices"], keySet: Set<string>): string[][] {
  const cycles: string[][] = [];
  const seen = new Set<string>();
  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];

  const dep = (k: string): string[] => {
    const d = slices[k]?.blocked_by;
    return Array.isArray(d) ? d.filter((x) => typeof x === "string" && keySet.has(x)) : [];
  };

  const visit = (k: string): void => {
    state.set(k, 1);
    stack.push(k);
    for (const next of dep(k)) {
      if (state.get(next) === 1) {
        const at = stack.indexOf(next);
        const cycle = stack.slice(at);
        const sig = [...cycle].sort().join(" ");
        if (!seen.has(sig)) {
          seen.add(sig);
          cycles.push([...cycle, next]);
        }
      } else if (!state.get(next)) {
        visit(next);
      }
    }
    stack.pop();
    state.set(k, 2);
  };

  for (const k of Object.keys(slices).sort()) if (!state.get(k)) visit(k);
  return cycles;
}

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
