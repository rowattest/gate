import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

// 3e: the vendor copies are byte for byte the hashes UPSTREAM.md records; an edit to a copy fails here.
const root = new URL("../", import.meta.url);
const upstream = readFileSync(new URL("src/vendor/UPSTREAM.md", root), "utf8");
const rows = [...upstream.matchAll(/^\| (src\/vendor\/[a-z]+\.ts) \| [^|]+ \| ([0-9a-f]{64}) \|$/gm)].map((m) => ({ file: m[1] as string, sha256: m[2] as string }));

test("UPSTREAM.md names the three vendor files", () => {
  expect(rows.map((r) => r.file).sort()).toEqual(["src/vendor/jcs.ts", "src/vendor/keys.ts", "src/vendor/verify.ts"]);
});

for (const r of rows) {
  test(`${r.file} matches its pinned sha256`, () => {
    expect(createHash("sha256").update(readFileSync(new URL(r.file, root))).digest("hex")).toBe(r.sha256);
  });
}
