import { CliError } from "./errors.ts";

// A small argument parser: positionals, flags with a value, boolean flags, and flags whose value is optional
// (taken when the next argument does not start with "--").
export type FlagKind = "value" | "bool" | "optional";
export interface Parsed {
  positionals: string[];
  values: Record<string, string>;
  bools: Set<string>;
}

export function parseArgs(argv: readonly string[], spec: Record<string, FlagKind>): Parsed {
  const out: Parsed = { positionals: [], values: {}, bools: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a.startsWith("--") && a.length > 2) {
      const eq = a.indexOf("=");
      const name = eq === -1 ? a.slice(2) : a.slice(2, eq);
      const inline = eq === -1 ? undefined : a.slice(eq + 1);
      const kind = spec[name];
      if (!kind) throw new CliError(2, `unknown flag --${name}`);
      if (kind === "bool") {
        if (inline !== undefined) throw new CliError(2, `--${name} takes no value`);
        out.bools.add(name);
      } else if (inline !== undefined) {
        out.values[name] = inline;
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          out.values[name] = next;
          i++;
        } else if (kind === "optional") {
          out.bools.add(name);
        } else {
          throw new CliError(2, `--${name} needs a value`);
        }
      }
    } else {
      out.positionals.push(a);
    }
  }
  return out;
}

export function secondsFlag(p: Parsed, name: string, fallback: number): number {
  const raw = p.values[name];
  if (raw === undefined) return fallback;
  if (!/^[0-9]+$/.test(raw) || Number(raw) < 1) throw new CliError(2, `--${name} takes a whole number of seconds, 1 or more`);
  return Number(raw);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function projectId(raw: string | undefined, how: string): string {
  if (raw === undefined) throw new CliError(2, `${how} needs a project id`);
  if (!UUID.test(raw)) throw new CliError(2, `the project id is not a uuid: ${raw}`);
  return raw;
}
