import { readFileSync } from "node:fs";
import type { Context } from "../src/lib/context.ts";

export const vector = (name: string): string => new URL(`./vectors/${name}`, import.meta.url).pathname;
export const vectorText = (name: string): string => readFileSync(vector(name), "utf8");

// A Context that records output, with a clock that moves only when the command sleeps.
export function testContext(over: Partial<Context> = {}): Context & { stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let clock = 1_000_000;
  return {
    stdout,
    stderr,
    out: (line) => stdout.push(line),
    err: (line) => stderr.push(line),
    env: {},
    fetch: globalThis.fetch,
    readStdin: async () => "",
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
    apiBase: "https://app.rowattest.com",
    ...over,
  };
}
