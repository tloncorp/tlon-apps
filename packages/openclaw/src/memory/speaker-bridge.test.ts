import { describe, expect, it } from 'vitest';

import {
  recordSpeakerForSession,
  resolveSpeakerForSession,
} from './speaker-bridge.js';

describe('speaker bridge', () => {
  it('records and resolves a speaker by exact key', () => {
    recordSpeakerForSession('agent:main:tlon:channel:chat/~zod/a', '~nec');
    expect(
      resolveSpeakerForSession('agent:main:tlon:channel:chat/~zod/a')
    ).toBe('~nec');
  });

  it('resolves through the active-memory suffix', () => {
    recordSpeakerForSession('agent:main:tlon:channel:chat/~zod/b', '~ten');
    expect(
      resolveSpeakerForSession(
        'agent:main:tlon:channel:chat/~zod/b:active-memory:ab12cd34ef56'
      )
    ).toBe('~ten');
  });

  it('falls back through the thread suffix to the parent surface', () => {
    recordSpeakerForSession('agent:main:tlon:channel:chat/~zod/c', '~bus');
    expect(
      resolveSpeakerForSession(
        'agent:main:tlon:channel:chat/~zod/c:thread:1.2:active-memory:ab12cd34ef56'
      )
    ).toBe('~bus');
  });

  it('prefers the thread key over the parent when both are recorded', () => {
    recordSpeakerForSession('agent:main:tlon:channel:chat/~zod/d', '~zod');
    recordSpeakerForSession(
      'agent:main:tlon:channel:chat/~zod/d:thread:1.2',
      '~nec'
    );
    expect(
      resolveSpeakerForSession('agent:main:tlon:channel:chat/~zod/d:thread:1.2')
    ).toBe('~nec');
  });

  it('ignores blank inputs', () => {
    recordSpeakerForSession('', '~nec');
    recordSpeakerForSession('agent:main:tlon:direct:~nec', '');
    expect(resolveSpeakerForSession('')).toBeUndefined();
    expect(resolveSpeakerForSession(undefined)).toBeUndefined();
  });
});
