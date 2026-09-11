import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { session } from './review.mjs';

test('completed review resumes without a model call and changed evidence invalidates it', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'qa-checkpoint-'));
  const priorPath = process.env.PATH,
    priorKey = process.env.OPENROUTER_API_KEY;
  try {
    process.env.PATH = dir + path.delimiter + priorPath;
    delete process.env.OPENROUTER_API_KEY;
    writeFileSync(
      path.join(dir, 'codex'),
      `#!${process.execPath}
const fs = require('node:fs');
fs.appendFileSync(${JSON.stringify(path.join(dir, 'calls'))}, 'called\\n');
fs.writeFileSync(process.argv[process.argv.indexOf('--output-last-message')+1], '{"done":true}');
console.log('{"type":"turn.completed","usage":{"input_tokens":12,"output_tokens":3}}');
`,
      { mode: 0o755 }
    );
    const trace = path.join(dir, 'trace.jsonl');
    writeFileSync(trace, 'one');
    const options = {
      mode: 'evidence',
      schema: {},
      instructions: 'review',
      prompt: { id: 1 },
      outputDir: dir,
      environment: { QA_EVIDENCE_TRACE: trace },
      usage: { calls: 0, tokens: 0 },
    };
    assert.deepEqual(await session(options), { done: true });
    assert.deepEqual(await session(options), { done: true });
    assert.equal(readFileSync(path.join(dir, 'calls'), 'utf8'), 'called\n');
    writeFileSync(trace, 'two');
    await session(options);
    assert.equal(
      readFileSync(path.join(dir, 'calls'), 'utf8'),
      'called\ncalled\n'
    );
  } finally {
    process.env.PATH = priorPath;
    if (priorKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = priorKey;
    rmSync(dir, { recursive: true, force: true });
  }
});
