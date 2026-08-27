import { describe, expect, it } from 'vitest';

import { tlonPlugin } from './channel.js';

describe('conditional alert prompt guidance', () => {
  it('preserves monitor scope and makes the negative path silent', () => {
    const hints = tlonPlugin.agentPrompt?.messageToolHints?.({
      cfg: {} as never,
    });
    const prompt = hints?.join('\n');

    expect(prompt).toContain(
      "preserve the job's existing subject, sources, and input scope"
    );
    expect(prompt).toContain(
      'copy the existing payload message verbatim, then append an `Owner correction (higher priority):` block'
    );
    expect(prompt).toContain(
      'Do not summarize, paraphrase, or replace the old declaration'
    );
    expect(prompt).toContain(
      'do not search for or introduce unrelated events to justify an alert'
    );
    expect(prompt).toContain(
      'Return exactly NO_REPLY when the threshold is not met'
    );
    expect(prompt).toContain(
      'verify that the original scope, the corrected threshold, and the silent negative path are all present'
    );
  });
});
