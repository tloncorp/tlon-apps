import { describe, expect, it } from 'vitest';

import { tlonPlugin } from './channel.js';

describe('Tlon channel prompt guidance', () => {
  it('requires replies to preserve context split across rapid messages', () => {
    const hints = tlonPlugin.agentPrompt?.messageToolHints?.({
      cfg: {} as never,
    });

    expect(hints?.join('\n')).toContain(
      'Treat adjacent user messages received since your last visible reply as one conversational update.'
    );
    expect(hints?.join('\n')).toContain(
      'Never answer only the newest line while silently dropping useful context from an earlier line.'
    );
  });
});
