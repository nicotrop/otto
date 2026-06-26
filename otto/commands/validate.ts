import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { WaveGraph, parseSliceType } from "../utils/state.ts";
import { ok, type PlanFile, type Problem, type SliceType } from "../utils/lib.ts";

export function collectProblems(slug: string): Problem[] {
  const dir = join(".plans", slug);
  const stateFile = join(dir, "state.json");

  if (!existsSync(stateFile)) {
    return [{ severity: "error", message: `no state.json in ${dir}` }];
  }
  let plan: PlanFile;
  try {
    plan = JSON.parse(readFileSync(stateFile, "utf8")) as PlanFile;
  } catch (e) {
    return [{ severity: "error", message: `state.json is not valid JSON: ${(e as Error).message}` }];
  }

  const slicesDir = join(dir, "slices");
  const sliceKeys: string[] = [];
  const sliceTypes: Record<string, SliceType | null> = {};

  if (existsSync(slicesDir)) {
    for (const name of readdirSync(slicesDir)) {
      if (!name.endsWith(".md")) continue;
      const key = name.slice(0, -3);
      sliceKeys.push(key);
      sliceTypes[key] = parseSliceType(readFileSync(join(slicesDir, name), "utf8"));
    }
  }

  return WaveGraph.validate(plan, sliceKeys, sliceTypes);
}

export function reportProblems(problems: Problem[]): boolean {
  let hasError = false;
  for (const p of problems) {
    if (p.severity === "error") hasError = true;
    const where = p.slice ? `${p.slice}: ` : "";
    console.error(`${p.severity}: ${where}${p.message}`);
  }
  return hasError;
}

export function runValidate(slug: string): number {
  return reportProblems(collectProblems(slug)) ? 1 : 0;
}

export function cmdValidate(slug: string): void {
  const code = runValidate(slug);
  if (code === 0) ok(`validated ${slug}`);
  process.exit(code);
}
