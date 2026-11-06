import { describe, expect, test } from "vitest";
import { main } from "../src/cli.ts";
import { testContext, vector, vectorText } from "./helpers.ts";

// 3c: the gate on totals. The expectation is set from the kit 1 summary's own values, read first.
const totals = JSON.parse(vectorText("kit1-summary.json")).totals as Record<string, number | boolean>;
const anyAbove = ["leak", "disagreement", "error"].some((k) => (totals[k] as number) > 0);

describe("check --fail-on", () => {
  test(`--fail-on leak,disagreement,error exits ${anyAbove ? 3 : 0} (leak ${totals.leak}, disagreement ${totals.disagreement}, error ${totals.error})`, async () => {
    const ctx = testContext();
    expect(await main(["check", vector("kit1-summary.json"), "--fail-on", "leak,disagreement,error"], ctx)).toBe(anyAbove ? 3 : 0);
  });

  test("--fail-on with no value uses the default list leak,disagreement,error", async () => {
    const ctx = testContext();
    expect(await main(["check", vector("kit1-summary.json"), "--fail-on", "--json"], ctx)).toBe(anyAbove ? 3 : 0);
    expect(JSON.parse(ctx.stdout[0] as string).gate.keys).toEqual(["leak", "disagreement", "error"]);
  });

  test("a valid document whose named total is above zero exits 3 (pass is above zero in the kit 1 summary)", async () => {
    expect(totals.pass as number).toBeGreaterThan(0);
    const ctx = testContext();
    expect(await main(["check", vector("kit1-summary.json"), "--fail-on", "pass"], ctx)).toBe(3);
    expect(ctx.stdout.at(-1)).toBe(`gate fail: pass ${totals.pass}`);
  });

  test("--fail-on nonexistent_key exits 2 with totals has no key nonexistent_key", async () => {
    const ctx = testContext();
    expect(await main(["check", vector("kit1-summary.json"), "--fail-on", "nonexistent_key"], ctx)).toBe(2);
    expect(ctx.stderr).toContain("totals has no key nonexistent_key");
  });

  test("an invalid document exits 1 whatever --fail-on says", async () => {
    expect(await main(["check", vector("kit1-tampered-total.json"), "--fail-on"], testContext())).toBe(1);
  });
});
