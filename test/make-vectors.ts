// Derives the test vectors from test/vectors/kit1-summary.json (the bytes of
// https://app.rowattest.com/api/reports/RA-01M55DE8NXN0282HMA9QKMT9JY/summary). The output files are committed;
// this script is how they were made. kit1-wrong-key.json and keys-unrelated.json use a freshly generated key, so
// running the script again produces different bytes for those two files (the expected results stay the same).
// Run: node test/make-vectors.ts (Node 22.18 or newer runs TypeScript directly).
import { createHash, generateKeyPairSync } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const dir = new URL("./vectors/", import.meta.url);
const text = readFileSync(new URL("kit1-summary.json", dir), "utf8");
const fresh = (): Record<string, any> => JSON.parse(text);
const write = (name: string, value: unknown): void => writeFileSync(new URL(name, dir), typeof value === "string" ? value : JSON.stringify(value));
const freshRawPublicKey = (): Buffer => {
  const jwk = generateKeyPairSync("ed25519").publicKey.export({ format: "jwk" }) as { x: string };
  return Buffer.from(jwk.x, "base64url");
};
const flipLastHex = (s: string): string => s.slice(0, -1) + (s.endsWith("0") ? "1" : "0");

// totals.pass plus one: the signed content changes, so the signature fails.
const tampered = fresh();
tampered.totals.pass = tampered.totals.pass + 1;
write("kit1-tampered-total.json", tampered);

// the block's public key replaced by a fresh Ed25519 key that no key list trusts.
const wrongKey = fresh();
wrongKey.signature.public_key = freshRawPublicKey().toString("base64");
write("kit1-wrong-key.json", wrongKey);

// report_sha256 with its last hex digit changed (the signature still verifies; the hash binding does not).
const badSha = fresh();
badSha.signature.report_sha256 = flipLastHex(badSha.signature.report_sha256);
write("kit1-bad-sha.json", badSha);

// verify_url naming another report id (last character of the id changed).
const badUrl = fresh();
const url: string = badUrl.signature.verify_url;
badUrl.signature.verify_url = url.slice(0, -1) + (url.endsWith("Z") ? "Y" : "Z");
write("kit1-bad-url.json", badUrl);

// the signature block removed.
const noSig = fresh();
delete noSig.signature;
write("kit1-no-signature.json", noSig);

// not JSON at all.
write("kit1-not-json.txt", "This file is not JSON. It stands for a report that was cut or mangled in transit.\n");

// the same object, members written in reverse order at every level, indented: verification is over the canonical form.
const reorder = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(reorder);
  if (v !== null && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).reverse().map(([k, x]) => [k, reorder(x)]));
  return v;
};
write("kit1-reordered.json", JSON.stringify(reorder(fresh()), null, 4) + "\n");

// key lists: the live key with a wrong key_id, and an unrelated key with a correct key_id.
const live = JSON.parse(readFileSync(new URL("keys-live.json", dir), "utf8")) as { keys: { key_id: string; public_key_b64: string }[] };
const liveKey = live.keys[0] as { key_id: string; public_key_b64: string };
write("keys-bad-id.json", JSON.stringify({ keys: [{ key_id: "00000000", public_key_b64: liveKey.public_key_b64 }] }, null, 2) + "\n");
const other = freshRawPublicKey();
write("keys-unrelated.json", JSON.stringify({ keys: [{ key_id: createHash("sha256").update(other).digest("hex").slice(0, 8), public_key_b64: other.toString("base64") }] }, null, 2) + "\n");

console.log("wrote 9 vectors to test/vectors/");
