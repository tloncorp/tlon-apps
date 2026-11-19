import { expect, it, vi } from 'vitest';

import { reportHarnessDiagnostic } from '../index.js';
import { reportHarnessError } from './telemetry.js';

vi.mock('./telemetry.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./telemetry.js')>()),
  reportHarnessError: vi.fn(),
}));

it('reports only critical memory pressure as a harness error', () => {
  const event = { type: 'diagnostic.memory.pressure', reason: 'rss_threshold' };
  reportHarnessDiagnostic({ ...event, level: 'warning' });
  expect(reportHarnessError).not.toHaveBeenCalled();

  reportHarnessDiagnostic({ ...event, level: 'critical' });
  expect(reportHarnessError).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      errorCategory: 'memory_pressure',
      outcome: 'critical',
      failureKind: 'rss_threshold',
    })
  );
});
