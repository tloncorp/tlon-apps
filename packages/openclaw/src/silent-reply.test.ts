import { describe, expect, it } from 'vitest';

import { isSuccessfulSilentAgentOutput } from './silent-reply.js';

describe('successful explicit silence', () => {
  it.each([
    ['NO_REPLY', true],
    [' no_reply\n', true],
    ['', false],
    ['NO_REPLY because there is nothing to report', false],
    ['NO_REPLY\nNO_REPLY', false],
  ])('recognizes only the complete token: %j', (text, expected) => {
    expect(
      isSuccessfulSilentAgentOutput({
        success: true,
        messages: [{ role: 'assistant', content: [{ type: 'text', text }] }],
      })
    ).toBe(expected);
  });

  it.each([
    null,
    { role: 'user', content: [{ type: 'text', text: 'NO_REPLY' }] },
    { role: 'assistant', content: 'NO_REPLY' },
    { role: 'assistant', content: [null] },
    { role: 'assistant', content: [{ type: 'text', text: 123 }] },
    {
      role: 'assistant',
      content: [{ type: 'thinking', thinking: 'NO_REPLY' }],
    },
    {
      role: 'assistant',
      content: [{ type: 'text', text: 'NO_REPLY' }, { type: 'image' }],
    },
  ])('rejects missing, malformed, or additional output: %j', (message) => {
    expect(
      isSuccessfulSilentAgentOutput({ success: true, messages: [message] })
    ).toBe(false);
  });

  it.each([{ success: false }, { success: true, error: 'failed' }])(
    'rejects unsuccessful completion: %j',
    (status) => {
      expect(
        isSuccessfulSilentAgentOutput({
          ...status,
          messages: [
            {
              role: 'assistant',
              content: [{ type: 'text', text: 'NO_REPLY' }],
            },
          ],
        })
      ).toBe(false);
    }
  );
});
