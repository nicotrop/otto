#!/usr/bin/env -S node --experimental-strip-types --no-warnings
import { parseArgs, die } from "./utils/lib.ts";
import { cmdWave } from "./commands/wave.ts";
import { cmdLand } from "./commands/land.ts";
import { cmdSnapshot } from "./commands/snapshot.ts";
import { cmdStatus, cmdList } from "./commands/report.ts";
import { cmdReset, cmdDone } from "./commands/mark.ts";

const [cmd, ...argv] = process.argv.slice(2);
const o = parseArgs(argv);
switch (cmd) {
  case "snapshot": cmdSnapshot(o.slug); break;
  case "wave":     cmdWave(o.slug, o.range, o.mode); break;
  case "land":     cmdLand(o.slug, o.slice, o.learning); break;
  case "status":   cmdStatus(o.slug); break;
  case "list":     cmdList(o.slug, o.range, o.mode); break;
  case "reset":    cmdReset(o.slug, o.slice); break;
  case "done":     cmdDone(o.slug, o.slice); break;
  default:
    die(`unknown command: ${cmd ?? "(none)"}\n` +
        `commands: snapshot wave land status list reset done\n` +
        `flags: -s|--slices <range>   -m|--mode worktree|inline   -L|--learning <text>`);
}
