// AP-1a (X4): a Node port of the landing's verifyReport (js/verify-page.js:35-171),
// the same checks in the same order with the same failed_check names, for a
// signature block v1 or v2 as the page accepts it. Ed25519 through node:crypto:
// the raw 32-byte public key behind the SPKI prefix, then crypto.verify(null, ...).
// The app checks signed summaries with it (GET /api/v1/verify/{id} and the MCP
// tool verify_attestation) and adds no dependency on rowattest-engine.
import { createHash, createPublicKey, verify } from "node:crypto";
import { canonicalize } from "./jcs.ts";
import type { TrustedKey } from "./keys.ts";

const VERIFY_URL_BASE = "https://rowattest.com/verify/";
// The DER prefix of an Ed25519 SubjectPublicKeyInfo (RFC 8410).
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export type SummaryCheck = "no-signature" | "malformed" | "key-mismatch" | "canonicalization" | "signature" | "report-sha256" | "verify-url";

export interface SummaryVerification {
  valid: boolean;
  failed_check: SummaryCheck | null;
  key_id: string | null;
}

// atob, as the page decodes: it throws on text that is not base64.
function base64ToBytes(b64: string): Buffer {
  return Buffer.from(atob(b64), "latin1");
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] as number) ^ (b[i] as number);
  return diff === 0;
}

const sha256Hex = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

function isTrusted(rawPub: Buffer, trustedKeys: readonly TrustedKey[]): boolean {
  return trustedKeys.some((k) => {
    try {
      return bytesEqual(rawPub, base64ToBytes(k.public_key_b64));
    } catch {
      return false;
    }
  });
}

function ed25519Verify(message: Buffer, signature: Buffer, rawPub: Buffer): boolean {
  try {
    const key = createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, rawPub]), format: "der", type: "spki" });
    return verify(null, message, key, signature);
  } catch {
    return false;
  }
}

// The signed object as text (a stored or fetched summary). Text that is not
// JSON has no signature block to check: "no-signature", as the page answers any
// value that is not an object.
export function verifySummary(summaryText: string, trustedKeys: readonly TrustedKey[]): SummaryVerification {
  let report: unknown;
  try {
    report = JSON.parse(summaryText);
  } catch {
    return { valid: false, failed_check: "no-signature", key_id: null };
  }
  const fail = (failed_check: SummaryCheck, key_id: string | null = null): SummaryVerification => ({ valid: false, failed_check, key_id });
  const obj = report !== null && typeof report === "object" ? (report as Record<string, unknown>) : null;
  const reportId = obj && typeof obj.report_id === "string" ? obj.report_id : null;
  const sig = obj && !Array.isArray(obj) ? obj.signature : undefined;
  if (!sig || typeof sig !== "object" || Array.isArray(sig)) return fail("no-signature");
  const s = sig as Record<string, unknown>;
  if (s.algorithm !== "Ed25519" || typeof s.public_key !== "string" || typeof s.signature !== "string") return fail("malformed");
  const v2 = s.report_sha256 !== undefined || s.verify_url !== undefined;
  if (v2 && (typeof s.report_sha256 !== "string" || typeof s.verify_url !== "string")) return fail("malformed");
  let rawPub: Buffer;
  let signature: Buffer;
  try {
    rawPub = base64ToBytes(s.public_key);
    signature = base64ToBytes(s.signature);
  } catch {
    return fail("malformed");
  }
  const keyId = sha256Hex(rawPub).slice(0, 8);
  if (!isTrusted(rawPub, trustedKeys)) return fail("key-mismatch", keyId);
  let message: Buffer;
  try {
    const body = { ...(obj as Record<string, unknown>) };
    delete body.signature;
    message = Buffer.from(canonicalize(body), "utf8");
  } catch {
    return fail("canonicalization", keyId);
  }
  if (!ed25519Verify(message, signature, rawPub)) return fail("signature", keyId);
  if (v2) {
    if (sha256Hex(message) !== s.report_sha256) return fail("report-sha256", keyId);
    if (!reportId || s.verify_url !== VERIFY_URL_BASE + reportId) return fail("verify-url", keyId);
  }
  return { valid: true, failed_check: null, key_id: keyId };
}
