import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { modelArgs, verifySource, project, commandAsync } from './common.mjs';
import { preparedBuild, selectedBuild, finished } from './cloud.mjs';
import { publish, render, clipWindow } from './publish.mjs';
import { qaResult } from '../../.agents/skills/tlon-workflow/qa-result.mjs';
const temp = () => mkdtempSync(path.join(os.tmpdir(), 'qa-small-'));
const head = 'a'.repeat(40);
const result = {
  status: 'completed',
  summary: 'Explored editing',
  duration: 2,
  runUrl:
    'https://expo.dev/accounts/tlon/projects/groups/workflows/01a0ab1b-248b-7310-b88c-29c10a21d812',
  pr: { number: 1, head: { sha: head } },
  report: {
    explored: ['Edit and save'],
    unexplored: ['Offline'],
    findings: [
      {
        title: 'Text disappears',
        when: 'After saving',
        observed: 'Appended text disappears',
        expected: 'Text persists',
        start: 1,
        end: 1.3,
      },
    ],
  },
};
test('Codex owns tools: device exploration and ordinary file/video review are separate', () => {
  const options = {
    name: 'operator',
    cwd: '/tmp',
    device: { AGENT_DEVICE_SESSION: 'qa' },
  };
  const operator = modelArgs(options);
  assert.ok(operator.includes('features.shell_tool=false'));
  assert.ok(operator.some((s) => s.includes('mcp_servers.device.command')));
  const reviewer = modelArgs({ ...options, name: 'review', device: undefined });
  assert.ok(reviewer.includes('workspace-write'));
  assert.ok(!reviewer.includes('--ephemeral'));
  assert.ok(operator.includes('--ephemeral'));
  assert.ok(reviewer.includes('features.shell_tool=true'));
  assert.ok(!reviewer.some((s) => s.includes('mcp_servers.')));
  assert.ok(
    modelArgs({ ...options, name: 'assessment', device: undefined }).includes(
      'read-only'
    )
  );
});
test('product-source identity survives a tooling overlay and rejects product edits', () => {
  const dir = temp();
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: dir,
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();
  try {
    git('init', '-q');
    git('config', 'user.email', 'qa@example.invalid');
    git('config', 'user.name', 'QA');
    writeFileSync(path.join(dir, 'app.txt'), 'original');
    git('add', '.');
    git('commit', '-qm', 'source');
    const source = git('rev-parse', 'HEAD');
    mkdirSync(path.join(dir, 'scripts/agent-qa'), { recursive: true });
    writeFileSync(path.join(dir, 'scripts/agent-qa/example.mjs'), '// tooling');
    git('add', '.');
    git('commit', '-qm', 'tooling');
    assert.doesNotThrow(() => verifySource(source, 'HEAD', dir));
    writeFileSync(path.join(dir, 'app.txt'), 'changed');
    git('commit', '-qam', 'product');
    assert.throws(() => verifySource(source, 'HEAD', dir), /product source/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('native fallback must finish; exact build reuse cannot substitute another artifact', () => {
  const run = {
    status: 'IN_PROGRESS',
    jobs: [{ key: 'repack_ios', status: 'FAILURE' }],
  };
  assert.equal(finished(run, 'build'), null);
  run.jobs.push({
    key: 'build_ios',
    status: 'SUCCESS',
    outputs: { build_id: 'id', git_commit_hash: head },
  });
  assert.equal(finished(run, 'build').status, 'SUCCESS');
  assert.deepEqual(preparedBuild(run), { id: 'id', sha: head });
  const build = {
    id: 'id',
    gitCommitHash: head,
    status: 'FINISHED',
    platform: 'IOS',
    buildProfile: 'e2e',
    isForIosSimulator: true,
    appIdentifier: 'io.tlon.groups',
    app: { id: project },
  };
  assert.deepEqual(selectedBuild(build, 'id', head), { id: 'id', sha: head });
  assert.throws(
    () => selectedBuild({ ...build, id: 'other' }, 'id', head),
    /matching/
  );
  assert.throws(
    () => selectedBuild({ ...build, isForIosSimulator: false }, 'id', head),
    /matching/
  );
});
test('gh attachments update one canonical comment and stay beside their findings', () => {
  const dir = temp();
  let comments = [],
    nextId = 1,
    uploads = 0,
    currentHead = head;
  const gh = (args) => {
    if (args.includes(`repos/tloncorp/tlon-apps/pulls/1`))
      return JSON.stringify({ head: { sha: currentHead } });
    if (args[1] === 'user') return '{"id":1}';
    if (args.includes('--slurp')) return JSON.stringify([comments]);
    if (args[0] === 'pr') {
      let body = readFileSync(args[args.indexOf('--body-file') + 1], 'utf8');
      const count = args.filter((s) => s === '--attach').length;
      for (let i = 0; i < count; i++)
        body += `\nhttps://github.com/user-attachments/assets/aaaa-${++uploads}\n`;
      const comment = {
        id: args.includes('--edit-last') ? comments.at(-1).id : nextId++,
        body,
        user: { id: 1, login: 'qa' },
        html_url: 'https://github.com/tloncorp/tlon-apps/pull/1#issuecomment-1',
      };
      comments = [comment];
      return comment.html_url;
    }
    if (args.includes('PATCH')) {
      comments[0].body = readFileSync(args.at(-1).slice(6), 'utf8');
      return JSON.stringify(comments[0]);
    }
    throw new Error(`Unexpected call: ${args}`);
  };
  try {
    for (let i = 0; i < 2; i++)
      publish(
        result,
        ['finding-1.mp4', 'session.mp4'],
        render(result, ['finding-1.mp4']),
        gh,
        dir
      );
    assert.equal(nextId, 2);
    assert.equal(comments.length, 1);
    assert.ok(
      comments[0].body.indexOf('assets/aaaa-3') <
        comments[0].body.indexOf('Full recording')
    );
    assert.equal(
      (comments[0].body.match(/user-attachments\/assets/g) || []).length,
      2
    );
    assert.doesNotMatch(comments[0].body, /\{\{VIDEO/);
    assert.equal(qaResult(comments[0]).execution, 'completed');
    currentHead = 'b'.repeat(40);
    assert.throws(
      () => publish(result, [], render(result, []), gh, dir),
      /PR changed/
    );
    currentHead = head;
    comments.push({ id: 5, body: 'Unrelated', user: { id: 1 } });
    assert.throws(
      () => publish(result, [], render(result, []), gh, dir),
      /unrelated/
    );
    const skip = qaResult({
      ...comments[0],
      body: render(
        {
          ...result,
          status: 'skipped',
          report: undefined,
          duration: undefined,
        },
        []
      ),
    });
    assert.equal(skip.status, 'skipped');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('the real clip/presentation path retains a late one-frame disappearance', () => {
  const dir = temp();
  try {
    assert.equal(clipWindow({ start: null, end: null }, 2), null);
    assert.throws(() => clipWindow({ start: 1, end: 3 }, 2), /outside/);
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=black:s=64x64:r=30:d=2',
      '-vf',
      "drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill:enable='eq(n,33)'",
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      path.join(dir, 'session.mp4'),
    ]);
    writeFileSync(path.join(dir, 'result.json'), JSON.stringify(result));
    execFileSync(
      process.execPath,
      [fileURLToPath(new URL('./publish.mjs', import.meta.url))],
      {
        env: { ...process.env, QA_DIR: dir, QA_PUBLISH: 'false' },
        stdio: 'pipe',
      }
    );
    const pixels = execFileSync('ffmpeg', [
      '-v',
      'error',
      '-i',
      path.join(dir, 'finding-1.mp4'),
      '-vf',
      'scale=1:1,format=gray',
      '-f',
      'rawvideo',
      'pipe:1',
    ]);
    assert.equal(pixels.length, 9);
    assert.ok(pixels[3] > 230);
    assert.match(
      readFileSync(path.join(dir, 'report.md'), 'utf8'),
      /Text disappears/
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('device subprocesses can use the ship proxy while the runner waits', async () => {
  const server = createServer((_req, res) => res.end('ship ready'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    assert.equal(
      await commandAsync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `console.log(await (await fetch(${JSON.stringify(url)})).text())`,
        ],
        { timeout: 5000 }
      ),
      'ship ready'
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('model subprocess receives an existing temporary home and saves its result', async () => {
  const dir = temp();
  const bin = path.join(dir, 'bin');
  mkdirSync(bin);
  writeFileSync(
    path.join(bin, 'codex'),
    `#!/usr/bin/env node
const fs = require('node:fs');
if (!fs.statSync(process.env.CODEX_HOME).isDirectory()) process.exit(2);
if (process.env.GH_TOKEN) process.exit(3);
fs.mkdirSync(process.env.CODEX_HOME+'/sessions', {recursive:true});
fs.writeFileSync(process.env.CODEX_HOME+'/sessions/native.jsonl', '{"tool":"view_image"}');
let prompt = '';
process.stdin.on('data', data => prompt += data);
process.stdin.on('end', () => {
  const result = process.argv[process.argv.indexOf('--output-last-message') + 1];
  fs.writeFileSync(result, JSON.stringify({summary: prompt}));
  console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:1,output_tokens:1}}));
});
`,
    { mode: 0o755 }
  );
  try {
    const common = new URL('./common.mjs', import.meta.url).href;
    await commandAsync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import {model} from ${JSON.stringify(common)}; const result = await model('assessment', 'test prompt', {schema:{type:'object'}}); if(result.summary!=='test prompt') process.exit(4); await model('review', 'test review', {schema:{type:'object'}});`,
      ],
      {
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          QA_DIR: dir,
          GH_TOKEN: 'must-not-reach-model',
        },
      }
    );
    assert.equal(
      JSON.parse(readFileSync(path.join(dir, 'assessment.txt'), 'utf8'))
        .summary,
      'test prompt'
    );
    assert.ok(
      readFileSync(path.join(dir, 'assessment.jsonl'), 'utf8').includes(
        'turn.completed'
      )
    );
    assert.throws(() => readFileSync(path.join(dir, 'codex-assessment')));
    assert.throws(() => readFileSync(path.join(dir, 'codex-review')));
    assert.match(
      readFileSync(path.join(dir, 'review-session/native.jsonl'), 'utf8'),
      /view_image/
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
