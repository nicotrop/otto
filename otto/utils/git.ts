import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

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

export const WORKTREE_DIR = ".worktrees";

export function branchName(slug: string, slice: string): string {
  return `plan/${slug}/${slice}`;
}
export function worktreePath(slice: string): string {
  return join(WORKTREE_DIR, slice);
}

export function ignoreWorktrees(): void {
  const gi = ".gitignore";
  const line = `${WORKTREE_DIR}/`;
  const cur = existsSync(gi) ? readFileSync(gi, "utf8") : "";
  if (cur.split("\n").some((l) => l.trim() === line)) return;
  writeFileSync(gi, cur + (cur && !cur.endsWith("\n") ? "\n" : "") + line + "\n");
}

export function ensureWorktree(slug: string, slice: string, baseSha: string): void {
  const branch = branchName(slug, slice);
  const wt = worktreePath(slice);
  if (git.worktreeExists(wt) && git.branchExists(branch)) return;
  git.tryRun(["worktree", "add", wt, "-b", branch, baseSha]) ??
    git.tryRun(["worktree", "add", wt, branch]);
}

export function removeWorktree(slug: string, slice: string): void {
  git.tryRun(["worktree", "remove", worktreePath(slice), "--force"]);
  git.tryRun(["branch", "-D", branchName(slug, slice)]);
}

export function commitPlanDir(planDir: string, message: string): void {
  git.tryRun(["add", planDir, ".gitignore"]);
  const staged = git.tryRun(["diff", "--cached", "--name-only", "--", planDir, ".gitignore"]);
  if (!staged) return;
  git.tryRun(["commit", "-m", message, "--no-verify"]);
}

export function commitSliceWork(slice: string): void {
  git.tryRun(["add", "-A"]);
  const staged = git.tryRun(["diff", "--cached", "--name-only"]);
  if (!staged) return;
  git.tryRun(["commit", "-m", slice, "--no-verify"]);
}

export function stripPlanEdits(branch: string, base: string): void {
  const diverged = git.tryRun(["diff", "--name-only", `${base}..${branch}`, "--", ".plans"]);
  if (!diverged) return;
  const tmp = join(mkdtempSync(join(tmpdir(), "otto-strip-")), "wt");
  git.tryRun(["worktree", "add", "--detach", tmp, branch]);
  git.tryRun(["checkout", base, "--", ".plans"], tmp);
  git.tryRun(["commit", "-m", "otto: drop agent .plans edits (bookkeeping is main-tree only)", "--no-verify"], tmp);
  git.tryRun(["branch", "-f", branch, "HEAD"], tmp);
  git.tryRun(["worktree", "remove", tmp, "--force"]);
}
