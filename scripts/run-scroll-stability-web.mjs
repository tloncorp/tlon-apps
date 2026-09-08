#!/usr/bin/env node
import { spawn } from 'node:child_process';
import {
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  assetHash,
  verifyCurrentWebBuild,
} from './scroll-stability-web-assets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const web = resolve(root, 'apps/tlon-web');
const require = createRequire(resolve(web, 'package.json'));
const json = (path, value) =>
  writeFileSync(path, JSON.stringify(value, null, 2));

// Readers are execution inputs, independent of the already-built application.
export function snapshotReaders(directory = resolve(root, 'scripts')) {
  return readdirSync(directory)
    .filter(
      (name) =>
        name === 'run-scroll-stability-web.mjs' ||
        /^scroll-stability-.*\.[cm]js$/.test(name)
    )
    .sort()
    .map((name) => ({
      path: `scripts/${name}`,
      sha256: assetHash(readFileSync(resolve(directory, name))),
    }));
}

export function runProcess(args, { log, env, timeout }) {
  const fd = openSync(log, 'wx');
  return new Promise((fulfill, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: web,
      env,
      stdio: ['ignore', fd, fd],
      ...(timeout ? { timeout } : {}),
    });
    let cancelled = false;
    const cancel = () => {
      child.kill(cancelled ? 'SIGKILL' : 'SIGINT');
      cancelled = true;
    };
    const removeListeners = () => {
      process.off('SIGINT', cancel);
      process.off('SIGTERM', cancel);
    };
    process.on('SIGINT', cancel);
    process.on('SIGTERM', cancel);
    child.once('error', (error) => {
      removeListeners();
      reject(error);
    });
    child.once('close', (code, signal) => {
      removeListeners();
      closeSync(fd);
      fulfill({ code, signal, cancelled });
    });
  });
}

export function selectedTests(report) {
  const count = (suite) =>
    (suite.specs ?? []).reduce(
      (sum, spec) => sum + (spec.tests?.length ?? 0),
      0
    ) + (suite.suites ?? []).reduce((sum, child) => sum + count(child), 0);
  if (report.errors?.length)
    throw new Error('Playwright selection has errors; see selection.json');
  const total = count(report);
  if (!total)
    throw new Error('The selector matched no tests; no browser was opened');
  return total;
}

