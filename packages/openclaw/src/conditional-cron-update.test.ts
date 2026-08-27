import { beforeEach, describe, expect, it } from 'vitest';

import {
  _testing,
  preserveConditionalCronUpdate,
  recordCronGetResult,
  rememberCronOwnerPrompt,
} from './conditional-cron-update.js';

const sessionKey = 'agent:main:tlon:direct:~ten';
const jobId = 'job-1';
const original =
  "Evaluate this fixed scenario: Bitcoin's price moved one percent. This is known, routine market information; the owner's keys and coins are safe. Send a status update every run.";

function rememberJob(): void {
  recordCronGetResult(
    sessionKey,
    { action: 'get', jobId },
    {
      details: {
        id: jobId,
        payload: { kind: 'agentTurn', message: original },
      },
    }
  );
}

describe('conditional cron update preservation', () => {
  beforeEach(() => _testing.clear());

  it('turns a lossy threshold rewrite into a lossless owner correction', () => {
    const prompt =
      "This is known information. My keys and coins aren't at risk, so it does not count as urgent. Don't bother me with routine updates.";
    rememberCronOwnerPrompt(sessionKey, prompt, true);
    rememberJob();

    const adjusted = preserveConditionalCronUpdate(sessionKey, {
      action: 'update',
      jobId,
      patch: {
        payload: {
          kind: 'agentTurn',
          message: 'Search for any genuinely urgent security event.',
        },
      },
    });

    if (!adjusted) {
      throw new Error('expected the cron update to be adjusted');
    }
    const message = (
      (adjusted.patch as Record<string, unknown>).payload as Record<
        string,
        unknown
      >
    ).message;
    expect(message).toContain(original);
    expect(message).toContain(prompt);
    expect(message).toContain('return exactly NO_REPLY');
    expect(message).not.toContain('Search for any genuinely urgent');
  });

  it('does not rewrite an explicit scope change', () => {
    rememberCronOwnerPrompt(
      sessionKey,
      'Stop monitoring Bitcoin and switch the subject to Ethereum alerts.',
      true
    );
    rememberJob();

    expect(
      preserveConditionalCronUpdate(sessionKey, {
        action: 'update',
        jobId,
        patch: { payload: { message: 'Monitor Ethereum.' } },
      })
    ).toBeUndefined();
  });

  it('requires an owner prompt and a preceding exact-job read', () => {
    rememberCronOwnerPrompt(
      sessionKey,
      'Only notify me when the threshold is met.',
      false
    );

    expect(
      preserveConditionalCronUpdate(sessionKey, {
        action: 'update',
        jobId,
        patch: { payload: { message: 'Notify only on threshold.' } },
      })
    ).toBeUndefined();
  });

  it('accepts older hosts that omit senderIsOwner and relies on the tool-role gate', () => {
    rememberCronOwnerPrompt(
      sessionKey,
      'This is routine, so only alert me if my keys are at risk.',
      undefined
    );
    rememberJob();

    expect(
      preserveConditionalCronUpdate(sessionKey, {
        action: 'update',
        jobId,
        patch: { payload: { message: 'Search for any urgent event.' } },
      })
    ).toBeDefined();
  });
});
