import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { KEYS_URL, TRUSTED_KEYS } from "../vendor/keys.ts";
import { apiCall, apiKey, asObject, refusal } from "../lib/api.ts";
import { parseArgs, projectId, secondsFlag } from "../lib/args.ts";
import type { Context } from "../lib/context.ts";
import { CliError } from "../lib/errors.ts";
import { checkText, humanLines } from "./check.ts";

// attest --project <project-id> --label <text> [--wait <seconds, default 600>] [--out <path>] [--json]
// 1. POST /api/v1/runs {project_id, label, attest: true} (the body fields the OpenAPI document names).
// 2. GET /api/v1/runs/{id} until the status is complete or failed, and a complete run carries its report_id.
// 3. GET /api/v1/attestations?project=&label= (both query parameters are required by the API, so attest needs --label).
// 4. Fetch the summary at the summary_url the API gives, only from the API's own origin, verify it as check does, and
//    print the pointer document readWellKnown accepts: {"rowattest":"1","attestations":[{"summary_url","summary_sha256"}],"keys_url"}.
// Exit codes: 0 verified and printed; 1 an API refusal (402 on a plan without signed proofs), a failed run, a summary that
// does not verify, or a network failure; 2 usage; 4 --wait ran out.
const LABEL = /^[\x20-\x7E]{1,128}$/;

export async function runAttest(argv: readonly string[], ctx: Context): Promise<number> {
  const p = parseArgs(argv, { project: "value", label: "value", wait: "value", out: "value", json: "bool" });
  if (p.positionals.length > 0) throw new CliError(2, `attest takes no positional argument: ${p.positionals[0]}`);
  const project = projectId(p.values.project, "attest --project");
  const label = p.values.label;
  if (label === undefined) throw new CliError(2, "attest needs --label: GET /api/v1/attestations finds the signed report by project and label");
  if (!LABEL.test(label)) throw new CliError(2, "--label must be 1 to 128 printable ASCII characters");
  const waitSeconds = secondsFlag(p, "wait", 600);
  const key = apiKey(ctx, "attest");
  const json = p.bools.has("json");
  const say = (line: string): void => {
    if (!json) ctx.err(line);
  };
  const deadline = ctx.now() + waitSeconds * 1000;

  const start = await apiCall(ctx, key, "POST", "/api/v1/runs", { project_id: project, label, attest: true });
  if (start.status !== 202) throw refusal("POST /api/v1/runs", start);
  const started = asObject(start.body);
  const runId = started.run_id;
  if (typeof runId !== "string") throw new CliError(1, "POST /api/v1/runs: the response carries no run_id");
  say(`run ${runId} ${String(started.status ?? "queued")}`);

  let run: Record<string, unknown> = {};
  for (;;) {
    const r = await apiCall(ctx, key, "GET", `/api/v1/runs/${runId}`);
    if (r.status !== 200) throw refusal(`GET /api/v1/runs/${runId}`, r);
    run = asObject(r.body);
    if (run.status === "failed") throw new CliError(1, `run ${runId} failed`);
    if (run.status === "complete" && typeof run.report_id === "string") break;
    const left = deadline - ctx.now();
    if (left <= 0) throw new CliError(4, `run ${runId} has no signed report within ${waitSeconds} s (status ${String(run.status)})`);
    const after = typeof run.poll_after_seconds === "number" && run.poll_after_seconds > 0 ? run.poll_after_seconds * 1000 : 5000;
    await ctx.sleep(Math.min(after, left));
  }
  say(`run ${runId} complete, report ${String(run.report_id)}`);

  const query = `/api/v1/attestations?project=${encodeURIComponent(project)}&label=${encodeURIComponent(label)}`;
  let att: Record<string, unknown> = {};
  for (;;) {
    const r = await apiCall(ctx, key, "GET", query);
    if (r.status === 200) {
      att = asObject(r.body);
      break;
    }
    const left = deadline - ctx.now();
    if (r.status !== 404 || left <= 0) throw refusal("GET /api/v1/attestations", r);
    await ctx.sleep(Math.min(5000, left));
  }

  const summaryUrl = typeof att.summary_url === "string" ? att.summary_url : null;
  if (!summaryUrl) throw new CliError(1, "GET /api/v1/attestations: the response carries no summary_url");
  let url: URL;
  try {
    url = new URL(summaryUrl);
  } catch {
    throw new CliError(1, `the summary_url is not a URL: ${summaryUrl}`);
  }
  const allowed = new URL(ctx.apiBase);
  if (url.origin !== allowed.origin || url.username !== "" || url.password !== "") throw new CliError(1, `the summary_url is not on ${allowed.origin}: ${summaryUrl}`);

  let bytes: Buffer;
  try {
    const res = await ctx.fetch(url.href, { headers: { accept: "application/json" }, redirect: "error" });
    if (!res.ok) throw new CliError(1, `GET ${url.pathname}: HTTP ${res.status}`);
    bytes = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    if (e instanceof CliError) throw e;
    throw new CliError(1, `GET ${url.pathname}: network error: ${(e as Error).message}`, { cause: e });
  }
  const result = checkText(bytes.toString("utf8"), TRUSTED_KEYS);
  if (!result.valid) {
    for (const line of humanLines(result)) ctx.err(line);
    throw new CliError(1, "the signed summary does not verify");
  }
  if (result.report_id !== run.report_id || (typeof att.report_id === "string" && att.report_id !== result.report_id)) {
    throw new CliError(1, `the summary's report_id ${String(result.report_id)} does not match the run's ${String(run.report_id)}`);
  }
  say(`VALID, key_id ${String(result.key_id)}, report ${String(result.report_id)}`);

  const pointer = {
    rowattest: "1",
    attestations: [{ summary_url: url.href, summary_sha256: createHash("sha256").update(bytes).digest("hex") }],
    keys_url: KEYS_URL,
  };
  const pointerText = JSON.stringify(pointer, null, 2) + "\n";
  if (p.values.out !== undefined) {
    try {
      writeFileSync(p.values.out, pointerText);
    } catch (e) {
      throw new CliError(2, `cannot write ${p.values.out}: ${(e as Error).message}`, { cause: e });
    }
    say(`wrote ${p.values.out}`);
  }
  if (json) ctx.out(JSON.stringify({ run_id: runId, report_id: result.report_id, verification: result, pointer }));
  else if (p.values.out === undefined) ctx.out(pointerText.trimEnd());
  return 0;
}
