import { describe, expect, it } from 'vitest';

import { tlonPlugin } from './channel.js';

describe('cross-conversation react/delete prompt guidance', () => {
  it('routes other-conversation reactions and deletes to the tlon CLI', () => {
    const hints = tlonPlugin.agentPrompt?.messageToolHints?.({
      cfg: {} as never,
    });
    const prompt = hints?.join('\n');

    expect(prompt).toContain(
      'action=react and action=delete only work on messages in the current conversation'
    );
    expect(prompt).toContain('`tlon posts react|unreact|delete');
    expect(prompt).toContain('`tlon dms react|unreact|delete ~ship');
    expect(prompt).toContain(
      'If a reaction or delete call returns an error, say it failed'
    );
  });
});
