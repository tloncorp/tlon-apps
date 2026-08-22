import { describe, expect, it } from 'vitest';

import {
  parseTlonSurface,
  stripActiveMemorySuffix,
  stripThreadSuffix,
} from './surface.js';

describe('parseTlonSurface', () => {
  it('parses a DM session key', () => {
    expect(parseTlonSurface('agent:main:tlon:direct:~nec')).toEqual({
      kind: 'dm',
      ship: '~nec',
    });
  });

  it('parses a channel session key', () => {
    expect(
      parseTlonSurface('agent:main:tlon:channel:chat/~zod/general')
    ).toEqual({ kind: 'channel', nest: 'chat/~zod/general' });
  });

  it('parses a DM thread and keeps the parent surface', () => {
    expect(
      parseTlonSurface('agent:main:tlon:direct:~ten:thread:170.141.184')
    ).toEqual({ kind: 'dm', ship: '~ten', threadId: '170.141.184' });
  });

  it('parses a channel thread', () => {
    expect(
      parseTlonSurface(
        'agent:main:tlon:channel:chat/~zod/general:thread:170.141.184'
      )
    ).toEqual({
      kind: 'channel',
      nest: 'chat/~zod/general',
      threadId: '170.141.184',
    });
  });

  it('resolves an active-memory sub-agent key to its parent surface', () => {
    expect(
      parseTlonSurface('agent:main:tlon:direct:~nec:active-memory:ab12cd34ef56')
    ).toEqual({ kind: 'dm', ship: '~nec' });
    expect(
      parseTlonSurface(
        'agent:main:tlon:channel:chat/~zod/general:thread:1.2:active-memory:ab12cd34ef56'
      )
    ).toEqual({ kind: 'channel', nest: 'chat/~zod/general', threadId: '1.2' });
  });

  it('returns null for non-tlon sessions', () => {
    expect(parseTlonSurface('agent:main:main')).toBeNull();
    expect(parseTlonSurface('agent:main:telegram:direct')).toBeNull();
    expect(parseTlonSurface('agent:main:cron:job-1')).toBeNull();
    expect(parseTlonSurface('agent:main:subagent:reviewer')).toBeNull();
    expect(parseTlonSurface('')).toBeNull();
  });

  it('rejects malformed ships and nests', () => {
    expect(parseTlonSurface('agent:main:tlon:direct:zod')).toBeNull();
    expect(parseTlonSurface('agent:main:tlon:direct:~ZOD!')).toBeNull();
    expect(
      parseTlonSurface('agent:main:tlon:channel:blog/~zod/general')
    ).toBeNull();
    expect(
      parseTlonSurface('agent:main:tlon:channel:chat/~zod/../escape')
    ).toBeNull();
  });
});

describe('suffix strippers', () => {
  it('strips only trailing recognized suffixes', () => {
    expect(stripActiveMemorySuffix('a:b:active-memory:x')).toBe('a:b');
    expect(stripActiveMemorySuffix('a:b')).toBe('a:b');
    expect(stripThreadSuffix('a:b:thread:1.2')).toBe('a:b');
    expect(stripThreadSuffix('a:b')).toBe('a:b');
  });
});
