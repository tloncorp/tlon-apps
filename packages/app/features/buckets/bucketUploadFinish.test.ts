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
  it('re-asks once under the same request id when the answer is lost', async () => {
    const send = sender(new Error('network'), 'ok');

    await finishUpload(flag, 'session-1', 'rid-1', send);

    expect(send.mock.calls).toEqual([
      [{ type: 'finish-upload', flag, sessionId: 'session-1' }, 'rid-1'],
      [{ type: 'finish-upload', flag, sessionId: 'session-1' }, 'rid-1'],
    ]);
  });

  it('does not re-ask a typed answer', async () => {
    const refusal = new BucketsActionFailed(
      'unknown',
      'the host did not answer in time'
    );
    const send = sender(refusal);

    await expect(finishUpload(flag, 'session-1', 'rid-1', send)).rejects.toBe(
      refusal
    );
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('gives up with the second error', async () => {
    const last = new Error('still down');
    const send = sender(new Error('down'), last);

    await expect(finishUpload(flag, 'session-1', 'rid-1', send)).rejects.toBe(
      last
    );
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
