# Changelog

## 0.1.0 (2026-11-06)

- check: verifies a signed RowAttest summary or report offline against the published key list, with the report hash and the verify link bound; --fail-on gates CI on the verified totals.
- fingerprint: reads a project's schema fingerprint through the RowAttest API, and with --start queues a new one and waits for it.
- attest: starts a labelled run with attest through the API, waits for the signed result, verifies it and prints the well-known pointer document.
