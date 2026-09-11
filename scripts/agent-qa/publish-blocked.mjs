import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const e = process.env;
if (
  !/^[1-9][0-9]*$/.test(e.QA_PR_NUMBER) ||
  !/^[a-f0-9]{40}$/.test(e.QA_HEAD_SHA)
)
  throw new Error('Missing PR provenance');
fs.writeFileSync(
  '/tmp/qa-report.md',
  [
    '## iOS agent QA',
    '',
    e.QA_REPORT,
    '',
    `[Run and evidence](${e.QA_WORKFLOW_URL}) · Requested commit \`${e.QA_HEAD_SHA}\``,
    '',
    e.QA_VIDEO_FAILED === 'true'
      ? 'Automatic video embedding failed; the recording remains in the run artifacts.'
      : 'No simulator recording was produced. See the assessment or setup result above.',
    '',
  ].join('\n')
);
execFileSync(
  '/tmp/gh_2.99.0_linux_amd64/bin/gh',
  [
    'pr',
    'comment',
    e.QA_PR_NUMBER,
    '--repo',
    'tloncorp/tlon-apps',
    '--body-file',
    '/tmp/qa-report.md',
  ],
  { stdio: 'inherit', env: { ...e, GH_TOKEN: e.GH_QA_TOKEN } }
);
