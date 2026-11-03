import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// monitorTlonProvider is not unit-testable (see bot-info.test.ts), so its
// startup and teardown ordering is pinned at the source level. The helpers
// it relies on (defaultSleep, createNudgeScheduler) have their own behavior
// tests; these pin that the monitor actually uses them.
const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.resolve(here, './index.ts'), 'utf8');

function between(start: string, end: string): string {
  const from = source.indexOf(start);
  expect(from, start).toBeGreaterThan(-1);
  const to = source.indexOf(end, from + start.length);
  expect(to, end).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe('monitor lifecycle wiring', () => {
  it('stops bootstrapping when the monitor was aborted during connect', () => {
    const afterConnect = source.slice(source.indexOf('await api.connect();'));
    expect(afterConnect).toMatch(
      /^await api\.connect\(\);\s*if \(opts\.abortSignal\?\.aborted\) \{\s*return;\s*\}/
    );
  });

  it('runs the periodic refreshes through single-flight schedulers joined in teardown', () => {
    expect(source).not.toMatch(/setInterval\(/);
    const teardown = between(
      '    } finally {\n      // Gateway-status teardown via the idempotent helper.',
      'await api?.close();'
    );
    const join = teardown.search(
      /await Promise\.all\(\s*intervalSchedulers\.map\(\(scheduler\) => scheduler\.stop\(\)\)\s*\);/
    );
    expect(join).toBeGreaterThan(-1);
    // Ahead of the drains a tick can feed (onboarding scans, campaign checks,
    // settings refreshes) and of api.close().
    for (const later of [
      'drainingAgentOnboarding = true;',
      'await campaign?.stop();',
      'await groupChannelJournal?.close();',
    ]) {
      expect(teardown.indexOf(later), later).toBeGreaterThan(join);
    }

    // Both loops must start on the live (non-aborted) path: registered for
    // the teardown join first, then started, all before the abort wait.
    const live = between(
      'await api.connect();\n      if (opts.abortSignal?.aborted) {',
      '    } finally {\n      // Gateway-status teardown via the idempotent helper.'
    );
    const push = live.indexOf(
      'intervalSchedulers.push(channelRefresh, settingsRefresh);'
    );
    const abortWait = live.indexOf('const onAbort = () => {');
    expect(push).toBeGreaterThan(-1);
    for (const start of [
      'channelRefresh.start();',
      'settingsRefresh.start();',
    ]) {
      const at = live.indexOf(start);
      expect(at, start).toBeGreaterThan(push);
      expect(at, start).toBeLessThan(abortWait);
    }
  });

  it('sleeps between auth retries with the listener-cleaning abortable sleep', () => {
    const retry = between(
      'async function authenticateWithRetry(',
      '\n  // Map a subscription'
    );
    expect(retry).toMatch(/await defaultSleep\(delay, opts\.abortSignal\);/);
    expect(retry).not.toMatch(/addEventListener\(/);
  });
});
