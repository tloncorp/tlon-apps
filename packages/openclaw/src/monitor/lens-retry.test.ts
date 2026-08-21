import { describe, expect, it } from 'vitest';

import { parseLensRetryRequest } from './lens-retry.js';

describe('parseLensRetryRequest', () => {
  it('parses the direct JSON shape emitted by steward-lens-update-1', () => {
    expect(
      parseLensRetryRequest({
        'retry-requested': { id: 'lens-1', requester: '~malmur-halmex' },
      })
    ).toEqual({ id: 'lens-1', requester: '~malmur-halmex' });
  });

  it('keeps compatibility with the older nested lens shape', () => {
    expect(
      parseLensRetryRequest({
        lens: {
          'retry-requested': { id: 'lens-2', requester: '~malmur-halmex' },
        },
      })
    ).toEqual({ id: 'lens-2', requester: '~malmur-halmex' });
  });

  it('ignores entry facts and malformed retry facts', () => {
    expect(parseLensRetryRequest({ entry: {} })).toBeNull();
    expect(
      parseLensRetryRequest({ 'retry-requested': { id: 'lens-3' } })
    ).toBeNull();
  });
});
