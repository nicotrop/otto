export type Status = "pending" | "review" | "done";
export type SliceType = "AFK" | "HITL";
export type Mode = "worktree" | "inline";

export interface SliceState {
  status: Status;
  blocked_by: string[];
}

export interface PlanFile {
  plan: string;
  created?: string;
  slices: Record<string, SliceState>;
  [k: string]: unknown;
}

export interface Problem {
  severity: "error" | "warn";
  slice?: string;
  message: string;
}

export interface RunnableSlice {
  key: string;
  type: SliceType;
  spec: string;
  isolation: "worktree" | "inline";
}

export interface Args {
  slug: string;
  slice: string;
  range?: string;
  mode: Mode;
  learning?: string;
  wave?: number;
  buffer: number;
}

export function parseArgs(args: string[]): Args {
  let range: string | undefined;
  let learning: string | undefined;
  let mode: Mode = "worktree";
  let wave: number | undefined;
  let buffer = 2;
  const pos: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--mode" || a === "-m") {
      const v = args[++i];
      if (v !== "worktree" && v !== "inline") die(`--mode must be worktree or inline, got: ${v}`);
      mode = v;
    } else if (a === "--slices" || a === "-s") {
      range = args[++i];
    } else if (a === "--learning" || a === "-L") {
      learning = args[++i];
    } else if (a === "--wave" || a === "-w") {
      const n = Number(args[++i]);
      if (!Number.isInteger(n) || n < 1) die(`--wave must be a positive integer, got: ${args[i]}`);
      wave = n;
    } else if (a === "--buffer" || a === "-b") {
      const n = Number(args[++i]);
      if (!Number.isInteger(n) || n < 0) die(`--buffer must be a non-negative integer, got: ${args[i]}`);
      buffer = n;
    } else {
      pos.push(a);
    }
  }
  return { slug: pos[0], slice: pos[1], range, mode, learning, wave, buffer };
}

export function info(m: string) { console.error(`▸ ${m}`); }
export function ok(m: string) { console.error(`✓ ${m}`); }
export function emit(obj: unknown) { process.stdout.write(JSON.stringify(obj, null, 2) + "\n"); }
export function die(m: string): never { console.error(`error: ${m}`); process.exit(1); }
