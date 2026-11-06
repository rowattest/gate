// AP-1a (R4): RowAttest's signing keys, the one entry copied byte for byte from
// the landing's verify page (js/verify-page.js:13-15), and the URL of the key
// list the landing publishes (AP-1b). verify_attestation reads KEYS_URL and
// falls back to TRUSTED_KEYS; GET /api/v1/verify/{id} uses TRUSTED_KEYS. A
// block signed by any other key is INVALID. Every key ever used stays in this
// list, so a summary signed before a key rotation keeps verifying.

export interface TrustedKey {
  key_id: string;
  public_key_b64: string;
}

export const TRUSTED_KEYS: readonly TrustedKey[] = [
  { key_id: "27499e4b", public_key_b64: "uxkQB8obyQW7s9G34caDDu+LzRa5bfFqbol0Iz9qr1U=" },
];

export const KEYS_URL = "https://rowattest.com/keys.json";
