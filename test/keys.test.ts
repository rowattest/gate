import { describe, expect, test } from "vitest";
import { main } from "../src/cli.ts";
import { testContext, vector } from "./helpers.ts";

// 3d: key lists passed with --keys.
describe("check --keys", () => {
  test("--keys keys-live.json (the published list) gives the same result as the built-in list", async () => {
    const a = testContext();
    const b = testContext();
    expect(await main(["check", vector("kit1-summary.json"), "--json"], a)).toBe(0);
    expect(await main(["check", vector("kit1-summary.json"), "--keys", vector("keys-live.json"), "--json"], b)).toBe(0);
    expect(b.stdout).toEqual(a.stdout);
  });

  test("a list whose key_id does not match its key exits 2", async () => {
    const ctx = testContext();
    expect(await main(["check", vector("kit1-summary.json"), "--keys", vector("keys-bad-id.json")], ctx)).toBe(2);
    expect(ctx.stderr[0]).toMatch(/key_id 00000000 is not the first 8 hex/);
  });

  test("a list with an unrelated 32-byte key gives key-mismatch (exit 1)", async () => {
    const ctx = testContext();
    expect(await main(["check", vector("kit1-summary.json"), "--keys", vector("keys-unrelated.json"), "--json"], ctx)).toBe(1);
    expect(JSON.parse(ctx.stdout[0] as string).failed_check).toBe("key-mismatch");
  });

  test("--keys takes a file or an https URL, nothing else", async () => {
    expect(await main(["check", vector("kit1-summary.json"), "--keys", "http://rowattest.com/keys.json"], testContext())).toBe(2);
  });
});
