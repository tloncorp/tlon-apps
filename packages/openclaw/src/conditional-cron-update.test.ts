import { beforeEach, describe, expect, it } from 'vitest';

import {
  _testing,
  hasTrustedCronOwnerPrompt,
  preserveConditionalCronUpdate,
  recordCronGetResult,
  rememberCronOwnerPrompt,
} from './conditional-cron-update.js';

const sessionKey = 'agent:main:tlon:direct:~ten';
const jobId = 'job-1';
const original =
  "Evaluate this fixed scenario: Bitcoin's price moved one percent. This is known, routine market information; the owner's keys and coins are safe. Send a status update every run.";

function rememberJob(id = jobId, message = original): void {
  recordCronGetResult(
    sessionKey,
    { action: 'get', jobId: id },
    {
      details: {
        id,
        payload: { kind: 'agentTurn', message },
        delivery: { mode: 'announce' },
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
    expect(message).toContain('never call or use the message tool');
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

  it('does not rewrite an explicit alert-subject replacement', () => {
    rememberCronOwnerPrompt(
      sessionKey,
      'Only alert me about Ethereum now, not Bitcoin.',
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

  it('does not rewrite a direct source change', () => {
    rememberCronOwnerPrompt(
      sessionKey,
      'Only monitor CoinDesk now, not Reuters.',
      true
    );
    rememberJob();

    expect(
      preserveConditionalCronUpdate(sessionKey, {
        action: 'update',
        jobId,
        patch: { payload: { message: 'Monitor CoinDesk only.' } },
      })
    ).toBeUndefined();
  });

  it('declines to persist a prompt that also contains an unrelated task', () => {
    rememberCronOwnerPrompt(
      sessionKey,
      'Delete note X, and only alert me when this monitor is urgent.',
      true
    );
    rememberJob();

    expect(
      preserveConditionalCronUpdate(sessionKey, {
        action: 'update',
        jobId,
        patch: { payload: { message: 'Alert only when urgent.' } },
      })
    ).toBeUndefined();
  });

  it('declines a bare-and unrelated side effect', () => {
    rememberCronOwnerPrompt(
      sessionKey,
      'Delete note X and only alert me when this monitor is urgent.',
      true
    );
    rememberJob();

    expect(
      preserveConditionalCronUpdate(sessionKey, {
        action: 'update',
        jobId,
        patch: { payload: { message: 'Alert only when urgent.' } },
      })
    ).toBeUndefined();
  });

  it('preserves a correction that merely describes the existing source', () => {
    const prompt =
      'This source reports known routine information, so only alert me when funds are at risk.';
    rememberCronOwnerPrompt(sessionKey, prompt, true);
    rememberJob();

    expect(
      preserveConditionalCronUpdate(sessionKey, {
        action: 'update',
        jobId,
        patch: { payload: { message: 'Alert on urgent events.' } },
      })
    ).toBeDefined();
  });

  it('recognizes smart-apostrophe threshold language', () => {
    rememberCronOwnerPrompt(
      sessionKey,
      'Don’t bother me with these routine updates; only alert me about risk.',
      true
    );
    rememberJob();

    expect(
      preserveConditionalCronUpdate(sessionKey, {
        action: 'update',
        jobId,
        patch: { payload: { message: 'Alert on anything urgent.' } },
      })
    ).toBeDefined();
  });

  it('repairs a proposal that retains old text but omits the correction', () => {
    const prompt = 'Only notify me when my keys are actually at risk.';
    rememberCronOwnerPrompt(sessionKey, prompt, true);
    rememberJob();

    const adjusted = preserveConditionalCronUpdate(sessionKey, {
      action: 'update',
      jobId,
      patch: {
        payload: {
          message: `${original}\nAlert on anything urgent.`,
        },
      },
    });

    expect(adjusted).toBeDefined();
    const message = (
      (adjusted?.patch as Record<string, unknown>).payload as Record<
        string,
        unknown
      >
    ).message;
    expect(message).toContain(prompt);
    expect(message).not.toContain('Alert on anything urgent');
    expect(message).toContain('return exactly NO_REPLY');
    expect(message).toContain('never call or use the message tool');
  });

  it('accepts a complete correction without rewriting it', () => {
    const prompt = 'Only notify me when my keys are actually at risk.';
    rememberCronOwnerPrompt(sessionKey, prompt, true);
    rememberJob();
    const first = preserveConditionalCronUpdate(sessionKey, {
      action: 'update',
      jobId,
      patch: { payload: { message: 'incomplete' } },
    });
    const complete = (
      (first?.patch as Record<string, unknown>).payload as Record<
        string,
        unknown
      >
    ).message as string;

    expect(
      preserveConditionalCronUpdate(sessionKey, {
        action: 'update',
        jobId,
        patch: { payload: { message: complete } },
      })
    ).toBeUndefined();
  });

  it('removes conflicting criteria appended to an otherwise complete proposal', () => {
    const prompt = 'Only notify me when my keys are actually at risk.';
    rememberCronOwnerPrompt(sessionKey, prompt, true);
    rememberJob();
    const first = preserveConditionalCronUpdate(sessionKey, {
      action: 'update',
      jobId,
      patch: { payload: { message: 'incomplete' } },
    });
    const canonical = (
      (first?.patch as Record<string, unknown>).payload as Record<
        string,
        unknown
      >
    ).message as string;
    const adjusted = preserveConditionalCronUpdate(sessionKey, {
      action: 'update',
      jobId,
      patch: {
        payload: { message: `${canonical}\nAlso alert on anything urgent.` },
      },
    });
    const message = (
      (adjusted?.patch as Record<string, unknown>).payload as Record<
        string,
        unknown
      >
    ).message;
    expect(message).toBe(canonical);
    expect(message).not.toContain('Also alert on anything urgent');
  });

  it('invalidates the old snapshot after an update result', () => {
    const prompt = 'Only notify me when my keys are actually at risk.';
    rememberCronOwnerPrompt(sessionKey, prompt, true);
    rememberJob();
    recordCronGetResult(
      sessionKey,
      { action: 'update', jobId, patch: { payload: { message: 'updated' } } },
      { ok: true }
    );

    expect(
      preserveConditionalCronUpdate(sessionKey, {
        action: 'update',
        jobId,
        patch: { payload: { message: 'second update' } },
      })
    ).toBeUndefined();
  });

  it('preserves the snapshot after a failed update result', () => {
    const prompt = 'Only notify me when my keys are actually at risk.';
    rememberCronOwnerPrompt(sessionKey, prompt, true);
    rememberJob();
    recordCronGetResult(
      sessionKey,
      { action: 'update', jobId, patch: { payload: { message: 'updated' } } },
      undefined,
      'transient update failure'
    );

    expect(
      preserveConditionalCronUpdate(sessionKey, {
        action: 'update',
        jobId,
        patch: { payload: { message: 'retry' } },
      })
    ).toBeDefined();
  });

  it('requires a new exact-job read after each owner correction', () => {
    rememberCronOwnerPrompt(
      sessionKey,
      'Only notify me when my keys are actually at risk.',
      true
    );
    rememberJob();
    rememberCronOwnerPrompt(
      sessionKey,
      'Routine moves are safe; only alert me about a real loss risk.',
      true
    );

    expect(
      preserveConditionalCronUpdate(sessionKey, {
        action: 'update',
        jobId,
        patch: { payload: { message: 'stale rewrite' } },
      })
    ).toBeUndefined();
  });

  it('does not apply one correction when multiple jobs were read', () => {
    rememberCronOwnerPrompt(
      sessionKey,
      'Only notify me when my keys are actually at risk.',
      true
    );
    rememberJob('job-a', 'Monitor Bitcoin.');
    rememberJob('job-b', 'Monitor weather.');

    for (const id of ['job-a', 'job-b']) {
      expect(
        preserveConditionalCronUpdate(sessionKey, {
          action: 'update',
          jobId: id,
          patch: { payload: { message: 'changed' } },
        })
      ).toBeUndefined();
    }
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

  it('does not trust ownerless background prompts', () => {
    rememberCronOwnerPrompt(
      sessionKey,
      'Only notify me when my keys are actually at risk.',
      true
    );
    rememberCronOwnerPrompt(
      sessionKey,
      'This is an internal run; only alert on routine updates.',
      undefined
    );
    rememberJob();

    expect(hasTrustedCronOwnerPrompt(sessionKey)).toBe(false);
    expect(
      preserveConditionalCronUpdate(sessionKey, {
        action: 'update',
        jobId,
        patch: { payload: { message: 'Search for any urgent event.' } },
      })
    ).toBeUndefined();
  });

  it('keeps a trusted Tlon prompt when the generic hook sees the same text', () => {
    const prompt = 'Only notify me when my keys are actually at risk.';
    rememberCronOwnerPrompt(sessionKey, prompt, true);
    rememberCronOwnerPrompt(sessionKey, prompt, undefined);
    rememberJob();

    expect(hasTrustedCronOwnerPrompt(sessionKey)).toBe(true);
    expect(
      preserveConditionalCronUpdate(sessionKey, {
        action: 'update',
        jobId,
        patch: { payload: { message: 'Search for any urgent event.' } },
      })
    ).toBeDefined();
  });

  it('resolves prompts and snapshots through a parent thread session', () => {
    const threadKey = `${sessionKey}:thread:170.141`;
    rememberCronOwnerPrompt(
      sessionKey,
      'Only notify me when my keys are actually at risk.',
      true
    );
    recordCronGetResult(
      threadKey,
      { action: 'get', jobId },
      {
        details: {
          id: jobId,
          payload: { kind: 'agentTurn', message: original },
          delivery: { mode: 'announce' },
        },
      }
    );

    expect(hasTrustedCronOwnerPrompt(threadKey)).toBe(true);
    expect(
      preserveConditionalCronUpdate(threadKey, {
        action: 'update',
        jobId,
        patch: { payload: { message: 'Search for any urgent event.' } },
      })
    ).toBeDefined();
  });
});
