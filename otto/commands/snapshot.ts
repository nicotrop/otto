import { ok } from "../utils/lib.ts";
import { runValidate } from "./validate.ts";

export function cmdSnapshot(slug: string): void {
  const code = runValidate(slug);
  if (code !== 0) process.exit(code);
  ok(`validated ${slug}`);
}
