import type { Context } from "./context.ts";
import { VERSION } from "./context.ts";
import { CliError } from "./errors.ts";

// One call to the RowAttest API. The key goes only in the Authorization header the OpenAPI document names
// ("Authorization: Bearer rak_..."), only to ctx.apiBase, and redirects are refused so it cannot be forwarded elsewhere.
export interface ApiResponse {
  status: number;
  body: unknown;
  retryAfter: string | null;
}

export function apiKey(ctx: Context, command: string): string {
  const key = ctx.env.ROWATTEST_API_KEY;
  if (!key) throw new CliError(2, `${command} needs ROWATTEST_API_KEY in the environment (an API key from the API keys page in the app)`);
  return key;
}

export async function apiCall(ctx: Context, key: string, method: "GET" | "POST", path: string, body?: unknown): Promise<ApiResponse> {
  const what = `${method} ${path}`;
  const headers: Record<string, string> = { authorization: `Bearer ${key}`, accept: "application/json", "user-agent": `rowattest-gate/${VERSION}` };
  if (body !== undefined) headers["content-type"] = "application/json";
  let res: Response;
  try {
    res = await ctx.fetch(ctx.apiBase + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "error" });
  } catch (e) {
    throw new CliError(1, `${what}: network error: ${(e as Error).message}`, { cause: e });
  }
  const text = await res.text();
  let parsed: unknown = null;
  if (text !== "") {
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new CliError(1, `${what}: HTTP ${res.status}, the body is not JSON`, { cause: e });
    }
  }
  return { status: res.status, body: parsed, retryAfter: res.headers.get("retry-after") };
}

// The API's own words for a refusal: {"error": {"code", "message", "docs_url"}}.
export function refusal(what: string, r: ApiResponse): CliError {
  const e = r.body !== null && typeof r.body === "object" ? (r.body as { error?: { code?: unknown; message?: unknown } }).error : undefined;
  const code = typeof e?.code === "string" ? e.code : "error";
  const message = typeof e?.message === "string" ? e.message : "no message in the response";
  const retry = r.retryAfter ? ` (retry after ${r.retryAfter} s)` : "";
  return new CliError(1, `${what}: HTTP ${r.status} ${code}: ${message}${retry}`);
}

export function asObject(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
