/** Shared compiler/report plumbing; every behavioral assertion lives in its fixture. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

/** Extract an exact unique Objective-C method, ignoring braces inside comments/strings. */
export function methodSource(source, signature) {
  const marker = `${signature}\n{`;
  const start = source.indexOf(marker);
  assert.ok(
    start >= 0 && source.indexOf(marker, start + 1) === -1,
    `Missing/duplicate method: ${signature}`
  );
  let depth = 0,
    quote = null,
    comment = null;
  for (let i = start + marker.length - 1; i < source.length; i++) {
    const c = source[i],
      next = source[i + 1];
    if (comment === 'line') {
      if (c === '\n') comment = null;
      continue;
    }
    if (comment === 'block') {
      if (c === '*' && next === '/') {
        comment = null;
        i++;
      }
      continue;
    }
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && next === '/') {
      comment = 'line';
      i++;
      continue;
    }
    if (c === '/' && next === '*') {
      comment = 'block';
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return source.slice(start, i + 1) + '\n\n';
  }
  throw Error(`Unclosed method: ${signature}`);
}

export function runRNHostControls({
  name,
  expectedCount,
  recordsKey,
  passField,
  prepare,
  boundary,
  sourcePackage = 'react-native',
  sourceManifest = new URL('../../packages/app/package.json', import.meta.url),
}) {
  const options = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const option = process.argv[i];
    assert.ok(
      ['--source-root', '--report'].includes(option),
      `Unknown option: ${option}`
    );
    assert.ok(process.argv[i + 1] && !process.argv[i + 1].startsWith('--'));
    assert.ok(!(option in options), `Repeated option: ${option}`);
    options[option] = path.resolve(process.argv[i + 1]);
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  const sources = [],
    fixtures = [],
    processes = [];
  let phase = 'source',
    sourceRoot,
    metadata;
  const writeReport = (report) => {
    if (!options['--report']) return;
    fs.mkdirSync(path.dirname(options['--report']), { recursive: true });
    fs.writeFileSync(
      options['--report'],
      JSON.stringify(report, null, 2) + '\n'
    );
  };
  const inputs = () =>
    fs
      .readdirSync(directory)
      .filter((name) => name !== 'controls')
      .map((name) => ({
        name,
        sha256: sha(fs.readFileSync(path.join(directory, name))),
      }));
  const provenance = () => ({
    sourceRoot,
    sources: sources.map(({ bytes, ...item }) => item),
    fixtures: fixtures.map(({ bytes, ...item }) => item),
    inputs: inputs(),
    boundary,
    metadata,
    processes,
  });
  const invoke = (step, command, args, timeout) => {
    phase = step;
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      timeout,
      maxBuffer: 16 * 1024 * 1024,
    });
    processes.push({
      step,
      command,
      args,
      status: result.status,
      signal: result.signal,
      stdout: result.stdout,
      stderr: result.stderr,
      error: result.error && {
        message: result.error.message,
        code: result.error.code,
      },
    });
    assert.equal(result.error, undefined, result.error?.message);
    return result;
  };
  try {
    assert.equal(
      process.platform,
      'darwin',
      'UNAVAILABLE: host native controls require macOS, Foundation/AppKit/CoreGraphics and clang++.'
    );
    const require = createRequire(sourceManifest);
    sourceRoot =
      options['--source-root'] ??
      path.dirname(require.resolve(`${sourcePackage}/package.json`));
    const readSource = (relative) => {
      const file = path.join(sourceRoot, relative),
        bytes = fs.readFileSync(file);
      sources.push({ path: file, relative, sha256: sha(bytes), bytes });
      return bytes.toString();
    };
    const readFixture = (url) => {
      const file = new URL(url),
        bytes = fs.readFileSync(file);
      fixtures.push({ path: file.pathname, sha256: sha(bytes), bytes });
      return bytes.toString();
    };
    const writeInput = (name, content) => {
      assert.equal(path.basename(name), name);
      fs.writeFileSync(path.join(directory, name), content);
    };
    const prepared = prepare({ readSource, readFixture, writeInput });
    metadata = prepared.metadata;
    const locate = (args) => {
      const result = invoke(
        'toolchain',
        '/usr/bin/xcrun',
        ['--sdk', 'macosx', ...args],
        10000
      );
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    const compiler = locate(['--find', 'clang++']),
      sdk = locate(['--show-sdk-path']);
    const executable = path.join(directory, 'controls');
    const compile = invoke(
      'compile',
      compiler,
      [
        '-isysroot',
        sdk,
        '-std=c++20',
        '-fobjc-arc',
        '-fblocks',
        ...prepared.frameworks.flatMap((value) => ['-framework', value]),
        ...(prepared.defines ?? []).map((value) => `-D${value}`),
        ...prepared.translationUnits.map((file) => path.join(directory, file)),
        '-I',
        directory,
        '-o',
        executable,
      ],
      180000
    );
    assert.equal(compile.status, 0, compile.stderr);
    const run = invoke('execute', executable, [], 10000);
    assert.ok(run.status === 0 || run.status === 1, run.stderr);
    phase = 'validate-output';
    const result = JSON.parse(run.stdout),
      records = result[recordsKey];
    assert.ok(Array.isArray(records));
    assert.equal(records.length, expectedCount);
    assert.equal(
      new Set(records.map((record) => record.name)).size,
      expectedCount
    );
    const passed = records.filter((record) => {
      assert.equal(typeof record.name, 'string');
      if (passField === 'status') {
        assert.ok(['PASS', 'FAIL'].includes(record.status));
        return record.status === 'PASS';
      }
      assert.equal(typeof record[passField], 'boolean');
      return record[passField];
    }).length;
    assert.equal(result.passed, passed);
    assert.equal(result.failed, expectedCount - passed);
    assert.equal(run.status, result.failed ? 1 : 0);
    for (const input of [...sources, ...fixtures])
      assert.equal(
        sha(fs.readFileSync(input.path)),
        input.sha256,
        `Source changed during execution: ${input.path}`
      );
    writeReport({ ...result, ...provenance(), compiler, sdk });
    console.log(
      JSON.stringify({
        name,
        passed,
        failed: result.failed,
        sourceRoot,
        boundary,
      })
    );
    if (result.failed) process.exitCode = 1;
  } catch (error) {
    // Preserve all extracted/generated compile inputs and compiler diagnostics.
    // Missing source/compile/runtime errors never become behavioral PASS.
    let retainedInputs = directory;
    if (options['--report']) {
      retainedInputs = `${options['--report']}.inputs`;
      fs.cpSync(directory, retainedInputs, { recursive: true });
    }
    writeReport({
      status: 'ERROR',
      phase,
      ...provenance(),
      retainedInputs,
      error: error instanceof Error ? error.stack : String(error),
    });
    console.error(
      `${name}: ${phase} ERROR; compile inputs retained at ${retainedInputs}`
    );
    process.exitCode = 2;
  } finally {
    if (options['--report'] || !process.exitCode)
      fs.rmSync(directory, { recursive: true, force: true });
  }
}
