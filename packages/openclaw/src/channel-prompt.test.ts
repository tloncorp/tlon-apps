import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { describe, expect, it } from 'vitest';

import { TLON_NOTEBOOK_DESTINATION_HINTS, tlonPlugin } from './channel.js';

describe('Tlon channel prompt', () => {
  it('routes replies, durable artifacts, and recurring delivery by intent', () => {
    const prompt = TLON_NOTEBOOK_DESTINATION_HINTS.join('\n');

    expect(prompt).toContain('Reply in the conversation where the owner asked');
    expect(prompt).toContain('Scheduled alerts and status updates');
    expect(prompt).toContain('explicitly asks to save a durable report');
    expect(prompt).toContain('existing Notebook channel');
    expect(prompt).toContain('`Updates` Notebook');
    expect(prompt).toContain(
      "If the request comes from a group, prefer that group's"
    );
    expect(prompt).toContain('From a DM, confirm');
    expect(prompt).toContain('not an app route');
    expect(prompt).toContain('never invent a global Notes or Notebooks screen');
    expect(prompt).toContain('answer from this navigation rule without tools');
    expect(prompt).toContain(
      'Never create or choose a standalone backend notebook'
    );

    const assembledHints = tlonPlugin.agentPrompt?.messageToolHints?.({
      cfg: {
        channels: {
          tlon: {
            ship: '~zod',
            url: 'https://example.com',
            code: 'code-123',
          },
        },
      } as OpenClawConfig,
    });
    expect(assembledHints).toEqual(
      expect.arrayContaining(TLON_NOTEBOOK_DESTINATION_HINTS)
    );
  });
});
