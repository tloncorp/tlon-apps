import { describe, expect, it, vi } from 'vitest';

import { makeCreateOnce } from './createOnce';

class Refused extends Error {}

const task = { name: 'Morning news', schedule: { expr: '0 7 * * 1-5' } };

function setup() {
  let next = 0;
  const send = vi.fn<
    [{ bot: string; task: typeof task; requestId: string }],
    Promise<{ id: string }>
  >();
  const createOnce = makeCreateOnce({
    newRequestId: () => `request-${(next += 1)}`,
    send,
    isAnswer: (error) => error instanceof Refused,
  });
  const idsSent = () => send.mock.calls.map(([request]) => request.requestId);
  return { createOnce, send, idsSent };
}

describe('makeCreateOnce', () => {
  it('sends a create under a new request id', async () => {
    const { createOnce, send } = setup();
    send.mockResolvedValue({ id: 'job-1' });

    await expect(createOnce('~zod', task)).resolves.toEqual({ id: 'job-1' });
    expect(send).toHaveBeenCalledWith({
      bot: '~zod',
      task,
      requestId: 'request-1',
    });
  });

  it.each([
    ['is still pending', new Error('pending')],
    ['lost its connection', new TypeError('Network request failed')],
  ])('retries under the same id when the first try %s', async (_, failure) => {
    const { createOnce, send, idsSent } = setup();
    send.mockRejectedValueOnce(failure);
    send.mockRejectedValueOnce(failure);
    send.mockResolvedValue({ id: 'job-1' });

    await expect(createOnce('~zod', task)).rejects.toBe(failure);
    await expect(createOnce('~zod', { ...task })).rejects.toBe(failure);
    await expect(createOnce('~zod', task)).resolves.toEqual({ id: 'job-1' });
    expect(idsSent()).toEqual(['request-1', 'request-1', 'request-1']);
  });

  it('uses a new id once the bot has answered, either way', async () => {
    const { createOnce, send, idsSent } = setup();
    send.mockResolvedValueOnce({ id: 'job-1' });
    send.mockRejectedValueOnce(new Refused('invalid'));
    send.mockResolvedValueOnce({ id: 'job-2' });

    await createOnce('~zod', task);
    await expect(createOnce('~zod', task)).rejects.toBeInstanceOf(Refused);
    await createOnce('~zod', task);
    expect(idsSent()).toEqual(['request-1', 'request-2', 'request-3']);
  });

  it('sends a forgotten create as a new request, for that bot and task only', async () => {
    const { createOnce, send, idsSent } = setup();
    send.mockRejectedValue(new Error('pending'));
    const other = { ...task, name: 'Evening news' };

    await expect(createOnce('~zod', task)).rejects.toThrow();
    await expect(createOnce('~zod', other)).rejects.toThrow();
    await expect(createOnce('~bus', task)).rejects.toThrow();
    createOnce.forget('~zod', (unanswered) => unanswered.name === task.name);

    await expect(createOnce('~zod', task)).rejects.toThrow();
    await expect(createOnce('~zod', other)).rejects.toThrow();
    await expect(createOnce('~bus', task)).rejects.toThrow();
    expect(idsSent()).toEqual([
      'request-1',
      'request-2',
      'request-3',
      'request-4',
      'request-2',
      'request-3',
    ]);
  });

  it('does not let a late answer to a forgotten request settle the one that replaced it', async () => {
    const { createOnce, send, idsSent } = setup();
    let answerFirst = (_: { id: string }) => {};
    send.mockReturnValueOnce(
      new Promise((resolve) => {
        answerFirst = resolve;
      })
    );
    send.mockRejectedValue(new Error('pending'));

    const first = createOnce('~zod', task);
    createOnce.forget('~zod', () => true);
    await expect(createOnce('~zod', task)).rejects.toThrow();
    answerFirst({ id: 'job-1' });
    await first;

    await expect(createOnce('~zod', task)).rejects.toThrow();
    expect(idsSent()).toEqual(['request-1', 'request-2', 'request-2']);
  });

  it('keeps a different task, or the same task for another bot, apart', async () => {
    const { createOnce, send, idsSent } = setup();
    send.mockRejectedValue(new Error('pending'));

    await expect(createOnce('~zod', task)).rejects.toThrow();
    await expect(
      createOnce('~zod', { ...task, name: 'Evening news' })
    ).rejects.toThrow();
    await expect(createOnce('~bus', task)).rejects.toThrow();
    await expect(createOnce('~zod', task)).rejects.toThrow();
    expect(idsSent()).toEqual([
      'request-1',
      'request-2',
      'request-3',
      'request-1',
    ]);
  });
});
