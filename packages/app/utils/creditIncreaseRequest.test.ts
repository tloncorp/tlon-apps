import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  completed: {} as Record<string, string>,
  getValue: vi.fn(),
  setValue: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock('@tloncorp/shared/db', () => ({
  creditIncreaseRequested: {
    getValue: mocks.getValue,
    setValue: mocks.setValue,
  },
}));
vi.mock('../constants', () => ({
  POST_HOG_API_KEY: 'test-key',
}));

import { submitCreditIncreaseRequest } from './creditIncreaseRequest';

const request = {
  ownerShip: '~zod',
  botShip: '~zod-bot',
  sourcePostId: 'notice-post',
  requestId: '697e119d-26da-4df7-a131-89f8a816a7dd',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.completed = {};
  mocks.getValue.mockImplementation(async () => mocks.completed);
  mocks.setValue.mockImplementation(async (update) => {
    mocks.completed = update(mocks.completed);
  });
  mocks.fetch.mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', mocks.fetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

it('only marks the card completed after the remote request succeeds', async () => {
  let deliver!: (value: { ok: boolean }) => void;
  mocks.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        deliver = resolve;
      })
  );
  const pending = submitCreditIncreaseRequest(request);
  await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
  expect(mocks.setValue).not.toHaveBeenCalled();
  deliver({ ok: true });
  await pending;
  expect(mocks.completed).toEqual({ 'notice-post': request.requestId });
  const body = JSON.parse(mocks.fetch.mock.calls[0][1].body);
  expect(body.batch).toEqual([
    expect.objectContaining({
      event: 'TlonBot Credit Increase Requested',
      uuid: request.requestId,
      distinct_id: request.ownerShip,
      properties: {
        ...request,
        source: 'budget_hold',
        requestedFrom: 'tlon_app',
      },
    }),
  ]);
});

it('deduplicates simultaneous taps and subsequent taps using local KV', async () => {
  await Promise.all([
    submitCreditIncreaseRequest(request),
    submitCreditIncreaseRequest(request),
  ]);
  await submitCreditIncreaseRequest({
    ...request,
    sourcePostId: 'redelivered-notice',
  });
  expect(mocks.fetch).toHaveBeenCalledOnce();
  expect(mocks.completed['redelivered-notice']).toBe(request.requestId);
});

it.each(['network', 'http'])(
  'leaves a failed %s submission retryable',
  async (failure) => {
    if (failure === 'network')
      mocks.fetch.mockRejectedValueOnce(new Error('offline'));
    else mocks.fetch.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(submitCreditIncreaseRequest(request)).rejects.toThrow();
    expect(mocks.setValue).not.toHaveBeenCalled();
    await submitCreditIncreaseRequest(request);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.completed['notice-post']).toBe(request.requestId);
  }
);

it('reuses the event UUID after a local receipt write fails', async () => {
  mocks.setValue.mockRejectedValueOnce(new Error('storage unavailable'));
  await expect(submitCreditIncreaseRequest(request)).rejects.toThrow();
  await submitCreditIncreaseRequest(request);
  const ids = mocks.fetch.mock.calls.map(
    ([, init]) => JSON.parse(init.body).batch[0].uuid
  );
  expect(ids).toEqual([request.requestId, request.requestId]);
});

it('accepts a request from a local bot without the hosted naming convention', async () => {
  await submitCreditIncreaseRequest({ ...request, botShip: '~local-bot' });
  expect(mocks.fetch).toHaveBeenCalledOnce();
  const event = JSON.parse(mocks.fetch.mock.calls[0][1].body).batch[0];
  expect(event.properties.ownerShip).toBe(request.ownerShip);
  expect(event.properties.botShip).toBe('~local-bot');
  expect(mocks.completed['notice-post']).toBe(request.requestId);
});
