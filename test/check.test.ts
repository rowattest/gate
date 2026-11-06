import { describe, expect, test } from "vitest";
import { runCheck } from "../src/commands/check.ts";
import { main } from "../src/cli.ts";
import { testContext, vector, vectorText } from "./helpers.ts";

// 3a and 3b: every vector under test/vectors with its expected exit code and failed_check (VECTORS.md says where each came from).
const VECTORS: { file: string; exit: number; failed_check: string | null }[] = [
  { file: "kit1-summary.json", exit: 0, failed_check: null },
  { file: "kit1-tampered-total.json", exit: 1, failed_check: "signature" },
  { file: "kit1-wrong-key.json", exit: 1, failed_check: "key-mismatch" },
  { file: "kit1-bad-sha.json", exit: 1, failed_check: "report-sha256" },
  { file: "kit1-bad-url.json", exit: 1, failed_check: "verify-url" },
  { file: "kit1-no-signature.json", exit: 1, failed_check: "no-signature" },
  { file: "kit1-not-json.txt", exit: 1, failed_check: "no-signature" },
  { file: "kit1-reordered.json", exit: 0, failed_check: null },
];

describe("check: the vectors", () => {
  for (const v of VECTORS) {
    test(`${v.file}: exit ${v.exit}, failed_check ${v.failed_check}`, async () => {
      const ctx = testContext();
      const code = await runCheck([vector(v.file), "--json"], ctx);
      expect(code).toBe(v.exit);
      const r = JSON.parse(ctx.stdout[0] as string);
      expect(r.valid).toBe(v.exit === 0);
      expect(r.failed_check).toBe(v.failed_check);
    });
  }

  test("kit1-summary.json: valid, key 27499e4b, schema_version 1.3, the report id and verify url bound", async () => {
    const ctx = testContext();
    expect(await runCheck([vector("kit1-summary.json")], ctx)).toBe(0);
    expect(ctx.stdout[0]).toBe("VALID");
    expect(ctx.stdout).toContain("key_id 27499e4b");
    expect(ctx.stdout).toContain("schema rowattest.signed-summary");
    expect(ctx.stdout).toContain("schema_version 1.3");
    expect(ctx.stdout).toContain("report_id RA-01M55DE8NXN0282HMA9QKMT9JY");
    expect(ctx.stdout).toContain("verify_url https://rowattest.com/verify/RA-01M55DE8NXN0282HMA9QKMT9JY");
    expect(ctx.stdout.filter((l) => l.startsWith("totals.")).length).toBe(12);
  });

  test("the tampered total: INVALID, failed_check signature", async () => {
    const ctx = testContext();
    expect(await runCheck([vector("kit1-tampered-total.json")], ctx)).toBe(1);
    expect(ctx.stdout[0]).toBe("INVALID");
    expect(ctx.stdout).toContain("failed_check signature");
  });

  test("standard input: check - reads the document from stdin", async () => {
    const ctx = testContext({ readStdin: async () => vectorText("kit1-summary.json") });
    expect(await runCheck(["-"], ctx)).toBe(0);
    expect(ctx.stdout[0]).toBe("VALID");
  });

  test("an unreadable file exits 2", async () => {
    const ctx = testContext();
    expect(await main(["check", vector("no-such-file.json")], ctx)).toBe(2);
    expect(ctx.stderr[0]).toMatch(/^cannot read /);
  });

  test("usage: no file exits 2, an unknown flag exits 2, an unknown command exits 2", async () => {
    expect(await main(["check"], testContext())).toBe(2);
    expect(await main(["check", vector("kit1-summary.json"), "--nope"], testContext())).toBe(2);
    expect(await main(["nope"], testContext())).toBe(2);
  });
});
