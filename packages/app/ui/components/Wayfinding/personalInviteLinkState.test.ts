import { describe, expect, it } from 'vitest';

import { resolvePersonalInviteLinkState } from './personalInviteLinkState';

describe('resolvePersonalInviteLinkState', () => {
  it('is ready whenever a link exists, whatever an earlier attempt recorded', () => {
    expect(
      resolvePersonalInviteLinkState({
        inviteUrl: 'https://tlon.network/lure/abc',
        unavailable: true,
      })
    ).toBe('ready');
  });

  it('loads while an attempt can still deliver the link', () => {
    expect(
      resolvePersonalInviteLinkState({ inviteUrl: null, unavailable: false })
    ).toBe('loading');
  });

  it('is unavailable once the attempt has failed with nothing to follow', () => {
    expect(
      resolvePersonalInviteLinkState({ inviteUrl: null, unavailable: true })
    ).toBe('unavailable');
  });
});
