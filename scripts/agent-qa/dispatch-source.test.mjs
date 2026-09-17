import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

for (const kind of ['product', 'trusted-head', 'approved-overlay'])
  test(`assessment validates ${kind} before contacting EAS`, () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'qa-dispatch-test-'));
    const git = (...args) =>
      execFileSync('git', args, {
        cwd: dir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
    try {
      git('init');
      git('config', 'user.email', 'qa@example.invalid');
      git('config', 'user.name', 'QA');
      mkdirSync(path.join(dir, 'scripts/agent-qa'), { recursive: true });
      writeFileSync(path.join(dir, 'scripts/agent-qa/trusted.mjs'), 'trusted');
      writeFileSync(path.join(dir, 'app.txt'), 'original');
      git('add', '.');
      git('commit', '-m', 'source');
      const trusted = git('rev-parse', 'HEAD');
      let head = trusted;
      if (kind === 'product')
        writeFileSync(path.join(dir, 'app.txt'), 'wrong product');
      else
        writeFileSync(
          path.join(dir, 'scripts/agent-qa/trusted.mjs'),
          'unreviewed'
        );
      git('commit', '-am', 'candidate changes');
      let overlay = git('rev-parse', 'HEAD');
      if (kind !== 'product') head = overlay;
      if (kind === 'approved-overlay') {
        writeFileSync(
          path.join(dir, 'scripts/agent-qa/trusted.mjs'),
          'trusted'
        );
        git('commit', '-am', 'approved tooling overlay');
        overlay = git('rev-parse', 'HEAD');
      }
      git('checkout', '--detach', trusted);
      git('remote', 'add', 'origin', dir);
      mkdirSync(path.join(dir, 'bin'));
      const pr = {
        number: 1,
        draft: false,
        title: 'test',
        body: '',
        head: { sha: head, repo: { full_name: 'tloncorp/tlon-apps' } },
        base: { sha: head, repo: { full_name: 'tloncorp/tlon-apps' } },
      };
      writeFileSync(path.join(dir, 'pr.json'), JSON.stringify(pr));
      writeFileSync(
        path.join(dir, 'bin/gh'),
        '#!/bin/sh\ncat "$GITHUB_WORKSPACE/pr.json"\n',
        { mode: 0o755 }
      );
      writeFileSync(
        path.join(dir, 'bin/npx'),
        '#!/bin/sh\ntouch "$GITHUB_WORKSPACE/eas-contacted"\nexit 1\n',
        { mode: 0o755 }
      );
      const result = spawnSync(
        process.execPath,
        [fileURLToPath(new URL('./cloud-pr.mjs', import.meta.url)), 'assess'],
        {
          cwd: dir,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${dir}/bin:${process.env.PATH}`,
            GITHUB_WORKSPACE: dir,
            GITHUB_OUTPUT: path.join(dir, 'output'),
            QA_PR_NUMBER: '1',
            QA_TARGET_REF: kind === 'trusted-head' ? '' : overlay,
            QA_ASSESSMENT_RUN_ID: '',
          },
        }
      );
      assert.notEqual(result.status, 0);
      if (kind === 'product')
        assert.match(result.stderr, /QA overlay changes product source/);
      assert.equal(
        existsSync(path.join(dir, 'eas-contacted')),
        kind !== 'product',
        result.stderr
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
