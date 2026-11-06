import { readFileSync } from "node:fs";
import { verifySummary, type SummaryCheck } from "../vendor/verify.ts";
import { TRUSTED_KEYS, type TrustedKey } from "../vendor/keys.ts";
import { parseArgs } from "../lib/args.ts";
import { asObject } from "../lib/api.ts";
import type { Context } from "../lib/context.ts";
import { CliError } from "../lib/errors.ts";
import { loadKeyList } from "../lib/keys.ts";

// check <file or -> [--keys <file or https URL>] [--fail-on <list>] [--json]
// Exit codes: 0 valid; 1 invalid; 2 usage, unreadable input or a bad key list; 3 valid but a --fail-on totals key is above zero.
export const DEFAULT_FAIL_ON = ["leak", "disagreement", "error"];

export interface CheckResult {
  valid: boolean;
  key_id: string | null;
  failed_check: SummaryCheck | null;
  schema: string | null;
  schema_version: string | null;
  report_id: string | null;
  verify_url: string | null;
  totals: Record<string, unknown> | null;
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

// The vendor verifier decides valid or not; the other fields are read from the document for display.
export function checkText(text: string, keys: readonly TrustedKey[]): CheckResult {
  const v = verifySummary(text, keys);
  let doc: unknown = null;
  try {
    doc = JSON.parse(text);
  } catch {
    doc = null;
  }
  const obj = asObject(doc);
  const sig = asObject(obj.signature);
  const totals = obj.totals !== null && typeof obj.totals === "object" && !Array.isArray(obj.totals) ? (obj.totals as Record<string, unknown>) : null;
  return {
    valid: v.valid,
    key_id: v.key_id,
    failed_check: v.failed_check,
    schema: str(obj.schema),
    schema_version: str(obj.schema_version),
    report_id: str(obj.report_id),
    verify_url: str(sig.verify_url),
    totals,
  };
}

export function humanLines(r: CheckResult): string[] {
  const lines = [r.valid ? "VALID" : "INVALID", `key_id ${r.key_id ?? "-"}`];
  if (!r.valid) lines.push(`failed_check ${r.failed_check ?? "-"}`);
  lines.push(`schema ${r.schema ?? "-"}`, `schema_version ${r.schema_version ?? "-"}`, `report_id ${r.report_id ?? "-"}`, `verify_url ${r.verify_url ?? "-"}`);
  if (r.totals) for (const [k, v] of Object.entries(r.totals)) lines.push(`totals.${k} ${JSON.stringify(v)}`);
  return lines;
}

// A totals value counts as above zero when it is a number above zero or the boolean true.
function aboveZero(v: unknown): boolean {
  return (typeof v === "number" && v > 0) || v === true;
}

export async function runCheck(argv: readonly string[], ctx: Context): Promise<number> {
  const p = parseArgs(argv, { keys: "value", "fail-on": "optional", json: "bool" });
  if (p.positionals.length !== 1) throw new CliError(2, "check needs one file, or - for standard input");
  const source = p.positionals[0] as string;
  let text: string;
  if (source === "-") {
    text = await ctx.readStdin();
  } else {
    try {
      text = readFileSync(source, "utf8");
    } catch (e) {
      throw new CliError(2, `cannot read ${source}: ${(e as Error).message}`, { cause: e });
    }
  }
  const keys = p.values.keys !== undefined ? await loadKeyList(p.values.keys, ctx.fetch) : TRUSTED_KEYS;
  const failOn = p.values["fail-on"] !== undefined ? p.values["fail-on"].split(",").map((s) => s.trim()).filter((s) => s !== "") : p.bools.has("fail-on") ? DEFAULT_FAIL_ON : null;
  if (failOn !== null && failOn.length === 0) throw new CliError(2, "--fail-on needs at least one totals key");

  const r = checkText(text, keys);
  let gate: { keys: string[]; above: string[] } | null = null;
  let code = r.valid ? 0 : 1;
  let missing: string | null = null;
  if (r.valid && failOn !== null) {
    for (const name of failOn) {
      if (!r.totals || !Object.prototype.hasOwnProperty.call(r.totals, name)) {
        missing = name;
        break;
      }
    }
    if (missing === null) {
      const above = failOn.filter((name) => aboveZero((r.totals as Record<string, unknown>)[name]));
      gate = { keys: failOn, above };
      if (above.length > 0) code = 3;
    }
  }

  if (p.bools.has("json")) {
    ctx.out(JSON.stringify({ ...r, gate, ...(missing !== null ? { error: `totals has no key ${missing}` } : {}) }));
  } else {
    for (const line of humanLines(r)) ctx.out(line);
    if (gate) ctx.out(gate.above.length === 0 ? `gate pass: ${gate.keys.join(", ")} all zero` : `gate fail: ${gate.above.map((k) => `${k} ${JSON.stringify((r.totals as Record<string, unknown>)[k])}`).join(", ")}`);
  }
  if (missing !== null) throw new CliError(2, `totals has no key ${missing}`);
  return code;
}
