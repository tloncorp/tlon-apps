import { beforeEach, describe, expect, test, vi } from 'vitest';

const { trackError } = vi.hoisted(() => ({ trackError: vi.fn() }));

// Only the status helper is real: the rest of the package needs the
// native-module mocks sentry.test.ts carries, and none of it is under test.
vi.mock('@tloncorp/shared', async () => {
  const { httpStatusFromError } = (await vi.importActual(
    '../../../../packages/shared/src/errorReporting'
  )) as Pick<typeof import('@tloncorp/shared'), 'httpStatusFromError'>;
  return {
    createDevLogger: () => ({ trackError }),
    httpStatusFromError,
    queryClient: {},
  };
});
vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW: vi.fn() }));
vi.mock('@/state/kiln', () => ({ default: {}, usePike: vi.fn() }));

import { reportCheckFailed } from './useAppUpdates';

beforeEach(() => {
  trackError.mockClear();
});

describe('reportCheckFailed', () => {
  test('reports a non-OK Response by its status', () => {
    reportCheckFailed('pikes', new Response(null, { status: 503 }));

    expect(trackError).toHaveBeenCalledWith('app update check failed: pikes', {
      errorMessage: 'HTTP 503',
      status: 503,
    });
  });

  test('reports an Error by its message', () => {
    reportCheckFailed('serviceWorker', new Error('Failed to fetch'));

    expect(trackError).toHaveBeenCalledWith(
      'app update check failed: serviceWorker',
      { errorMessage: 'Failed to fetch', status: null }
    );
  });

  test('reports the status an Error carries', () => {
    reportCheckFailed('pikes', Object.assign(new Error('x'), { status: 502 }));

    expect(trackError).toHaveBeenCalledWith('app update check failed: pikes', {
      errorMessage: 'x',
      status: 502,
    });
  });
});
