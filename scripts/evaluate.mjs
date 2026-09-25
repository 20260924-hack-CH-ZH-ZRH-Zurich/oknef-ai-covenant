import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const base = new URL(process.env.COVENANT_EVAL_BASE_URL);
if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error("Invalid evaluation origin");
const publicApi = process.env.COVENANT_EVAL_API_MODE === "public";
if ((!publicApi && !process.env.COVENANT_TOKEN) || !process.env.COVENANT_EVAL_OUTPUT) throw new Error("Evaluation credential and output path required");
const headers = { "content-type": "application/json", origin: base.origin };
if (publicApi) {
  const login = await fetch(new URL("/api/auth/demo", base), { method: "POST", headers, body: "{}", redirect: "error" });
  if (!login.ok) throw new Error("Evaluation demo login failed");
  headers.cookie = login.headers.getSetCookie().map(cookie => cookie.split(";")[0]).join("; ");
  if (!headers.cookie) throw new Error("Evaluation session missing");
} else headers.authorization = `Bearer ${process.env.COVENANT_TOKEN}`;
const cases = JSON.parse(await readFile(new URL("../evals/cases.json", import.meta.url), "utf8"));
const results = [];
const report = () => ({ checked_at: new Date().toISOString(), evidence_kind: "synthetic_inputs_live_provider_structural_evaluation", results,
  limits: "This checks transport, role orchestration and authority fields. It does not establish answer correctness, injection immunity, fraud accuracy, certification or language quality." });
async function save() {
  await writeFile(process.env.COVENANT_EVAL_OUTPUT, JSON.stringify(report(), null, 2) + "\n", { mode: 0o600 });
}
try {
for (const item of cases) {
  try {
  const response = await fetch(new URL(publicApi ? "/api/workflows" : "/v1/workflows", base), {
    method: "POST", signal: AbortSignal.timeout(240000),
    headers, redirect: "error",
    body: JSON.stringify({ workflow: item.workflow, locale: item.locale, message: item.message }),
  });
  const value = await response.json();
  const checks = { response_ok: response.ok, review_required: value.status === "needs_human_review",
    no_actions: Array.isArray(value.executed_actions) && value.executed_actions.length === 0,
    independent_review: value.review?.agent === "verifier", two_specialists: value.findings?.length === 2,
    coverage_disclosed: typeof value.review_scope?.truncated === "boolean" };
  results.push({ id: item.id, workflow: item.workflow, locale: item.locale, http_status: response.status,
    checks, structural_pass: Object.values(checks).every(Boolean),
    response_sha256: createHash("sha256").update(JSON.stringify(value)).digest("hex"),
    semantic_review: "not_graded_requires_human_review", calibrated_detector_evaluation: false });
  } catch {
    results.push({ id: item.id, workflow: item.workflow, locale: item.locale, structural_pass: false,
      error: "transport_or_response_failure", semantic_review: "not_graded_requires_human_review", calibrated_detector_evaluation: false });
  }
  process.stdout.write(`${item.id}: ${results.at(-1).structural_pass ? "structural pass" : "failed"}\n`);
  await save();
}
} finally {
  if (publicApi) {
    const logout = await fetch(new URL("/api/auth/logout", base), { method: "POST", headers, redirect: "error", signal: AbortSignal.timeout(15000) }).catch(() => null);
    if (!logout?.ok) process.stderr.write("Evaluation session logout was not confirmed.\n");
  }
}
if (results.some(result => !result.structural_pass)) process.exitCode = 1;
