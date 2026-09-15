import test from 'node:test';
import assert from 'node:assert/strict';
import { fallbackReport } from './fallback-report.mjs';

test('pending operator results are explicitly incomplete and retained only as unreviewed observations', () => {
  const raw =
    '**PR verification: passed**\nOperator observed a pass and possible failure.';
  const report = fallbackReport(raw, true);
  assert.match(report, /^\*\*Review incomplete/);
  assert.ok(
    report.indexOf('<summary>Unreviewed operator observations') <
      report.indexOf(raw)
  );
  assert.equal(
    fallbackReport('Documentation-only skip', false),
    'Documentation-only skip'
  );
});
