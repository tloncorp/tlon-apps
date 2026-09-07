#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// Read-only Simulator artifact collection. Build/verify with tlon-mobile-run,
// then dispatch the printed URL with Argent open-url before collecting.
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const udid = option('--udid');
const runId = option('--run-id');
const scenario = option('--scenario');
const bundleId = option('--bundle-id', 'io.tlon.groups.preview');
if (
  !udid ||
  !runId ||
  !/^[a-zA-Z0-9_-]+$/.test(runId) ||
  (scenario && !/^[a-zA-Z0-9_-]+$/.test(scenario))
) {
  console.error(
    'Usage: node scripts/collect-scroll-stability-ios.mjs --udid UDID --run-id ID [--scenario NAME] [--bundle-id ID] [--output DIR] [--timeout-ms MS]'
  );
  process.exit(2);
}
const timeoutMs = Number(option('--timeout-ms', '240000'));
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 600000) {
  throw new Error('timeout-ms must be between 1 and 600000');
}
const output = path.resolve(
  option('--output', `/private/tmp/tlon-scroll-stability/${runId}`)
);
const container = execFileSync(
  'xcrun',
  ['simctl', 'get_app_container', udid, bundleId, 'data'],
  { encoding: 'utf8' }
).trim();
const documents = path.join(container, 'Documents');
const suiteName = scenario
  ? `scroll-stability-${runId}-${scenario}.json`
  : `scroll-stability-suite-${runId}.json`;
console.log(`Collecting ${bundleId} on ${udid}, run ${runId}`);
console.log(
  `Dispatch with Argent open-url: ${bundleId}://scroll-stability?${scenario ? `scenario=${scenario}` : 'suite=core'}&runId=${runId}`
);
const start = Date.now();
let report;
while (Date.now() - start < timeoutMs) {
  try {
    report = JSON.parse(
      await readFile(path.join(documents, suiteName), 'utf8')
    );
    break;
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    await delay(500);
  }
}
if (!report)
  throw new Error(
    `No completed run ${runId} after ${timeoutMs} ms; no passing result inferred`
  );
if (
  report.runId !== runId ||
  report.platform !== 'ios' ||
  report.fixtureVersion !== 2 ||
  (scenario
    ? report.scenario !== scenario || !Array.isArray(report.samples)
    : !Array.isArray(report.results) || !report.results.length)
) {
  throw new Error(
    'Suite identity or result payload did not match the requested run'
  );
}
await mkdir(output, { recursive: true });
const names = (await readdir(documents)).filter(
  (name) => name === suiteName || name.startsWith(`scroll-stability-${runId}-`)
);
await Promise.all(
  names.map((name) =>
    copyFile(path.join(documents, name), path.join(output, name))
  )
);
const counts = { PASS: 0, FAIL: 0, INCOMPLETE: 0 };
for (const result of scenario ? [report] : report.results) {
  const observedVerdict = result.verdict ?? result.result?.verdict;
  const verdict = Object.hasOwn(counts, observedVerdict)
    ? observedVerdict
    : 'INCOMPLETE';
  counts[verdict]++;
  const issues = [
    ...new Set((result.result?.issues ?? []).map((issue) => issue.code)),
  ];
  console.log(
    `${verdict} ${result.scenario}${issues.length ? `: ${issues.join(', ')}` : ''}`
  );
}
await writeFile(
  path.join(output, 'collection.json'),
  JSON.stringify(
    {
      runId,
      scenario,
      udid,
      bundleId,
      collectedAt: new Date().toISOString(),
      counts,
      evidenceLevel: 'sampled-geometry',
      nativePresentation: 'INCOMPLETE',
      files: names,
    },
    null,
    2
  )
);
console.log(
  JSON.stringify({ output, counts, nativePresentation: 'INCOMPLETE' })
);
process.exitCode = counts.FAIL ? 1 : counts.INCOMPLETE ? 2 : 0;
