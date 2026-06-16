import { describe, expect, test } from 'vitest';

import {
  getThirdPartyChannelAgent,
  isThirdPartyChannel,
} from '../urbit/utils';

describe('third party channels', () => {
  test('%channels-backed kinds have no third-party agent', () => {
    expect(getThirdPartyChannelAgent('chat/~zod/general')).toBeNull();
    expect(getThirdPartyChannelAgent('diary/~zod/blog')).toBeNull();
    expect(getThirdPartyChannelAgent('heap/~zod/links')).toBeNull();
    expect(isThirdPartyChannel('chat/~zod/general')).toBe(false);
  });

  test('non-%channels kinds report their backing agent', () => {
    expect(getThirdPartyChannelAgent('notes/~zod/book')).toBe('notes');
    expect(isThirdPartyChannel('notes/~zod/book')).toBe(true);
  });

  test('non-nest ids (DMs, clubs) are not third-party channels', () => {
    expect(getThirdPartyChannelAgent('~sampel-palnet')).toBeNull();
    expect(getThirdPartyChannelAgent('0v4.abcde')).toBeNull();
    expect(isThirdPartyChannel('~sampel-palnet')).toBe(false);
  });

  test('malformed nests are not treated as third-party channels', () => {
    expect(getThirdPartyChannelAgent('notes/~zod')).toBeNull();
    expect(isThirdPartyChannel('notes/~zod')).toBe(false);
  });
});
