import { afterEach, describe, expect, it } from 'vitest';

import { _testing, getSessionRole, setSessionRole } from './session-roles.js';

describe('session roles', () => {
  afterEach(() => {
    _testing.clearAll();
  });

  it('returns the stored role for an exact session key', () => {
    setSessionRole('agent:main:tlon:direct:~ten', 'owner');
    expect(getSessionRole('agent:main:tlon:direct:~ten')).toBe('owner');
    expect(getSessionRole('agent:main:tlon:direct:~zod')).toBeUndefined();
  });

  it('falls back to the thread parent key', () => {
    setSessionRole('agent:main:tlon:direct:~ten', 'user');
    expect(
      getSessionRole('agent:main:tlon:direct:~ten:thread:170.141.184')
    ).toBe('user');
  });

  it('prefers a role stored under the exact thread key', () => {
    setSessionRole('agent:main:tlon:direct:~ten', 'owner');
    setSessionRole('agent:main:tlon:direct:~ten:thread:1', 'user');
    expect(getSessionRole('agent:main:tlon:direct:~ten:thread:1')).toBe('user');
  });

  it('returns undefined when neither thread nor parent key has a role', () => {
    expect(
      getSessionRole('agent:main:tlon:direct:~ten:thread:1')
    ).toBeUndefined();
  });
});
