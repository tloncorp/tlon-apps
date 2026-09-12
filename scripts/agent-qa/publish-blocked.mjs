import { publishComment } from './comment.mjs';
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
const gh = (args) =>
  execFileSync(e.QA_GH_BIN || '/tmp/gh_2.99.0_linux_amd64/bin/gh', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
    env: { ...e, GH_TOKEN: e.GH_QA_TOKEN },
  });
const comment = publishComment({
  gh,
  pr: e.QA_PR_NUMBER,
  directory: '/tmp',
  body: fs.readFileSync('/tmp/qa-report.md', 'utf8'),
  attempt: {
    url: e.QA_WORKFLOW_URL,
    head: e.QA_HEAD_SHA,
    key: `${e.QA_WORKFLOW_URL}:blocked`,
    kind: 'blocked',
  },
});
console.log(`Published automatically: ${comment.html_url}`);
