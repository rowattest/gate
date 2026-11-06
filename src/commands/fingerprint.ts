import { apiCall, apiKey, asObject, refusal } from "../lib/api.ts";
import { parseArgs, projectId, secondsFlag } from "../lib/args.ts";
import type { Context } from "../lib/context.ts";
import { CliError } from "../lib/errors.ts";

// fingerprint <project-id> [--start] [--wait <seconds, default 120>] [--json]
// GET /api/v1/projects/{id}/fingerprint answers the newest fit check: {status, schema_fingerprint, checked_at}.
// With --start: read the newest check, POST to queue one ({status, fit_check_id}), then GET until a check newer than the
// one read first carries a fingerprint (the GET names no fit_check_id, so a newer checked_at is how the new check is told
// apart). Exit codes: 0 a fingerprint; 1 an API refusal, a failed check or a network failure; 2 usage; 4 --wait ran out.
const POLL_MS = 5000;

function fields(body: unknown): { status: unknown; schema_fingerprint: unknown; checked_at: unknown } {
  const b = asObject(body);
  return { status: b.status ?? null, schema_fingerprint: b.schema_fingerprint ?? null, checked_at: b.checked_at ?? null };
}

function print(ctx: Context, json: boolean, f: ReturnType<typeof fields>, queued?: { status: unknown; fit_check_id: unknown }): void {
  if (json) {
    ctx.out(JSON.stringify(queued ? { ...f, queued } : f));
    return;
  }
  if (queued) ctx.out(`queued: status ${String(queued.status)}, fit_check_id ${String(queued.fit_check_id ?? "-")}`);
  ctx.out(`status ${String(f.status ?? "-")}`);
  ctx.out(`schema_fingerprint ${String(f.schema_fingerprint ?? "-")}`);
  ctx.out(`checked_at ${String(f.checked_at ?? "-")}`);
}

export async function runFingerprint(argv: readonly string[], ctx: Context): Promise<number> {
  const p = parseArgs(argv, { start: "bool", wait: "value", json: "bool" });
  if (p.positionals.length > 1) throw new CliError(2, "fingerprint takes one project id");
  const project = projectId(p.positionals[0], "fingerprint");
  const waitSeconds = secondsFlag(p, "wait", 120);
  const key = apiKey(ctx, "fingerprint");
  const path = `/api/v1/projects/${project}/fingerprint`;
  const json = p.bools.has("json");

  const first = await apiCall(ctx, key, "GET", path);
  if (first.status !== 200) throw refusal(`GET ${path}`, first);
  if (!p.bools.has("start")) {
    print(ctx, json, fields(first.body));
    return 0;
  }

  const before = fields(first.body).checked_at;
  const post = await apiCall(ctx, key, "POST", path);
  if (post.status !== 202) throw refusal(`POST ${path}`, post);
  const q = asObject(post.body);
  const queued = { status: q.status ?? null, fit_check_id: q.fit_check_id ?? null };
  if (!json) ctx.err(`waiting up to ${waitSeconds} s for a new fit check`);

  const deadline = ctx.now() + waitSeconds * 1000;
  for (;;) {
    const left = deadline - ctx.now();
    if (left <= 0) throw new CliError(4, `no new fingerprint within ${waitSeconds} s`);
    await ctx.sleep(Math.min(POLL_MS, left));
    const r = await apiCall(ctx, key, "GET", path);
    if (r.status !== 200) throw refusal(`GET ${path}`, r);
    const f = fields(r.body);
    const isNew = f.checked_at !== null && f.checked_at !== before;
    if (isNew && f.status === "failed") {
      print(ctx, json, f, queued);
      throw new CliError(1, "the fit check failed");
    }
    if (isNew && f.status === "complete" && typeof f.schema_fingerprint === "string") {
      print(ctx, json, f, queued);
      return 0;
    }
  }
}
