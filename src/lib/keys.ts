import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { TrustedKey } from "../vendor/keys.ts";
import { CliError } from "./errors.ts";

// A key list in the shape https://rowattest.com/keys.json has: {"keys": [{"key_id", "public_key_b64", ...}]}.
// Every key must be 32 bytes after base64 and its key_id must be the first 8 hex of the SHA-256 of those bytes.
// Anything else is not a key list (exit 2). The list comes from a file, or from an https URL; no other scheme.
export async function loadKeyList(source: string, fetchImpl: typeof fetch): Promise<TrustedKey[]> {
  let text: string;
  if (/^https:\/\//i.test(source)) {
    let res: Response;
    try {
      res = await fetchImpl(source, { headers: { accept: "application/json" }, redirect: "error" });
    } catch (e) {
      throw new CliError(2, `key list ${source}: network error: ${(e as Error).message}`, { cause: e });
    }
    if (!res.ok) throw new CliError(2, `key list ${source}: HTTP ${res.status}`);
    text = await res.text();
  } else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(source)) {
    throw new CliError(2, `--keys takes a file or an https URL, not ${source}`);
  } else {
    try {
      text = readFileSync(source, "utf8");
    } catch (e) {
      throw new CliError(2, `cannot read the key list ${source}: ${(e as Error).message}`, { cause: e });
    }
  }
  return parseKeyList(text, source);
}

export function parseKeyList(text: string, source: string): TrustedKey[] {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new CliError(2, `the key list ${source} is not JSON`);
  }
  const keys = doc !== null && typeof doc === "object" && !Array.isArray(doc) ? (doc as { keys?: unknown }).keys : undefined;
  if (!Array.isArray(keys) || keys.length === 0) throw new CliError(2, `the key list ${source} has no "keys" array`);
  return keys.map((k: unknown, i: number) => {
    const entry = k !== null && typeof k === "object" ? (k as Record<string, unknown>) : {};
    const keyId = entry.key_id;
    const b64 = entry.public_key_b64;
    if (typeof keyId !== "string" || typeof b64 !== "string") throw new CliError(2, `key ${i} in ${source} has no key_id or public_key_b64`);
    const raw = Buffer.from(b64, "base64");
    if (raw.toString("base64") !== b64 || raw.length !== 32) throw new CliError(2, `key ${i} (${keyId}) in ${source} is not 32 bytes of base64`);
    const want = createHash("sha256").update(raw).digest("hex").slice(0, 8);
    if (keyId !== want) throw new CliError(2, `key ${i} in ${source}: key_id ${keyId} is not the first 8 hex of the SHA-256 of its key (${want})`);
    return { key_id: keyId, public_key_b64: b64 };
  });
}
