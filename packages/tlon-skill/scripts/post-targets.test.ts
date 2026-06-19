import { describe, expect, it } from 'bun:test';

import { defaultReplyParentAuthor, isOneToOneDmTarget } from './post-targets';

describe('post target helpers', () => {
  it('detects one-to-one DM targets', () => {
    expect(isOneToOneDmTarget('~nec')).toBe(true);
    expect(isOneToOneDmTarget(' ~nec ')).toBe(true);
    expect(isOneToOneDmTarget('chat/~nec/general')).toBe(false);
    expect(isOneToOneDmTarget('0v123.group')).toBe(false);
  });

  it('defaults reply parent author to the DM target for one-to-one DMs', () => {
    expect(defaultReplyParentAuthor('~nec', '~bot')).toBe('~nec');
    expect(defaultReplyParentAuthor(' ~nec ', '~bot')).toBe('~nec');
  });

  it('preserves explicit reply parent authors', () => {
    expect(defaultReplyParentAuthor('~nec', '~bot', '~zod')).toBe('~zod');
    expect(defaultReplyParentAuthor('chat/~nec/general', '~bot', '~zod')).toBe(
      '~zod'
    );
  });

  it('defaults channel and group-DM replies to the current author', () => {
    expect(defaultReplyParentAuthor('chat/~nec/general', '~bot')).toBe('~bot');
    expect(defaultReplyParentAuthor('0v123.group', '~bot')).toBe('~bot');
  });
});
