import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, cpSync, appendFileSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { die } from "./lib.ts";

export const git = {
  run(args: string[], cwd = process.cwd()): string {
    return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  },
  tryRun(args: string[], cwd = process.cwd()): string | null {
    try {
      return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    } catch {
      return null;
    }
  },
  headSha(): string {
    return this.run(["rev-parse", "HEAD"]);
  },
  currentBranch(): string {
    return this.run(["branch", "--show-current"]);
  },
  branchExists(branch: string): boolean {
    return this.tryRun(["rev-parse", "--verify", branch]) !== null;
  },
  worktreeExists(path: string): boolean {
    return existsSync(path);
  },
};

export function branchName(slug: string, slice: string): string {
  return `plan/${slug}/${slice}`;
}
export function worktreePath(slug: string, slice: string): string {
  return join(".plans", ".worktrees", slug, slice);
}

export function ensureWorktree(slug: string, slice: string, baseSha: string): void {
  const branch = branchName(slug, slice);
  const wt = worktreePath(slug, slice);
  if (!(git.worktreeExists(wt) && git.branchExists(branch))) {
    git.tryRun(["worktree", "add", wt, "-b", branch, baseSha]) ??
      git.tryRun(["worktree", "add", wt, branch]);
  }
  seedPlan(slug, wt);
}

function seedPlan(slug: string, wt: string): void {
  const src = planDir(slug);
  if (!existsSync(src)) die(`cannot seed worktree: ${src} not found`);
  cpSync(src, join(wt, src), { recursive: true });
  excludePlansInWorktree(wt);
}

function planDir(slug: string): string {
  return join(".plans", slug);
}

function excludePlansInWorktree(wt: string): void {
  const rel = git.run(["rev-parse", "--git-path", "info/exclude"], wt);
  const path = isAbsolute(rel) ? rel : join(wt, rel);
  const line = ".plans/";
  const cur = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (cur.split("\n").some((l) => l.trim() === line)) return;
  appendFileSync(path, (cur && !cur.endsWith("\n") ? "\n" : "") + line + "\n");
}

export function removeWorktree(slug: string, slice: string): void {
  git.tryRun(["worktree", "remove", worktreePath(slug, slice), "--force"]);
  git.tryRun(["branch", "-D", branchName(slug, slice)]);
}

export function commitSliceWork(slice: string): void {
  git.tryRun(["add", "-A", "--", ".", ":!.plans"]);
  const staged = git.tryRun(["diff", "--cached", "--name-only"]);
  if (!staged) return;
  git.tryRun(["commit", "-m", slice, "--no-verify"]);
}

