import { appendFileSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { root, repo, project, command, save, verifySource } from './common.mjs';
export function selectedBuild(build, id, sha) {
  if (
    build.id !== id ||
    build.gitCommitHash !== sha ||
    build.status !== 'FINISHED' ||
    build.platform !== 'IOS' ||
    build.buildProfile !== 'e2e' ||
    !build.isForIosSimulator ||
    build.appIdentifier !== 'io.tlon.groups' ||
    build.app?.id !== project
  )
    throw new Error('Requested build is not the matching e2e simulator app');
  return { id, sha };
}
export function preparedBuild(run) {
  const job = ['repack_ios', 'build_ios']
    .map((key) => run.jobs.find((j) => j.key === key))
    .find((j) => j?.status === 'SUCCESS' && j.outputs?.build_id);
  if (!job) throw new Error('EAS did not prepare a simulator build');
  return { id: job.outputs.build_id, sha: job.outputs.git_commit_hash };
}
export function finished(run, phase) {
  if (['SUCCESS', 'FAILURE', 'CANCELED'].includes(run.status)) return run;
  const final = run.jobs.find(
    (j) =>
      j.key ===
      (phase === 'review' ? 'qa' : phase === 'assess' ? 'assess' : 'build_ios')
  );
  const repack =
    phase === 'build' &&
    run.jobs.find((j) => j.key === 'repack_ios' && j.status === 'SUCCESS');
  return repack
    ? { ...run, status: 'SUCCESS' }
    : final && ['SUCCESS', 'FAILURE', 'CANCELED'].includes(final.status)
      ? { ...run, status: final.status }
      : null;
}
async function main() {
  const env = process.env,
    mode = process.argv[2];
  const directory = mkdtempSync(path.join(os.tmpdir(), 'qa-eas-'));
  save(path.join(directory, 'package.json'), {
    name: 'qa-coordinator',
    private: true,
  });
  save(path.join(directory, 'app.json'), {
    expo: {
      name: 'Tlon',
      slug: 'groups',
      owner: 'tlon',
      extra: { eas: { projectId: project } },
    },
  });
  const eas = (args) =>
    JSON.parse(
      command(
        'npx',
        [
          '--yes',
          'eas-cli@23.2.0',
          ...args,
          '--json',
          ...(args[0] === 'build:view' ? [] : ['--non-interactive']),
        ],
        { cwd: directory }
      )
    );
  const output = (key, value) =>
    appendFileSync(
      env.GITHUB_OUTPUT,
      `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}\n`
    );
  async function dispatch(phase, pr, ref, inputs = {}) {
    const runs = eas([
      'workflow:run',
      '.eas/workflows/pr-agent-qa-ios.yml',
      '--ref',
      ref,
      ...Object.entries({ phase, pr: JSON.stringify(pr), ...inputs }).flatMap(
        ([k, v]) => ['-F', `${k}=${v}`]
      ),
    ]);
    const id = (Array.isArray(runs) ? runs[0] : runs).id;
    console.log(
      `EAS: https://expo.dev/accounts/tlon/projects/groups/workflows/${id}`
    );
    const deadline = Date.now() + (phase === 'assess' ? 15 : 60) * 60000;
    while (Date.now() < deadline) {
      const run = eas(['workflow:view', id]);
      // EAS schedules jobs lazily and may lag after the final job finishes.
      const done = finished(run, phase);
      if (done) return done;
      await new Promise((resolve) => setTimeout(resolve, 30000));
    }
    throw new Error('EAS exceeded its one-hour lease');
  }
  if (mode === 'prepare') {
    if (!/^[1-9][0-9]*$/.test(env.QA_PR_NUMBER))
      throw new Error('Missing PR number');
    const live = JSON.parse(
      command('gh', ['api', `repos/${repo}/pulls/${env.QA_PR_NUMBER}`])
    );
    if (live.draft || live.head.repo.full_name !== repo)
      throw new Error(
        'Only trusted non-draft same-repository PRs are supported'
      );
    const pr = {
      number: live.number,
      title: live.title,
      body: live.body,
      head: { sha: live.head.sha },
      base: { sha: live.base.sha },
    };
    command('git', [
      'fetch',
      '--no-tags',
      '--depth=1',
      'origin',
      env.QA_TARGET_REF || pr.head.sha,
      pr.head.sha,
    ]);
    const ref = command('git', ['rev-parse', 'FETCH_HEAD']);
    verifySource(pr.head.sha, ref);
    output('ref', ref);
    output('pr', pr);
    const assessmentRun = await dispatch('assess', pr, ref);
    const assessment = JSON.parse(
      assessmentRun.jobs.find((j) => j.key === 'assess')?.outputs?.assessment ||
        'null'
    );
    if (!assessment) throw new Error('Assessment failed; see EAS logs');
    output('assessment', assessment);
    output('decision', assessment.decision);
    if (assessment.decision === 'blocked') throw new Error(assessment.summary);
    if (assessment.decision === 'skip') return;
    const build = env.QA_BUILD_ID
      ? selectedBuild(
          eas(['build:view', env.QA_BUILD_ID]),
          env.QA_BUILD_ID,
          env.QA_BUILD_SHA
        )
      : preparedBuild(await dispatch('build', pr, ref));
    command('git', ['fetch', '--no-tags', '--depth=1', 'origin', build.sha]);
    verifySource(pr.head.sha, build.sha);
    output('build_id', build.id);
    output('build_sha', build.sha);
  } else if (mode === 'review') {
    const run = await dispatch(
      'review',
      JSON.parse(env.QA_PR_JSON),
      env.QA_TARGET_REF,
      {
        build_id: env.QA_BUILD_ID,
        build_sha: env.QA_BUILD_SHA,
        assessment: env.QA_ASSESSMENT_JSON,
        ship_url: env.QA_SHIP_URL,
        backend_sha: command('git', ['rev-parse', 'HEAD']),
      }
    );
    if (run.status !== 'SUCCESS')
      throw new Error(
        'Hosted review did not complete; see its comment and artifacts'
      );
  } else throw new Error('Expected prepare or review');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
