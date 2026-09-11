// The caller's Expo session prepares an authenticated, read-only artifact replay.
// Artifact URLs stay in the subprocess request and are never printed here.
import { execFileSync } from 'node:child_process';
import { selectEvidence } from './publish.mjs';
const [id, ref] = process.argv.slice(2);
if (
  !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id || '') ||
  !/^[a-zA-Z0-9][a-zA-Z0-9/_.-]{0,199}$/.test(ref || '')
)
  throw new Error('Usage: replay.mjs EAS_RUN_UUID QA_REF');
const eas = (args) =>
  JSON.parse(
    execFileSync(
      'npx',
      ['--yes', 'eas-cli@23.2.0', ...args, '--json', '--non-interactive'],
      {
        encoding: 'utf8',
        timeout: 120000,
        maxBuffer: 16000000,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    )
  );
const run = eas(['workflow:view', id]);
selectEvidence(run, id);
const artifact = run.jobs
  .find((j) => j.key === 'qa_ios')
  .artifacts.find((a) => a.name === 'ios-agent-qa');
if (!artifact) throw new Error('Missing recorded evidence');
const descriptor = {
  id,
  sha: run.gitCommitHash,
  artifact: {
    downloadUrl: artifact.downloadUrl,
    fileSizeBytes: artifact.fileSizeBytes,
  },
};
try {
  const value = eas([
    'workflow:run',
    '.eas/workflows/pr-agent-qa-ios.yml',
    '--ref',
    ref,
    '-F',
    `review_evidence_json=${JSON.stringify(descriptor)}`,
  ]);
  const started = Array.isArray(value) ? value[0] : value;
  console.log(
    `https://expo.dev/accounts/tlon/projects/groups/workflows/${started.id}`
  );
} catch {
  throw new Error(
    'Could not dispatch evidence replay; artifact URL omitted from diagnostics'
  );
}
