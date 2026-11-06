# rowattest/gate: verify a RowAttest signed report offline, and gate CI on it.

A RowAttest report is signed with an Ed25519 key RowAttest publishes. This tool checks the signature, the canonical form, the report hash and the verify link without contacting RowAttest, so you do not have to trust the developer who handed you the report, or RowAttest's website, to know the report is genuine.

## Quick start

```
rowattest-gate check report.json
```

```
VALID
key_id 27499e4b
schema rowattest.signed-summary
schema_version 1.3
report_id RA-01M55DE8NXN0282HMA9QKMT9JY
verify_url https://rowattest.com/verify/RA-01M55DE8NXN0282HMA9QKMT9JY
totals.clean_report_blocked false
totals.disagreement 0
totals.error 0
totals.layer_a_only 0
totals.layer_b_corroborated 0
totals.leak 0
totals.model_divergence 0
totals.pass 19
totals.tables_not_evaluated 2
totals.tables_tested 3
totals.tables_total 5
totals.total 23
```

```
INVALID
key_id 27499e4b
failed_check signature
schema rowattest.signed-summary
schema_version 1.3
report_id RA-01M55DE8NXN0282HMA9QKMT9JY
verify_url https://rowattest.com/verify/RA-01M55DE8NXN0282HMA9QKMT9JY
totals.clean_report_blocked false
totals.disagreement 0
totals.error 0
totals.layer_a_only 0
totals.layer_b_corroborated 0
totals.leak 0
totals.model_divergence 0
totals.pass 20
totals.tables_not_evaluated 2
totals.tables_tested 3
totals.tables_total 5
totals.total 23
```

Download the bundle from the Releases page and run it with Node 20 or newer. A single executable that needs no Node is built from the same code with scripts/build-sea.sh.

## Meaning

VALID means: this report was produced by RowAttest's engine and has not been altered since it was signed. It does not mean the application is secure. Read the report's coverage statement for what was and was not evaluated.

## Commands

`check <file or -> [--keys <file or https URL>] [--fail-on [<list>]] [--json]` verifies a signed summary or report offline against the built-in key list, and with --fail-on fails when a named total is above zero (leak,disagreement,error when no list is given). Exit codes: 0 valid; 1 invalid; 2 usage, unreadable input or a bad key list; 3 valid, but a --fail-on total is above zero.

```
rowattest-gate check report.json --fail-on leak,disagreement,error
```

`fingerprint <project-id> [--start] [--wait <seconds>] [--json]` reads a project's schema fingerprint through the RowAttest API with the key in ROWATTEST_API_KEY, and with --start queues a new fit check and waits for it (120 seconds by default). Exit codes: 0 a fingerprint; 1 refused, failed or a network error; 2 usage or no ROWATTEST_API_KEY; 4 --wait ran out.

```
ROWATTEST_API_KEY=rak_your_key rowattest-gate fingerprint <project-id> --start
```

`attest --project <project-id> --label <text> [--wait <seconds>] [--out <path>] [--json]` starts a labelled run that asks for a signed proof, waits for the signed summary (600 seconds by default), verifies it as check does and prints the pointer document an app publishes at /.well-known/rowattest.json. Exit codes: 0 verified and printed; 1 refused (402 on a plan without signed proofs), failed, not verified or a network error; 2 usage or no ROWATTEST_API_KEY; 4 --wait ran out.

```
ROWATTEST_API_KEY=rak_your_key rowattest-gate attest --project <project-id> --label ci:$GITHUB_SHA --out rowattest.json
```

## Keys

The key list is https://rowattest.com/keys.json. One key today, key_id 27499e4b. key_id is the first 8 hex characters of the SHA-256 of the raw public key. The list is built into this tool; pass --keys to use a list you fetched yourself. Rotation adds a key to the list and never removes one that signed a published report.

## CI

A GitHub Action that runs RowAttest and gates a pull request on the result is in preparation at rowattest/action.

## Recipes

Hook recipes for Claude Code and Cursor are in preparation under recipes/.

## Security and licence

Report a security problem as SECURITY.md describes. MIT licence. The engine that produces reports is not in this repository, and that is deliberate: a report is only worth something if the party that ran the test is not the party being tested.

A product of RW Digital Ventures LLC.
