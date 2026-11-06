import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { main } from "../src/cli.ts";
import * as B from "./mock-bodies.ts";
import { testContext } from "./helpers.ts";

// 3f: fingerprint and attest against a local mock server (node:http). No live call in the test suite.
const KEY = "mock-api-key-for-the-local-test-server";
let server: Server;
let base = "";
let seen: { method: string; path: string; auth: string | undefined; body: string }[] = [];
let state = { posted: false, runPolls: 0, tamper: false };

function send(res: import("node:http").ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  let s = "";
  for await (const c of req) s += c;
  return s;
}

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const body = await readBody(req);
    const url = new URL(req.url ?? "/", "http://mock");
    seen.push({ method: req.method ?? "", path: url.pathname + url.search, auth: req.headers.authorization, body });
    if (url.pathname === `/api/reports/${B.REPORT_ID}/summary`) {
      const bytes = state.tamper ? Buffer.from(B.KIT1_SUMMARY.toString("utf8").replace('"pass":', '"pass":1')) : B.KIT1_SUMMARY;
      return send(res, 200, bytes);
    }
    if (req.headers.authorization !== `Bearer ${KEY}`) return send(res, 401, B.unauthorized);
    const fp = url.pathname.match(/^\/api\/v1\/projects\/([^/]+)\/fingerprint$/);
    if (fp) {
      if (fp[1] !== B.PROJECT) return send(res, 404, B.notFound);
      if (req.method === "POST") {
        state.posted = true;
        return send(res, 202, B.fingerprintQueued);
      }
      return send(res, 200, state.posted && process.env.MOCK_FP_STUCK !== "1" ? B.fingerprintNewer : B.fingerprintComplete);
    }
    if (url.pathname === "/api/v1/runs" && req.method === "POST") {
      const b = JSON.parse(body) as { project_id: string };
      if (b.project_id === B.FREE_PROJECT) return send(res, 402, B.proofNotIncluded);
      if (b.project_id !== B.PROJECT) return send(res, 404, B.notFound);
      return send(res, 202, B.runQueued);
    }
    if (url.pathname === `/api/v1/runs/${B.runQueued.run_id}`) {
      state.runPolls++;
      return send(res, 200, state.runPolls < 2 ? B.runRunning : B.runComplete);
    }
    if (url.pathname === "/api/v1/attestations") {
      if (url.searchParams.get("project") !== B.PROJECT) return send(res, 404, B.notFound);
      return send(res, 200, B.attestation(base));
    }
    return send(res, 404, B.notFound);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => {
  seen = [];
  state = { posted: false, runPolls: 0, tamper: false };
  delete process.env.MOCK_FP_STUCK;
});

const ctxWith = (env: Record<string, string> = { ROWATTEST_API_KEY: KEY }) => testContext({ apiBase: base, env });

describe("fingerprint", () => {
  test("reads the newest fit check", async () => {
    const ctx = ctxWith();
    expect(await main(["fingerprint", B.PROJECT], ctx)).toBe(0);
    expect(ctx.stdout).toEqual(["status complete", `schema_fingerprint ${B.fingerprintComplete.schema_fingerprint}`, `checked_at ${B.fingerprintComplete.checked_at}`]);
    expect(seen.map((s) => `${s.method} ${s.path}`)).toEqual([`GET /api/v1/projects/${B.PROJECT}/fingerprint`]);
    expect(seen[0]?.auth).toBe(`Bearer ${KEY}`);
  });

  test("--start queues a check and waits for a newer one", async () => {
    const ctx = ctxWith();
    expect(await main(["fingerprint", B.PROJECT, "--start", "--json"], ctx)).toBe(0);
    expect(JSON.parse(ctx.stdout[0] as string)).toEqual({ ...B.fingerprintNewer, queued: B.fingerprintQueued });
    expect(seen.map((s) => s.method)).toEqual(["GET", "POST", "GET"]);
  });

  test("--start with no newer check before --wait runs out exits 4", async () => {
    process.env.MOCK_FP_STUCK = "1";
    const ctx = ctxWith();
    expect(await main(["fingerprint", B.PROJECT, "--start", "--wait", "12"], ctx)).toBe(4);
    expect(ctx.stderr.at(-1)).toBe("no new fingerprint within 12 s");
  });

  test("401 prints the API's message and exits 1", async () => {
    const ctx = ctxWith({ ROWATTEST_API_KEY: "mock-wrong-key" });
    expect(await main(["fingerprint", B.PROJECT], ctx)).toBe(1);
    expect(ctx.stderr[0]).toBe(`GET /api/v1/projects/${B.PROJECT}/fingerprint: HTTP 401 unauthorized: ${B.unauthorized.error.message}`);
  });

  test("404 prints the API's message and exits 1", async () => {
    const ctx = ctxWith();
    expect(await main(["fingerprint", B.FREE_PROJECT], ctx)).toBe(1);
    expect(ctx.stderr[0]).toMatch(/HTTP 404 not_found: No project or run with that id was found for this key\.$/);
  });

  test("no ROWATTEST_API_KEY exits 2 and calls nothing", async () => {
    const ctx = ctxWith({});
    expect(await main(["fingerprint", B.PROJECT], ctx)).toBe(2);
    expect(seen).toEqual([]);
  });
});

describe("attest", () => {
  test("starts a labelled run with attest, waits, verifies the summary and prints the pointer document", async () => {
    const ctx = ctxWith();
    expect(await main(["attest", "--project", B.PROJECT, "--label", B.LABEL], ctx)).toBe(0);
    const pointer = JSON.parse(ctx.stdout.join("\n"));
    expect(pointer).toEqual({
      rowattest: "1",
      attestations: [{ summary_url: `${base}/api/reports/${B.REPORT_ID}/summary`, summary_sha256: createHash("sha256").update(B.KIT1_SUMMARY).digest("hex") }],
      keys_url: "https://rowattest.com/keys.json",
    });
    const post = seen.find((s) => s.method === "POST");
    expect(JSON.parse(post?.body ?? "{}")).toEqual({ project_id: B.PROJECT, label: B.LABEL, attest: true });
    expect(seen.filter((s) => s.path.startsWith("/api/v1/")).every((s) => s.auth === `Bearer ${KEY}`)).toBe(true);
    expect(seen.find((s) => s.path.startsWith("/api/reports/"))?.auth).toBeUndefined();
  });

  test("a plan without signed proofs: the API's 402 message, exit 1", async () => {
    const ctx = ctxWith();
    expect(await main(["attest", "--project", B.FREE_PROJECT, "--label", "ci:1"], ctx)).toBe(1);
    expect(ctx.stderr.at(-1)).toBe(`POST /api/v1/runs: HTTP 402 proof_not_included: ${B.proofNotIncluded.error.message}`);
  });

  test("a summary that does not verify exits 1 and prints no pointer", async () => {
    state.tamper = true;
    const ctx = ctxWith();
    expect(await main(["attest", "--project", B.PROJECT, "--label", B.LABEL], ctx)).toBe(1);
    expect(ctx.stdout).toEqual([]);
    expect(ctx.stderr.at(-1)).toBe("the signed summary does not verify");
  });

  test("--label is needed (the attestations lookup is by project and label): exit 2", async () => {
    expect(await main(["attest", "--project", B.PROJECT], ctxWith())).toBe(2);
    expect(seen).toEqual([]);
  });
});
