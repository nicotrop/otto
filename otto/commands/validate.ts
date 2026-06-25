import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { WaveGraph } from "../utils/state.ts";
import { type PlanFile, type Problem, type SliceType } from "../utils/lib.ts";

// Same regex sliceSpec (state.ts:42) uses, so the validator sees exactly what
// the runtime sees — but here a missing/unparseable line is an ERROR, whereas
// sliceSpec silently defaults to AFK.
const TYPE_RE = /\*\*Type:\*\*\s*(HITL|AFK)/i;

// Load + validate a plan into a flat Problem[], owning check #1 itself.
// Pure-ish I/O collector: reads from disk but never exits/prints. This is the
// shared path slice 02 (the snapshot gate) must call so its gate and this
// command never drift. It must NOT go through PlanState (whose constructor and
// read() `die` on missing/invalid state) — check #1 has to be a Problem, not a
// fatal abort, so the validator can still collect and report every problem.
export function collectProblems(slug: string): Problem[] {
  const dir = join(".plans", slug);
  const stateFile = join(dir, "state.json");

  // #1 state.json must exist and parse as JSON.
  if (!existsSync(stateFile)) {
    return [{ severity: "error", message: `no state.json in ${dir}` }];
  }
  let plan: PlanFile;
  try {
    plan = JSON.parse(readFileSync(stateFile, "utf8")) as PlanFile;
  } catch (e) {
    return [{ severity: "error", message: `state.json is not valid JSON: ${(e as Error).message}` }];
  }

  // List slices/*.md basenames and read each file's Type line (for check #7).
  const slicesDir = join(dir, "slices");
  const sliceKeys: string[] = [];
  const sliceTypes: Record<string, SliceType | null> = {};
  if (existsSync(slicesDir)) {
    for (const name of readdirSync(slicesDir)) {
      if (!name.endsWith(".md")) continue;
      const key = name.slice(0, -3);
      sliceKeys.push(key);
      const m = readFileSync(join(slicesDir, name), "utf8").match(TYPE_RE);
      sliceTypes[key] = (m?.[1]?.toUpperCase() as SliceType) ?? null;
    }
  }

  return WaveGraph.validate(plan, sliceKeys, sliceTypes);
}

// Print every problem to stderr (error:/warn: <slice>: <message>) and return
// true if any problem is an error. No stdout. Shared with slice 02.
export function reportProblems(problems: Problem[]): boolean {
  let hasError = false;
  for (const p of problems) {
    if (p.severity === "error") hasError = true;
    const where = p.slice ? `${p.slice}: ` : "";
    console.error(`${p.severity}: ${where}${p.message}`);
  }
  return hasError;
}

// The full reusable path: load + validate + print + exit-decision.
// Returns the exit code (1 if any error, else 0) instead of exiting, so callers
// (like slice 02's snapshot gate) can decide what to do; cmdValidate exits on it.
export function runValidate(slug: string): number {
  return reportProblems(collectProblems(slug)) ? 1 : 0;
}

// Thin CLI shell: run the shared path and exit with its code.
export function cmdValidate(slug: string): void {
  process.exit(runValidate(slug));
}
