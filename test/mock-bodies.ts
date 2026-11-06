// Response bodies for the local mock API, taken from the examples in the OpenAPI document
// (https://app.rowattest.com/api/v1/openapi.json, info.version 1.1.0). Two values differ from the examples so the
// mock can serve a real signed summary: the run's report_id and verify_url, and the attestation's report_id, summary_url,
// verify_url and summary, name the kit 1 report (RA-01M55DE8NXN0282HMA9QKMT9JY). The attestation example omits the
// summary object the schema requires; it is filled with the kit 1 summary. Every other field is the example's own.
import { readFileSync } from "node:fs";

export const PROJECT = "e9753714-f07b-43e7-8020-1df74139fcf1"; // the examples' project id
export const FREE_PROJECT = "11111111-1111-4111-8111-111111111111"; // answered with the 402 example
export const REPORT_ID = "RA-01M55DE8NXN0282HMA9QKMT9JY";
export const LABEL = "mig1:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"; // the examples' label
export const KIT1_SUMMARY = readFileSync(new URL("./vectors/kit1-summary.json", import.meta.url));

export const runQueued = { run_id: "08b38433-c87f-45e7-8bb5-2023c3bea91b", status: "queued", created_at: "2026-10-15T11:50:08.541832+00:00", poll_after_seconds: 5 };
export const runRunning = {
  run_id: "08b38433-c87f-45e7-8bb5-2023c3bea91b", project_id: PROJECT, status: "running", stage: 4,
  created_at: "2026-10-15T11:50:08.541832+00:00", started_at: "2026-10-15T11:50:08.549205+00:00", finished_at: null,
  report_id: null, verify_url: null, poll_after_seconds: 10, access_model_sha256: null,
};
export const runComplete = {
  ...runRunning, status: "complete", stage: 6, finished_at: "2026-10-15T11:50:10.117+00:00",
  report_id: REPORT_ID, verify_url: `https://rowattest.com/verify/${REPORT_ID}`, poll_after_seconds: null,
  access_model_sha256: "33dcdaa8327dfc4296b745867bbd7ec14e8306c9664616a6dc11ab270ad96a8f",
};
export const attestation = (base: string) => ({
  report_id: REPORT_ID,
  issued_at: "2026-10-15T11:50:10.947Z",
  label: LABEL,
  summary_url: `${base}/api/reports/${REPORT_ID}/summary`,
  verify_url: `https://rowattest.com/verify/${REPORT_ID}`,
  summary: JSON.parse(KIT1_SUMMARY.toString("utf8")),
  current_schema_fingerprint: "sha256:eae6ffaeac09e6d90fc1d63d1766e9903bad1557e59e88a006d4317a35de02f9",
  fingerprint_checked_at: "2026-10-15T11:50:08.311+00:00",
  match: true,
});
export const fingerprintComplete = { status: "complete", schema_fingerprint: "sha256:eae6ffaeac09e6d90fc1d63d1766e9903bad1557e59e88a006d4317a35de02f9", checked_at: "2026-10-15T11:50:08.311+00:00" };
export const fingerprintNewer = { ...fingerprintComplete, checked_at: "2026-10-15T11:55:00.000+00:00" }; // the check the POST queued
export const fingerprintQueued = { status: "queued", fit_check_id: "4c1f2a9e-6b3d-4e8a-9f70-2d5b8c1e7a36" };
export const unauthorized = { error: { code: "unauthorized", message: "This request needs a valid RowAttest API key in the Authorization header.", docs_url: "https://rowattest.com/agents#unauthorized" } };
export const notFound = { error: { code: "not_found", message: "No project or run with that id was found for this key.", docs_url: "https://rowattest.com/agents#not_found" } };
export const proofNotIncluded = { error: { code: "proof_not_included", message: "This account's plan does not include signed proofs.", docs_url: "https://rowattest.com/agents#proof_not_included" } };
