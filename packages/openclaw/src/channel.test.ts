import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { describe, expect, it } from 'vitest';

import { TLON_A2UI_AGENT_PROMPT_HINTS } from './a2ui-prompt.js';
import { tlonPlugin } from './channel.js';

const cfg = {} as unknown as OpenClawConfig;

describe('Tlon agent prompt', () => {
  it('injects the permanent A2UI decision policy', () => {
    const hints = tlonPlugin.agentPrompt?.messageToolHints?.({
      cfg,
      accountId: 'default',
    });
    const prompt = hints?.join('\n') ?? '';

    for (const hint of TLON_A2UI_AGENT_PROMPT_HINTS) {
      expect(hints).toContain(hint);
    }

    expect(prompt).toContain('proactively prefer A2UI');
    expect(prompt).toContain('even when the user does not explicitly ask');
    expect(prompt).toContain('use A2UI unless');
    expect(prompt).toContain(
      'Use normal text for short conversational replies'
    );
    expect(prompt).toContain('only in Tlon direct messages');
    expect(prompt).toContain('reply only NO_REPLY');
  });
});
