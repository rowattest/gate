# Test vectors

Every file here is real. Two were fetched; the rest were made from them by test/make-vectors.ts.

| File | Where it came from | Expected |
| --- | --- | --- |
| kit1-summary.json | https://app.rowattest.com/api/reports/RA-01M55DE8NXN0282HMA9QKMT9JY/summary, fetched 2026-11-06, 4136 bytes, sha256 46a3cc913eba2071f3be84374c77c50bb39935d9e1864210b8f50e2ca999ef4a (the signed summary of proof run kit 1) | valid, key_id 27499e4b, schema_version 1.3, exit 0 |
| keys-live.json | https://rowattest.com/keys.json, fetched 2026-11-06, 202 bytes, sha256 38cfc57d211523d0596f0b11fe2ac45cc54557102d034c958bbc3e968fa47641 | a key list equal to the built-in one |
| kit1-tampered-total.json | kit1-summary.json with totals.pass plus one | failed_check signature, exit 1 |
| kit1-wrong-key.json | kit1-summary.json with signature.public_key replaced by a freshly generated Ed25519 key | failed_check key-mismatch, exit 1 |
| kit1-bad-sha.json | kit1-summary.json with the last hex digit of signature.report_sha256 changed | failed_check report-sha256, exit 1 |
| kit1-bad-url.json | kit1-summary.json with the report id in signature.verify_url changed | failed_check verify-url, exit 1 |
| kit1-no-signature.json | kit1-summary.json with the signature block removed | failed_check no-signature, exit 1 |
| kit1-not-json.txt | one line of text that is not JSON | failed_check no-signature (the verifier answers text that is not JSON as having no signature block), exit 1 |
| kit1-reordered.json | kit1-summary.json with its members in reverse order at every level and indented | valid, exit 0 (verification is over the canonical form) |
| keys-bad-id.json | keys-live.json's key with key_id 00000000 | exit 2 (the key_id is not the first 8 hex of the key's SHA-256) |
| keys-unrelated.json | a freshly generated Ed25519 key with its correct key_id | failed_check key-mismatch, exit 1 |

kit1-wrong-key.json and keys-unrelated.json hold a key generated when the script ran, so running the script again changes their bytes, not their expected results.
expected-exit.txt lists the document vectors and their exit codes for the CI step that runs the built bundle on each.
