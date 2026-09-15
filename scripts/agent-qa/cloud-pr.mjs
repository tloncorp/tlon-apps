import { assessmentForRetry } from './reuse-assessment.mjs';
import { selectEvidence } from './publish.mjs';
import { workflowState } from './workflow-state.mjs';
import { execFileSync } from 'node:child_process';
import { appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
const env = process.env;
// Ref-based dispatch needs only project identity, not app dependencies/config.
const queryDir = `${env.GITHUB_WORKSPACE}/.qa-eas-query`;
mkdirSync(queryDir, { recursive: true });
writeFileSync(
  `${queryDir}/package.json`,
  JSON.stringify({ name: 'qa-eas-coordinator', private: true })
);
writeFileSync(
  `${queryDir}/app.json`,
  JSON.stringify({
    expo: {
      name: 'Tlon',
      slug: 'groups',
      owner: 'tlon',
      extra: { eas: { projectId: '617bb643-5bf6-4c40-8af6-c6e9dd7e3bd0' } },
    },
  })
);
function command(bin, args, options = {}) {
  return execFileSync(bin, args, {
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}
function eas(args) {
  return JSON.parse(
    command(
      'npx',
      ['--yes', 'eas-cli@23.2.0', ...args, '--json', '--non-interactive'],
      { cwd: queryDir }
    )
  );
}
function output(key, value) {
  appendFileSync(
    env.GITHUB_OUTPUT,
    `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}\n`
  );
}
async function wait(id, minutes, deviceOnly = false) {
  const deadline = Date.now() + minutes * 60000;
  while (Date.now() < deadline) {
    const run = eas(['workflow:view', id]);
    run.status = workflowState(run);
    if (
      deviceOnly &&
      run.jobs.some(
        (j) =>
          j.key === 'qa_ios' &&
          ['SUCCESS', 'FAILURE', 'CANCELED'].includes(j.status)
      )
    )
      return run;
    if (['SUCCESS', 'FAILURE', 'CANCELED'].includes(run.status)) return run;
    console.log(`EAS ${id}: ${run.status}`);
    await new Promise((r) => setTimeout(r, 30000));
  }
  throw new Error('EAS exceeded its backend lease');
}
async function dispatch(inputs, ref) {
  const result = eas([
    'workflow:run',
    '.eas/workflows/pr-agent-qa-ios.yml',
    '--ref',
    ref,
    ...Object.entries(inputs).flatMap(([k, v]) => [
      '-F',
      `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`,
    ]),
  ]);
  const run = Array.isArray(result) ? result[0] : result;
  console.log(
    `Cloud run: https://expo.dev/accounts/tlon/projects/groups/workflows/${run.id}`
  );
  return run.id;
}
if (process.argv[2] === 'assess') {
  const number = env.QA_PR_NUMBER;
  if (!/^[1-9][0-9]*$/.test(number)) throw new Error('Missing PR number');
  const p = JSON.parse(
    command('gh', ['api', `repos/tloncorp/tlon-apps/pulls/${number}`])
  );
  if (p.draft || p.head.repo.full_name !== 'tloncorp/tlon-apps')
    throw new Error('Only same-repository non-draft PRs are eligible');
  const pr = Object.fromEntries(
    ['number', 'title', 'body', 'draft', 'head', 'base'].map((k) => [k, p[k]])
  );
  for (const side of ['head', 'base'])
    pr[side] = {
      sha: p[side].sha,
      repo: { full_name: p[side].repo.full_name },
    };
  const requestedRef = env.QA_TARGET_REF || p.head.sha;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_.-]{0,199}$/.test(requestedRef))
    throw new Error('Invalid QA source ref');
  command('git', ['fetch', '--no-tags', '--depth=1', 'origin', requestedRef]);
  const ref = command('git', ['rev-parse', 'FETCH_HEAD']).trim();
  const inputs = { assessment_pr_json: pr };
  if (env.QA_ASSESSMENT_RUN_ID) {
    if (
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(
        env.QA_ASSESSMENT_RUN_ID
      )
    )
      throw new Error('Invalid assessment run ID');
    inputs.prepared_assessment_json = assessmentForRetry(
      eas(['workflow:view', env.QA_ASSESSMENT_RUN_ID]),
      env.QA_ASSESSMENT_RUN_ID,
      pr
    );
    console.log(
      `Reusing assessment ${env.QA_ASSESSMENT_RUN_ID}; the build job revalidates its source citations before backend setup.`
    );
  }
  let plan = inputs.prepared_assessment_json;
  if (!plan) {
    const id = await dispatch(inputs, ref);
    const run = await wait(id, 16);
    const job = run.jobs.find((j) => j.key === 'assess_pr');
    plan = JSON.parse(job?.outputs?.assessment || 'null');
  }
  if (!plan || plan.headSha !== p.head.sha || plan.baseSha !== p.base.sha)
    throw new Error('Assessment source mismatch');
  output('pr_json', pr);
  output('plan', plan);
  output('decision', plan.decision);
  output('fixture_plan', plan.setup);
  output('has_fixtures', Boolean(plan.setup.fixtures.length).toString());
  output('ref', ref);
  console.log(
    `Assessment: ${plan.decision}; fixtures: ${plan.setup.fixtures.join(', ') || 'none'}`
  );
} else if (process.argv[2] === 'build') {
  const input = {
    assessment_pr_json: JSON.parse(env.QA_PR_JSON),
    prepared_assessment_json: JSON.parse(env.QA_ASSESSMENT_JSON),
    build_only: true,
  };
  if (env.QA_BUILD_ID)
    Object.assign(input, {
      build_id: env.QA_BUILD_ID,
      build_sha: env.QA_BUILD_SHA,
    });
  const id = await dispatch(input, env.QA_TARGET_REF);
  const run = await wait(id, 50);
  const build = ['repack_ios', 'reuse_build', 'build_ios']
    .map((key) => run.jobs.find((j) => j.key === key))
    .find((j) => j?.status === 'SUCCESS' && j.outputs?.build_id);
  if (!build) throw new Error('No verified simulator build prepared');
  output('build_id', build.outputs.build_id);
  output('build_sha', build.outputs.git_commit_hash);
  output('build_run_id', id);
} else if (process.argv[2] === 'finish') {
  let id = env.QA_EAS_RUN_ID;
  const original = await wait(id, 45);
  let run = original;
  // One cross-worker recovery if publication failed after durable capture.
  // Same-worker checkpoints handle transient reviewer/editor failures first.
  if (!run.jobs.some((j) => j.outputs?.comment_url)) {
    const { video } = selectEvidence(original, id);
    const reviewed = original.jobs
      .find((j) => j.key === 'report_video')
      ?.artifacts?.find((a) => a.name === 'evidence-review-replay');
    const artifact =
      reviewed ||
      original.jobs
        .find((j) => j.key === 'qa_ios')
        ?.artifacts?.find((a) => a.name === 'ios-agent-qa');
    if (!artifact || !video) throw new Error('No durable recording to resume');
    const descriptor = {
      id,
      sha: original.gitCommitHash,
      complete: true,
      artifact: {
        downloadUrl: artifact.downloadUrl,
        fileSizeBytes: artifact.fileSizeBytes,
      },
      video: {
        downloadUrl: video.downloadUrl,
        fileSizeBytes: video.fileSizeBytes,
      },
    };
    id = await dispatch(
      { review_evidence_json: descriptor },
      env.QA_TARGET_REF
    );
    run = await wait(id, 40);
  }
  const published = run.jobs.find((j) => j.outputs?.comment_url);
  if (!published)
    throw new Error(
      'Review publication failed after recorded-evidence recovery'
    );
  console.log(`Automatic report: ${published.outputs.comment_url}`);
  output('comment_url', published.outputs.comment_url);
  if (published.outputs.qa_status !== 'passed') process.exit(1);
} else if (process.argv[2] === 'run') {
  const pr = JSON.parse(env.QA_PR_JSON);
  const plan = JSON.parse(env.QA_ASSESSMENT_JSON);
  const input = {
    assessment_pr_json: pr,
    prepared_assessment_json: plan,
    full_pr_run: true,
  };
  if (env.QA_BUILD_ID) {
    input.build_id = env.QA_BUILD_ID;
    input.build_sha = env.QA_BUILD_SHA;
  }
  if (env.QA_SHIP_URL)
    Object.assign(input, {
      ship_url: env.QA_SHIP_URL,
      backend_sha: command('git', ['rev-parse', 'HEAD']).trim(),
      test_ship: '~zod',
      run_tag: env.MAESTRO_RUN_TAG,
    });
  const id = await dispatch(input, env.QA_TARGET_REF);
  output('eas_run_id', id);
  const run = await wait(
    id,
    env.QA_BUILD_ID ? 40 : 70,
    Boolean(env.PROOF_OUTPUT)
  );
  if (env.PROOF_OUTPUT)
    writeFileSync(
      `${env.PROOF_OUTPUT}/eas-run.json`,
      JSON.stringify({ id, status: run.status })
    );
  if (!env.PROOF_OUTPUT && run.status !== 'SUCCESS') process.exit(1);
} else throw new Error('Expected assess, build, run or finish');