/** One existing build, one exact selection, one capture, one independent replay. */
export async function runWebIteration(
  { grep, receipt: receiptPath, output },
  overrides = {}
) {
  if (!grep || !isAbsolute(receiptPath ?? '') || !isAbsolute(output ?? ''))
    throw new Error(
      'Provide --grep REGEX --receipt ABSOLUTE_JSON --output NEW_ABSOLUTE_DIR'
    );
  new RegExp(grep);
  // Run artifacts must not change the source snapshot they are measuring.
  output = resolve(realpathSync(dirname(output)), basename(output));
  const fromRoot = relative(root, resolve(output));
  if (!fromRoot.startsWith('../'))
    throw new Error('Keep run output outside the checkout');
  mkdirSync(output);
  const state = {
    startedAt: Date.now(),
    grep,
    receiptPath,
    output,
    phases: [],
    exitCode: 1,
  };
  const save = () => json(resolve(output, 'run.json'), state);
  const phase = async (name, action) => {
    const entry = { name, startedAt: Date.now() };
    state.phases.push(entry);
    save();
    process.stdout.write(`Scroller: ${name}\n`);
    try {
      return await action();
    } catch (error) {
      entry.error = String(error);
      throw error;
    } finally {
      entry.completedAt = Date.now();
      entry.durationMs = entry.completedAt - entry.startedAt;
      save();
    }
  };
  const verify = overrides.verify ?? verifyCurrentWebBuild;
  const run = overrides.run ?? runProcess;
  const readers = overrides.snapshotReaders ?? snapshotReaders;
  let receipt, before, replay, readersBefore;
  try {
    await phase('preflight', async () => {
      receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
      json(resolve(output, 'build-receipt.json'), receipt);
      before = verify(receipt, root);
      json(resolve(output, 'build-check-before.json'), before);
      readersBefore = readers();
      json(resolve(output, 'readers-before.json'), readersBefore);
      // Resolve imports before opening Chromium; a broken reader must fail here.
      replay =
        overrides.replay ??
        (await import('./scroll-stability-web-evidence.mjs'));
    });
    const cli = require.resolve('@playwright/test/cli');
    const args = [
      cli,
      'test',
      '--config=playwright.scroller-product.config.ts',
      '--grep',
      grep,
    ];
    const env = {
      ...process.env,
      USE_PRODUCTION_BUILD: 'true',
      SCROLLER_WEB_BUILD_RECEIPT: receiptPath,
      SCROLLER_HEADED: '0',
    };
    await phase('selection', async () => {
      const result = await run([...args, '--list', '--reporter=json'], {
        env: {
          ...env,
          PLAYWRIGHT_JSON_OUTPUT_NAME: resolve(output, 'selection.json'),
        },
        log: resolve(output, 'selection.log'),
        timeout: 30_000,
      });
      if (result.code !== 0 || result.cancelled)
        throw new Error(
          `Selection failed (${result.code ?? result.signal}); see selection.log`
        );
      state.selectedTests = selectedTests(
        JSON.parse(readFileSync(resolve(output, 'selection.json'), 'utf8'))
      );
    });
    const reportPath = resolve(output, 'playwright.json');
    const result = await phase('capture', () =>
      run([...args, '--output', resolve(output, 'artifacts')], {
        env: { ...env, PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath },
        log: resolve(output, 'playwright.log'),
      })
    );
    state.playwright = result;
    // Preserve and replay failures too. A green producer alone is insufficient.
    await phase('replay', async () => {
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      const records = replay.readPlaywrightReport(report, reportPath);
      const results = records.map((record) => ({
        title: record.title,
        scenario: record.scenario,
        reportedStatus: record.reportedStatus,
        ...replay.assessWebEvidence(record),
      }));
      json(resolve(output, 'replay.json'), results);
      state.verdicts = results.map(({ title, status }) => ({ title, status }));
      if (results.length !== state.selectedTests || report.errors?.length)
        throw new Error(
          'Capture did not produce one result per selected test; see playwright.json'
        );
      if (
        results.some(
          ({ status }) =>
            !['recorded-sampled-pass', 'observed'].includes(status)
        )
      )
        throw new Error(
          'Replay contains failed, incomplete or unrun evidence; see replay.json'
        );
    });
    if (result.code !== 0 || result.cancelled)
      throw new Error(
        `Playwright failed (${result.code ?? result.signal}); see playwright.log`
      );
    state.exitCode = 0;
  } catch (error) {
    state.error = String(error);
  } finally {
    if (before) {
      try {
        await phase('final-source-check', async () => {
          const after = verify(receipt, root);
          json(resolve(output, 'build-check-after.json'), after);
          const readersAfter = readers();
          json(resolve(output, 'readers-after.json'), readersAfter);
          if (JSON.stringify(readersAfter) !== JSON.stringify(readersBefore))
            throw new Error(
              'Runner or evidence reader changed during this run'
            );
          if (after.sourceDigest !== before.sourceDigest)
            throw new Error(
              'Application or test source changed during this run'
            );
        });
      } catch (error) {
        state.exitCode = 1;
        state.finalCheckError = String(error);
      }
    }
    state.completedAt = Date.now();
    state.durationMs = state.completedAt - state.startedAt;
    save();
  }
  if (state.error) process.stderr.write(`${state.error}\n`);
  if (state.finalCheckError) process.stderr.write(`${state.finalCheckError}\n`);
  process.stdout.write(
    `Scroller: ${state.exitCode === 0 ? 'finished' : 'needs attention'} in ${(state.durationMs / 1000).toFixed(1)}s; ${output}\n`
  );
  return state;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const args = process.argv.slice(2);
  const options = {};
  try {
    if (args.length !== 6) throw new Error('Expected three named arguments');
    for (let index = 0; index < args.length; index += 2) {
      const key = args[index].replace(/^--/, '');
      if (
        !args[index].startsWith('--') ||
        !['grep', 'receipt', 'output'].includes(key) ||
        options[key] !== undefined
      )
        throw new Error(`Unknown or repeated option: ${args[index]}`);
      options[key] = args[index + 1];
    }
    process.exitCode = (await runWebIteration(options)).exitCode;
  } catch (error) {
    process.stderr.write(
      `${String(error)}\nUsage: node scripts/run-scroll-stability-web.mjs --grep REGEX --receipt ABSOLUTE_JSON --output NEW_ABSOLUTE_DIR\n`
    );
    process.exitCode = 1;
  }
}
