import { BucketsActionFailed, type sendBucketsAction } from '@tloncorp/api';
import { describe, expect, it, vi } from 'vitest';

import { finishUpload, isFinishRefusal } from './bucketUploadFinish';

const flag = { host: '~zod', name: 'files' };

/** A sender that throws each Error in turn, and answers ok otherwise. */
function sender(...outcomes: unknown[]) {
  return vi.fn(async (..._args: Parameters<typeof sendBucketsAction>) => {
    const outcome = outcomes.shift();
    if (outcome instanceof Error) throw outcome;
    return { ok: null } as const;
  });
}

describe('finishUpload', () => {
  it('re-asks under the same request id when the answer is lost', async () => {
    const send = sender(new Error('network'), new Error('network'), 'ok');
    const sleep = vi.fn(async () => undefined);

    await finishUpload(flag, 'session-1', 'rid-1', { send, sleep });

    expect(send).toHaveBeenCalledTimes(3);
    for (const call of send.mock.calls) {
      expect(call).toEqual([
        { type: 'finish-upload', flag, sessionId: 'session-1' },
        'rid-1',
      ]);
    }
    expect(sleep.mock.calls).toEqual([[1000], [2000]]);
  });

  it('does not retry a typed refusal', async () => {
    const refusal = new BucketsActionFailed(
      'invalid-input',
      'upload session is not pending'
    );
    const send = sender(refusal);
    const sleep = vi.fn(async () => undefined);

    await expect(
      finishUpload(flag, 'session-1', 'rid-1', { send, sleep })
    ).rejects.toBe(refusal);
    expect(send).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('gives up with the last error once attempts run out', async () => {
    const last = new Error('still down');
    const send = sender(new Error('down'), last);

    await expect(
      finishUpload(flag, 'session-1', 'rid-1', {
        attempts: 2,
        send,
        sleep: async () => undefined,
      })
    ).rejects.toBe(last);
    expect(send).toHaveBeenCalledTimes(2);
  });
});

describe('isFinishRefusal', () => {
  it('treats a classified refusal as the file not being published', () => {
    expect(
      isFinishRefusal(
        new BucketsActionFailed(
          'invalid-input',
          'upload session is not pending'
        )
      )
    ).toBe(true);
  });

  it('leaves unknown and transport failures unresolved', () => {
    // What this ship answers when a remote host never replied.
    expect(
      isFinishRefusal(
        new BucketsActionFailed('unknown', 'the host did not answer in time')
      )
    ).toBe(false);
    expect(isFinishRefusal(new Error('network'))).toBe(false);
  });
});
