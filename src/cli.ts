import { runAttest } from "./commands/attest.ts";
import { runCheck } from "./commands/check.ts";
import { runFingerprint } from "./commands/fingerprint.ts";
import { API_BASE, VERSION, type Context } from "./lib/context.ts";
import { CliError } from "./lib/errors.ts";

const USAGE = `rowattest-gate ${VERSION}: verify a RowAttest signed report offline, and gate CI on it.

usage:
  rowattest-gate check <file or -> [--keys <file or https URL>] [--fail-on [<list>]] [--json]
  rowattest-gate fingerprint <project-id> [--start] [--wait <seconds>] [--json]
  rowattest-gate attest --project <project-id> --label <text> [--wait <seconds>] [--out <path>] [--json]
  rowattest-gate --version | --help
  any command: --debug prints stack traces

exit codes: 0 ok; 1 invalid, refused or failed; 2 usage, unreadable input or a bad key list;
  3 check: valid, but a --fail-on totals key is above zero (default list leak,disagreement,error); 4 a --wait ran out
fingerprint and attest read ROWATTEST_API_KEY from the environment and call ${API_BASE} only.`;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

export async function main(argv: readonly string[], ctx: Context): Promise<number> {
  const debug = argv.includes("--debug");
  const args = argv.filter((a) => a !== "--debug");
  const [command, ...rest] = args;
  try {
    switch (command) {
      case "check":
        return await runCheck(rest, ctx);
      case "fingerprint":
        return await runFingerprint(rest, ctx);
      case "attest":
        return await runAttest(rest, ctx);
      case "--version":
        ctx.out(VERSION);
        return 0;
      case "--help":
      case "help":
        ctx.out(USAGE);
        return 0;
      case undefined:
        ctx.err(USAGE);
        return 2;
      default:
        ctx.err(`unknown command ${command}`);
        ctx.err(USAGE);
        return 2;
    }
  } catch (e) {
    if (e instanceof CliError) {
      ctx.err(e.message);
      if (debug && e.cause instanceof Error && e.cause.stack) ctx.err(e.cause.stack);
      return e.code;
    }
    const err = e as Error;
    ctx.err(`unexpected error: ${err?.message ?? String(e)}`);
    if (debug && err?.stack) ctx.err(err.stack);
    return 1;
  }
}

const context: Context = {
  out: (line) => process.stdout.write(line + "\n"),
  err: (line) => process.stderr.write(line + "\n"),
  env: process.env,
  fetch: globalThis.fetch,
  readStdin,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
  apiBase: API_BASE,
};

// Run only when this file is the program (the bundle, or node src/cli.ts), not when a test imports main.
const isMain = process.argv[1] !== undefined && /rowattest-gate(\.js)?$|cli\.ts$/.test(process.argv[1]);
if (isMain) {
  main(process.argv.slice(2), context).then((code) => {
    process.exitCode = code;
  });
}
