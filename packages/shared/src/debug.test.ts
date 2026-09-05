import { beforeEach, expect, test, vi } from 'vitest';

import { clearBreadcrumbs, createDevLogger, useDebugStore } from './debug';

let capture: ReturnType<typeof vi.fn>;

beforeEach(() => {
  capture = vi.fn();
  useDebugStore.getState().initializeErrorLogger({ capture });
  useDebugStore.setState({ debugBreadcrumbs: [] });
});

test('trackError with an Error argument captures the full payload', async () => {
  const logger = createDevLogger('t', false);
  const error = new TypeError('x');
  logger.trackError('boom', error);
  await vi.waitFor(() => expect(capture).toHaveBeenCalled());
  const [event, payload] = capture.mock.calls[0];
  expect(event).toBe('app_error');
  expect(payload.errorObject).toBe(error);
  expect(payload.logger).toBe('t');
  expect(payload.errorTitle).toBe('boom');
  expect(payload.message).toBe('[t] boom');
  expect(payload.errorMessage).toBe('x');
  expect(typeof payload.errorStack).toBe('string');
});

test('trackError extracts the error from { error } data', async () => {
  const logger = createDevLogger('t', false);
  const error = new Error('nested');
  logger.trackError('boom', { error });
  await vi.waitFor(() => expect(capture).toHaveBeenCalled());
  expect(capture.mock.calls[0][1].errorObject).toBe(error);
});

test('trackError extracts the error from { stack } data', async () => {
  const logger = createDevLogger('t', false);
  const error = new Error('stacked');
  logger.trackError('boom', { stack: error });
  await vi.waitFor(() => expect(capture).toHaveBeenCalled());
  expect(capture.mock.calls[0][1].errorObject).toBe(error);
});

test('trackError custom props cannot overwrite protected fields', async () => {
  const logger = createDevLogger('t', false);
  logger.trackError('boom', {
    logger: 'evil',
    errorTitle: 'evil',
    errorObject: new Error('evil'),
  });
  await vi.waitFor(() => expect(capture).toHaveBeenCalled());
  const payload = capture.mock.calls[0][1];
  expect(payload.logger).toBe('t');
  expect(payload.errorTitle).toBe('boom');
  expect(payload.errorObject).toBeUndefined();
});

test('trackError without data', async () => {
  const logger = createDevLogger('t', false);
  logger.trackError('boom');
  await vi.waitFor(() => expect(capture).toHaveBeenCalled());
  const payload = capture.mock.calls[0][1];
  expect(payload.errorObject).toBeUndefined();
  expect(payload.errorTitle).toBe('boom');
});

test('trackError breadcrumbs exclude sensitive crumbs', async () => {
  const logger = createDevLogger('t', false);
  logger.crumb('visited', 'x');
  logger.sensitiveCrumb('token abc');
  logger.trackError('boom');
  await vi.waitFor(() => expect(capture).toHaveBeenCalled());
  const payload = capture.mock.calls[0][1];
  expect(
    payload.breadcrumbs.some((entry: string) => entry.includes('visited x'))
  ).toBe(true);
  expect(
    payload.breadcrumbs.some((entry: string) => entry.includes('token abc'))
  ).toBe(false);
});

test('clearBreadcrumbs empties the store', () => {
  const logger = createDevLogger('t', false);
  logger.crumb('a');
  logger.sensitiveCrumb('b');
  expect(useDebugStore.getState().getBreadcrumbs().length).toBe(2);
  clearBreadcrumbs();
  expect(useDebugStore.getState().getBreadcrumbs()).toEqual([]);
});

test('getBreadcrumbs filters sensitive entries when opted out', () => {
  const logger = createDevLogger('t', false);
  logger.crumb('visited', 'x');
  logger.sensitiveCrumb('token abc');
  const breadcrumbs = useDebugStore.getState().getBreadcrumbs();
  expect(breadcrumbs.some((entry) => entry.includes('token abc'))).toBe(true);
  const sanitized = useDebugStore
    .getState()
    .getBreadcrumbs({ includeSensitive: false });
  expect(sanitized.some((entry) => entry.includes('token abc'))).toBe(false);
  expect(sanitized.some((entry) => entry.includes('visited x'))).toBe(true);
});
