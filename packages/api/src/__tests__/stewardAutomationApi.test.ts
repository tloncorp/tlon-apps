import { beforeEach, describe, expect, test, vi } from 'vitest';

import { requestJson, scry, subscribe } from '../client/urbit';
import {
  StewardAutomationEditError,
  StewardAutomationPendingError,
  awaitAutomationRequest,
  createAutomation,
  deleteAutomation,
  getAutomationRequest,
  getAutomations,
  scryAutomations,
  subscribeToAutomations,
  updateAutomation,
} from '../index';

vi.mock('../client/urbit', () => ({
  requestJson: vi.fn(),
  scry: vi.fn(),
  subscribe: vi.fn().mockResolvedValue(7),
}));

const bot = '~rapsed-podlec-nocsyx-lassul';
const requestId = '0v4.jd3o0';
const task = {
  name: 'e2e status',
  enabled: true,
  schedule: { kind: 'cron' as const, expr: '0 9 * * *', tz: 'UTC' },
  sessionTarget: 'isolated',
  wakeMode: 'now',
  payload: { kind: 'agentTurn', message: 'Send the daily status.' },
};

beforeEach(() => {
  vi.mocked(requestJson).mockReset();
  vi.mocked(scry).mockReset();
  vi.mocked(subscribe).mockClear();
});

describe('createAutomation', () => {
  test('posts the edit and resolves with the created id', async () => {
    vi.mocked(requestJson).mockResolvedValue({
      requestId,
      body: { type: 'created', id: 'job-1' },
    });

    await expect(createAutomation({ bot, task })).resolves.toEqual({
      requestId,
      id: 'job-1',
    });
    expect(requestJson).toHaveBeenCalledWith(
      '/steward/~/v1/automation',
      'POST',
      { bot, action: { create: task } }
    );
  });

  test('passes a client-supplied request id through', async () => {
    vi.mocked(requestJson).mockResolvedValue({
      requestId,
      body: { type: 'created', id: 'job-1' },
    });

    await createAutomation({ bot, task, requestId });

    expect(requestJson).toHaveBeenCalledWith(
      '/steward/~/v1/automation',
      'POST',
      { requestId, bot, action: { create: task } }
    );
  });

  test('throws a typed error carrying the wire errorType and message', async () => {
    vi.mocked(requestJson).mockResolvedValue({
      requestId,
      body: {
        type: 'error',
        errorType: 'harness-offline',
        message: [],
      },
    });

    const error = await createAutomation({ bot, task }).catch((e) => e);
    expect(error).toBeInstanceOf(StewardAutomationEditError);
    expect(error).toMatchObject({
      errorType: 'harness-offline',
      requestId,
      message: '%steward automation error (harness-offline)',
    });
  });

  test('joins a multi-line tang into the message', async () => {
    vi.mocked(requestJson).mockResolvedValue({
      requestId,
      body: {
        type: 'error',
        errorType: 'harness-error',
        message: ['main cron jobs require payload.kind="systemEvent"'],
      },
    });

    await expect(createAutomation({ bot, task })).rejects.toThrow(
      '%steward automation error (harness-error): main cron jobs require payload.kind="systemEvent"'
    );
  });

  test('throws a pending error carrying the request id and poke status', async () => {
    vi.mocked(requestJson).mockResolvedValue({
      requestId,
      body: { type: 'pending', status: 'acked' },
    });

    const error = await createAutomation({ bot, task }).catch((e) => e);
    expect(error).toBeInstanceOf(StewardAutomationPendingError);
    expect(error).toMatchObject({ requestId, status: 'acked' });
  });

  test('rejects a malformed envelope', async () => {
    vi.mocked(requestJson).mockResolvedValue({ nope: true });

    await expect(createAutomation({ bot, task })).rejects.toThrow(
      'Unexpected %steward automation response'
    );
  });
});

describe('updateAutomation and deleteAutomation', () => {
  test('update sends the id beside the patch fields', async () => {
    vi.mocked(requestJson).mockResolvedValue({
      requestId,
      body: { type: 'updated', id: 'job-1' },
    });

    await expect(
      updateAutomation({ bot, id: 'job-1', task: { enabled: false } })
    ).resolves.toEqual({ requestId, id: 'job-1' });
    expect(requestJson).toHaveBeenCalledWith(
      '/steward/~/v1/automation',
      'POST',
      { bot, action: { update: { id: 'job-1', enabled: false } } }
    );
  });

  test('delete sends only the id', async () => {
    vi.mocked(requestJson).mockResolvedValue({
      requestId,
      body: { type: 'deleted', id: 'job-1' },
    });

    await expect(deleteAutomation({ bot, id: 'job-1' })).resolves.toEqual({
      requestId,
      id: 'job-1',
    });
    expect(requestJson).toHaveBeenCalledWith(
      '/steward/~/v1/automation',
      'POST',
      { bot, action: { delete: { id: 'job-1' } } }
    );
  });
});

describe('getAutomationRequest and awaitAutomationRequest', () => {
  test('getAutomationRequest returns a pending envelope without throwing', async () => {
    vi.mocked(requestJson).mockResolvedValue({
      requestId,
      body: { type: 'pending', status: 'sending' },
    });

    await expect(getAutomationRequest(requestId)).resolves.toEqual({
      requestId,
      body: { type: 'pending', status: 'sending' },
    });
    expect(requestJson).toHaveBeenCalledWith(
      `/steward/~/v1/automation/request/${requestId}`,
      'GET'
    );
  });

  test('awaitAutomationRequest polls until terminal', async () => {
    vi.mocked(requestJson)
      .mockResolvedValueOnce({
        requestId,
        body: { type: 'pending', status: 'acked' },
      })
      .mockResolvedValueOnce({
        requestId,
        body: { type: 'deleted', id: 'job-1' },
      });

    await expect(
      awaitAutomationRequest(requestId, { intervalMs: 0 })
    ).resolves.toEqual({ requestId, id: 'job-1' });
    expect(requestJson).toHaveBeenCalledTimes(2);
  });

  test('awaitAutomationRequest gives up as pending after its attempts', async () => {
    vi.mocked(requestJson).mockResolvedValue({
      requestId,
      body: { type: 'pending', status: 'acked' },
    });

    const error = await awaitAutomationRequest(requestId, {
      intervalMs: 0,
      attempts: 3,
    }).catch((e) => e);
    expect(error).toBeInstanceOf(StewardAutomationPendingError);
    expect(error).toMatchObject({ requestId, status: 'acked' });
    expect(requestJson).toHaveBeenCalledTimes(3);
  });
});

describe('reads', () => {
  test('getAutomations reads the mirror over HTTP', async () => {
    const mirror = { [bot]: { 'job-1': task } };
    vi.mocked(requestJson).mockResolvedValue(mirror);

    await expect(getAutomations()).resolves.toEqual(mirror);
    expect(requestJson).toHaveBeenCalledWith(
      '/steward/~/v1/automation/tasks',
      'GET'
    );
  });

  test('scryAutomations reads the mirror via scry', async () => {
    const mirror = { [bot]: {} };
    vi.mocked(scry).mockResolvedValue(mirror);

    await expect(scryAutomations()).resolves.toEqual(mirror);
    expect(scry).toHaveBeenCalledWith({
      app: 'steward',
      path: '/v1/automation/tasks',
    });
  });

  test('subscribeToAutomations subscribes to the tasks feed', async () => {
    const handler = vi.fn();

    await expect(subscribeToAutomations(handler)).resolves.toBe(7);
    expect(subscribe).toHaveBeenCalledWith(
      { app: 'steward', path: '/v1/automation/tasks' },
      handler
    );
  });
});
