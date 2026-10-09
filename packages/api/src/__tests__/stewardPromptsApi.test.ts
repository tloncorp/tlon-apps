import { beforeEach, expect, test, vi } from 'vitest';
import {
  DeskUnsupportedError,
  getDeskSupportsStewardPromptsState,
  requestJson,
  subscribe,
} from '../client/urbit';
import {
  setStewardPrompt,
  getStewardPromptRequest,
  awaitStewardPromptRequest,
  getStewardPromptFiles,
  PromptsUnsupportedError,
  subscribeToStewardPrompts,
  StewardPromptEditError,
  StewardPromptPendingError,
} from '../client/stewardPromptsApi';
vi.mock('../client/urbit', () => ({
  // The registry helpers throw it for a guard that is off.
  DeskUnsupportedError: class DeskUnsupportedError extends Error {},
  getDeskSupportsStewardPromptsState: vi.fn(),
  requestJson: vi.fn(),
  subscribe: vi.fn(),
}));
const requestId = '0v4.jd3o0';
const pending = { requestId, body: { type: 'pending', status: 'acked' } };
const updated = { requestId, body: { type: 'updated', name: 'SOUL.md' } };
beforeEach(() => {
  vi.resetAllMocks();
});
test('posts an edit and waits for the workspace result', async () => {
  vi.mocked(requestJson).mockResolvedValue(updated);
  await expect(
    setStewardPrompt({ bot: '~bus', name: 'SOUL.md', text: 'new', requestId })
  ).resolves.toEqual({ requestId, name: 'SOUL.md' });
  expect(requestJson).toHaveBeenCalledWith(
    '/steward/~/v1/prompts',
    'POST',
    {
      requestId,
      bot: '~bus',
      action: { set: { name: 'SOUL.md', text: 'new' } },
    },
    { reauthStatuses: [401] }
  );
});
test('pending preserves the request id for later retrieval', async () => {
  vi.mocked(requestJson).mockResolvedValue(pending);
  await expect(
    setStewardPrompt({ bot: '~bus', name: 'SOUL.md', text: 'new' })
  ).rejects.toMatchObject({
    name: 'StewardPromptPendingError',
    requestId,
    status: 'acked',
  });
  await expect(getStewardPromptRequest(requestId)).resolves.toEqual(pending);
});
test('polls pending until the terminal answer arrives', async () => {
  vi.mocked(requestJson)
    .mockResolvedValueOnce(pending)
    .mockResolvedValueOnce(updated);
  await expect(
    awaitStewardPromptRequest(requestId, { intervalMs: 0 })
  ).resolves.toEqual({ requestId, name: 'SOUL.md' });
});
test('awaitStewardPromptRequest passes its signal through and stops when aborted', async () => {
  vi.mocked(requestJson).mockReset();
  const controller = new AbortController();
  vi.mocked(requestJson).mockImplementation(async () => {
    controller.abort();
    return pending;
  });
  await expect(
    awaitStewardPromptRequest(requestId, {
      intervalMs: 60_000,
      signal: controller.signal,
    })
  ).rejects.toBeDefined();
  expect(requestJson).toHaveBeenCalledTimes(1);
  expect(requestJson).toHaveBeenCalledWith(
    `/steward/~/v1/prompts/request/${requestId}`,
    'GET',
    undefined,
    { reauthStatuses: [401], signal: controller.signal }
  );
});
test('poll exhaustion remains pending', async () => {
  vi.mocked(requestJson).mockResolvedValue(pending);
  await expect(
    awaitStewardPromptRequest(requestId, { attempts: 1 })
  ).rejects.toBeInstanceOf(StewardPromptPendingError);
});
test('polling rides out a transient failure and still settles', async () => {
  vi.mocked(requestJson)
    .mockRejectedValueOnce(new Error('network blip'))
    .mockResolvedValueOnce(updated);
  await expect(
    awaitStewardPromptRequest(requestId, { attempts: 3, intervalMs: 0 })
  ).resolves.toEqual({ requestId, name: 'SOUL.md' });
});
test('a terminal error still surfaces instead of being polled through', async () => {
  vi.mocked(requestJson).mockResolvedValue({
    requestId,
    body: { type: 'error', errorType: 'not-authorized', message: ['nope'] },
  });
  await expect(
    awaitStewardPromptRequest(requestId, { attempts: 3, intervalMs: 0 })
  ).rejects.toBeInstanceOf(StewardPromptEditError);
});
test('harness failures remain typed errors', async () => {
  vi.mocked(requestJson).mockResolvedValue({
    requestId,
    body: {
      type: 'error',
      errorType: 'harness-offline',
      message: [],
    },
  });
  await expect(
    setStewardPrompt({ bot: '~bus', name: 'SOUL.md', text: 'new' })
  ).rejects.toBeInstanceOf(StewardPromptEditError);
});
test('rejects malformed response envelopes', async () => {
  vi.mocked(requestJson).mockResolvedValue({
    requestId,
    body: { type: 'updated' },
  });
  await expect(getStewardPromptRequest(requestId)).rejects.toThrow();
});
test('reads and subscribes to projections independently of edit results', async () => {
  const files = { '~bus': { 'SOUL.md': 'old' } };
  vi.mocked(requestJson).mockResolvedValue(files);
  await expect(getStewardPromptFiles()).resolves.toEqual(files);
  const handler = vi.fn();
  const onQuit = vi.fn();
  await subscribeToStewardPrompts(handler, onQuit);
  expect(subscribe).toHaveBeenCalledWith(
    { app: 'steward', path: '/v1/prompts/files' },
    handler,
    undefined,
    { onQuit }
  );
});
test('an unbound prompts path reports an unsupported endpoint', async () => {
  vi.mocked(requestJson).mockRejectedValue(
    Object.assign(new Error('HTTP 404'), { status: 404 })
  );
  await expect(getStewardPromptFiles()).rejects.toBeInstanceOf(
    PromptsUnsupportedError
  );
});
test('a desk without the prompts module is refused before anything is sent', async () => {
  vi.mocked(getDeskSupportsStewardPromptsState).mockReturnValue(false);
  await expect(getStewardPromptFiles()).rejects.toBeInstanceOf(
    DeskUnsupportedError
  );
  await expect(
    setStewardPrompt({ bot: '~bus', name: 'SOUL.md', text: 'new' })
  ).rejects.toBeInstanceOf(DeskUnsupportedError);
  // rejects rather than throwing, so a caller's .catch still hears it
  const subscription = subscribeToStewardPrompts(vi.fn());
  await expect(subscription).rejects.toBeInstanceOf(DeskUnsupportedError);
  expect(requestJson).not.toHaveBeenCalled();
  expect(subscribe).not.toHaveBeenCalled();
});
