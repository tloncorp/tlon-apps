import { describe, expect, it } from 'vitest';

import { tlonPlugin } from './channel.js';

describe('cron reconciliation prompt guidance', () => {
  it('requires complete before-and-after reconciliation for schedule changes', () => {
    const hints = tlonPlugin.agentPrompt?.messageToolHints?.({
      cfg: {} as never,
    });
    const prompt = hints?.join('\n');

    expect(prompt).toContain(
      'reconcile the complete set of cron jobs for that same user intent'
    );
    expect(prompt).toContain('Do not stop after the first broad match.');
    expect(prompt).toContain(
      'no duplicate or related job keeps the superseded cadence or behavior'
    );
    expect(prompt).toContain(
      'only claim completion after verifying that no matching job retains the old cadence or behavior'
    );
  });
});
