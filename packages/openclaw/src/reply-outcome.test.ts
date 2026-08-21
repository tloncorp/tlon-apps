import { describe, expect, it } from 'vitest';

import { terminalAgentReplyError } from './reply-outcome.js';

describe('terminal agent reply outcome', () => {
  it('treats a structured final error reply as a failed run', () => {
    expect(
      terminalAgentReplyError(
        { text: 'A tool failed.', isError: true },
        'final'
      )?.message
    ).toBe('The agent ended with an unrecovered tool error.');
  });

  it('does not fail successful final replies', () => {
    expect(terminalAgentReplyError({ text: 'Done.' }, 'final')).toBeNull();
  });

  it('does not promote intermediate error payloads to run failures', () => {
    expect(
      terminalAgentReplyError(
        { text: 'A tool failed; trying another route.', isError: true },
        'tool'
      )
    ).toBeNull();
  });
});
