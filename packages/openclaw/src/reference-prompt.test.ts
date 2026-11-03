import { describe, expect, it } from 'vitest';

import { tlonPlugin } from './channel.js';

describe('cross-channel reference prompt guidance', () => {
  it('asks for a bare Ref path in the reply after acting elsewhere', () => {
    const hints = tlonPlugin.agentPrompt?.messageToolHints?.({
      cfg: {} as never,
    });
    const prompt = hints?.join('\n');

    expect(prompt).toContain(
      'include the returned Ref: path in your reply here'
    );
    expect(prompt).toContain(
      'A bare reference path on its own line renders as a card; do not wrap it in a link or bold.'
    );
    expect(prompt).toContain('The messageId a send returns is not the post ID');
    expect(prompt).toContain(
      '`tlon messages channel <nest>` for /1/chan/<nest>/msg/<id>'
    );
    expect(prompt).toContain(
      '`tlon messages post <nest> <parent>` for a thread reply at /1/chan/<nest>/msg/<parent>/<id>'
    );
  });
});
