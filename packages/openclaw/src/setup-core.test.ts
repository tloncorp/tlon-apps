import { describe, expect, it } from 'vitest';

import { tlonSetupWizard } from './setup-surface.js';

describe('tlon setup wizard', () => {
  it('marks the login code prompt sensitive with a value-free keep prompt', () => {
    const code = tlonSetupWizard.textInputs?.find(
      (input) => input.inputKey === 'code'
    );
    expect(code?.sensitive).toBe(true);
    expect(typeof code?.keepPrompt).toBe('string');
  });
});
