#!/usr/bin/env -S node --experimental-strip-types --no-warnings
import { parseArgs, die } from "./utils/lib.ts";
import { cmdWave } from "./commands/wave.ts";
import { cmdLand } from "./commands/land.ts";
import { cmdSnapshot } from "./commands/snapshot.ts";
import { cmdStatus, cmdList } from "./commands/report.ts";
import { cmdReset, cmdDone } from "./commands/mark.ts";
import { cmdValidate } from "./commands/validate.ts";

const HELP = `otto — slice-based plan runner

usage: otto <command> [<slug>] [<slice>] [flags]

commands:
  snapshot <slug>          * capture a snapshot for the plan
  validate <slug>            validate the plan file
  wave <slug>              * run the next wave of runnable slices
  land <slug> <slice>      * land a completed slice
  status <slug>              show plan status
  list <slug>                list slices
  reset <slug> <slice>       reset a slice to pending
  done <slug> <slice>        mark a slice done
  help                       show this help

flags:
  -s, --slices <range>       slice range (e.g. 1-3,5)
  -m, --mode <mode>          worktree | inline (default: worktree)
  -b, --buffer <n>           extra waves past critical-path depth before halting (default: 2)
  -w, --wave <n>           * wave number (positive integer)
  -L, --learning <text>    * learning note to attach on land
  -h, --help                 show this help

* managed by the /otto run loop — not typically set by hand; see LOOP.md`;

function help() { process.stdout.write(HELP + "\n"); process.exit(0); }

const [cmd, ...argv] = process.argv.slice(2);
if (cmd === undefined || cmd === "help" || cmd === "-h" || cmd === "--help") help();
if (argv.includes("-h") || argv.includes("--help")) help();
const o = parseArgs(argv);
switch (cmd) {
  case "snapshot": cmdSnapshot(o.slug); break;
  case "validate": cmdValidate(o.slug); break;
  case "wave":     cmdWave(o.slug, o.range, o.mode, o.wave, o.buffer); break;
  case "land":     cmdLand(o.slug, o.slice, o.learning); break;
  case "status":   cmdStatus(o.slug); break;
  case "list":     cmdList(o.slug, o.range, o.mode); break;
  case "reset":    cmdReset(o.slug, o.slice); break;
  case "done":     cmdDone(o.slug, o.slice); break;
  default:
    die(`unknown command: ${cmd}\n` +
        `commands: snapshot validate wave land status list reset done help\n` +
        `run 'otto help' or 'otto -h' for usage`);
}
