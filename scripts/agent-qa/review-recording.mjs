// Finish device evidence on Linux. Re-entering this worker resumes completed stages.
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  statSync,
  cpSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';
import { reviewEvidence } from './review.mjs';
import { verifyCodexAuth, interruptedResult } from './codex.mjs';
import { verifyReport, renderReport } from './core.mjs';
import { verifyCoverage } from './assess.mjs';
import { billingSummary } from './billing.mjs';
const env = process.env;
const root = path.resolve('../..'),
  out = path.join(root, 'artifacts/evidence-replay');
mkdirSync(out, { recursive: true });
const descriptor = env.QA_REPLAY_EVIDENCE
  ? JSON.parse(env.QA_REPLAY_EVIDENCE)
  : {
      id: env.QA_WORKFLOW_URL?.split('/').at(-1),
      sha: execFileSync('git', ['rev-parse', 'HEAD'], {
        encoding: 'utf8',
      }).trim(),
      complete: true,
    };
const { id, sha } = descriptor;
if (
  !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id || '') ||
  !/^[a-f0-9]{40}$/.test(sha || '')
)
  throw new Error('Expected pinned evidence source');
async function download(a, target) {
  const url = new URL(a?.downloadUrl);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'wf-artifacts.eascdn.net' ||
    url.username ||
    url.password ||
    !(a.fileSizeBytes > 0 && a.fileSizeBytes <= 200 * 1024 * 1024)
  )
    throw new Error('Invalid evidence artifact');
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Evidence download ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== a.fileSizeBytes)
    throw new Error('Evidence size mismatch');
  writeFileSync(target, bytes);
  return target;
}
const extract = path.join(out, 'recorded');
const marker = path.join(out, 'extracted.json');
if (!existsSync(marker)) {
  const archive =
    env.QA_EVIDENCE_PATH ||
    (await download(descriptor.artifact, path.join(out, 'source.tar.gz')));
  if (statSync(archive).isDirectory())
    cpSync(archive, extract, { recursive: true });
  else
    execFileSync('python3', [
      '-c',
      'import sys,tarfile; tarfile.open(sys.argv[1]).extractall(sys.argv[2],filter="data")',
      archive,
      extract,
    ]);
  writeFileSync(marker, JSON.stringify({ id, sha }));
  rmSync(path.join(out, 'source.tar.gz'), { force: true });
}
const saved = JSON.parse(readFileSync(marker));
if (saved.id !== id || saved.sha !== sha)
  throw new Error('Cannot reuse another recording checkpoint');
const source = execFileSync(
  'python3',
  [
    '-c',
    'import sys,pathlib; p=list(pathlib.Path(sys.argv[1]).rglob("report.json")); assert len(p)==1; print(p[0].parent)',
    extract,
  ],
  { encoding: 'utf8' }
).trim();
const original = JSON.parse(readFileSync(path.join(source, 'report.json')));
if (original.context.harnessSha !== sha)
  throw new Error('Recording source mismatch');
const assessment = {
  ...original.context.assessment,
  scenarios: original.context.assessment.scenarios.filter(
    (s) => s.method !== 'regression'
  ),
};
const videoFile =
  env.QA_VIDEO_PATH ||
  (await download(descriptor.video, path.join(out, 'test-session.mp4')));
const video = { file: videoFile, startedAt: original.context.video.startedAt };
const usage = original.usage || { calls: 0, tokens: 0, cost: null };
let result = original.report;
if (original.context.evidenceReview !== 'completed') {
  await verifyCodexAuth(env.OPENROUTER_API_KEY);
  const operator = original.report.checks.some((c) => c.scenarioId)
    ? {
        ...original.report,
        checks: original.report.checks.filter((c) =>
          assessment.scenarios.some((s) => s.id === c.scenarioId)
        ),
      }
    : interruptedResult(assessment, original.report.summary);
  // Include missing criteria without treating pending coverage as a product failure.
  for (const c of interruptedResult(assessment, 'evidence awaiting review')
    .checks)
    if (!operator.checks.some((old) => old.scenarioId === c.scenarioId))
      operator.checks.push(c);
  result = await reviewEvidence({
    assessment,
    result: operator,
    artifacts: source,
    usage,
    video,
    videoOnly: !descriptor.complete,
  });
  for (const s of original.context.assessment.scenarios.filter(
    (s) => s.method === 'regression'
  )) {
    const receipt = original.context.backend?.regressionResults?.find(
      (r) => r.id === s.regression && r.source === assessment.headSha
    );
    const evidence = receipt ? ['regression-tests'] : [];
    if (receipt) {
      original.evidence['regression-tests'] = {
        file: 'regression-results.json',
        screenshot: false,
        command: 'deterministic regression',
      };
      writeFileSync(
        path.join(source, 'regression-results.json'),
        JSON.stringify(original.context.backend.regressionResults)
      );
    }
    result.checks.push({
      scenarioId: s.id,
      method: 'regression',
      expected: s.expected,
      status: ['passed', 'failed'].includes(receipt?.status)
        ? receipt.status
        : 'blocked',
      observed: receipt?.summary || 'No verified regression receipt',
      evidence,
    });
  }
}
const receiptPath = path.join(source, 'video-frames/receipts.json');
const receipts = existsSync(receiptPath)
  ? JSON.parse(readFileSync(receiptPath))
  : {};
result.status = [...result.checks, ...(result.discoveries || [])].some(
  (c) => c.status === 'failed'
)
  ? 'failed'
  : [...result.checks, ...(result.discoveries || [])].some(
        (c) => c.status === 'blocked'
      )
    ? 'blocked'
    : 'passed';
const evidence = { ...original.evidence, ...receipts };
verifyCoverage(
  verifyReport(result, new Map(Object.entries(evidence))),
  original.context.assessment
);
const context = {
  ...original.context,
  evidenceReview: 'completed',
  billing: billingSummary(source),
};
const counts = { passed: 0, failed: 0, blocked: 0 };
for (const check of result.checks) counts[check.status]++;
result.summary = `${counts.passed} checks passed; ${counts.failed} failed; ${counts.blocked} not fully verified. ${result.discoveries?.length || 0} unexpected findings.`;
const final = { ...original, context, report: result, usage, evidence };
writeFileSync(path.join(source, 'report.json'), JSON.stringify(final));
writeFileSync(
  path.join(out, 'replay.json'),
  JSON.stringify({ originalRun: id, result, evidence, usage })
);
writeFileSync(
  path.join(out, 'report.md'),
  renderReport(context, result, usage)
);
console.log(result.summary);
if (descriptor.complete)
  execFileSync(
    process.execPath,
    [path.join(root, 'scripts/agent-qa/present-run.mjs')],
    {
      env: {
        ...env,
        QA_EVIDENCE_PATH: source,
        QA_VIDEO_PATH: videoFile,
        QA_WORKFLOW_URL: `https://expo.dev/accounts/tlon/projects/groups/workflows/${id}`,
      },
      stdio: 'inherit',
      timeout: 12 * 60_000,
    }
  );
