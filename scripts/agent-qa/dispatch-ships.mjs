import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const cwd = `${process.env.GITHUB_WORKSPACE}/apps/tlon-mobile`;
const output = process.env.PROOF_OUTPUT;
function eas(args) {
  return JSON.parse(
    execFileSync(
      'npx',
      ['--yes', 'eas-cli@23.2.0', ...args, '--json', '--non-interactive'],
      {
        cwd,
        encoding: 'utf8',
        timeout: 120_000,
        maxBuffer: 8 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'inherit'],
      }
    )
  );
}
const dispatched = eas([
  'workflow:run',
  '.eas/workflows/pr-agent-qa-ios.yml',
  '--ref',
  process.env.GITHUB_SHA,
  '-F',
  'build_id=709ad03a-fc06-457a-a0c4-cb7ca437797c',
  '-F',
  'build_sha=f0e37ea6bf92a3e44554caeb96afddea089ba2fa',
  '-F',
  'app_id=io.tlon.groups',
  '-F',
  'test_ship=~zod',
  '-F',
  `ship_url=${process.env.QA_SHIP_URL}`,
  '-F',
  `backend_sha=${process.env.GITHUB_SHA}`,
  '-F',
  `run_tag=${process.env.MAESTRO_RUN_TAG}`,
  '-F',
  'focus=Verify the isolated two-ship message exchange and live acknowledgment.',
]);
const run = Array.isArray(dispatched) ? dispatched[0] : dispatched;
if (!run.id) throw new Error('EAS did not return a workflow ID');
writeFileSync(
  `${output}/eas-run.json`,
  JSON.stringify({ id: run.id }, null, 2)
);
console.log(
  `EAS run: https://expo.dev/accounts/tlon/projects/groups/workflows/${run.id}`
);
const deadline = Date.now() + 35 * 60_000;
while (Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 30_000));
  const status = eas(['workflow:view', run.id]);
  // Keep artifact URLs in EAS; signed download URLs need not enter GitHub logs.
  writeFileSync(
    `${output}/eas-result.json`,
    JSON.stringify(
      {
        id: run.id,
        status: status.status,
        jobs: status.jobs.map((j) => ({
          key: j.key,
          status: j.status,
          outputs: j.outputs,
        })),
      },
      null,
      2
    )
  );
  console.log(`EAS: ${status.status}`);
  if (status.status === 'SUCCESS') process.exit(0);
  if (['FAILURE', 'CANCELED'].includes(status.status)) process.exit(1);
}
throw new Error('EAS did not finish within the backend lease');
