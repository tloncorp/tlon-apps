import { describe, expect, it } from 'vitest';

import { tlonPlugin } from './channel.js';

describe('Tlon channel prompt guidance', () => {
  it('requires replies to preserve context split across rapid messages', () => {
    const hints = tlonPlugin.agentPrompt?.messageToolHints?.({
      cfg: {} as never,
    });

    expect(hints?.join('\n')).toContain(
      'In a direct chat, treat adjacent messages from that user since your last visible reply as one conversational update.'
    );
    expect(hints?.join('\n')).toContain(
      "In a group channel, combine adjacent messages only when they are from the same sender and directed at you. Keep other participants' messages separate."
    );
    expect(hints?.join('\n')).toContain(
      'Never answer only the newest line while silently dropping useful context from an earlier line.'
    );
  });
});
