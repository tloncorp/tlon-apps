import { describe, expect, test } from 'vitest';

import { deskVersionSupportsContactRemoval } from './contactRemovalSupport';

describe('deskVersionSupportsContactRemoval', () => {
  test.each(['12.5.0', '12.5.1', '12.5.2', '13.0.0'])(
    'supports %s',
    (version) => {
      expect(deskVersionSupportsContactRemoval(version)).toBe(true);
    }
  );
  test.each([
    '12.4.0',
    '12.3.1',
    '12.2.0',
    '12.5.1 dirty',
    '',
    null,
    undefined,
  ])('uses legacy requests for %s', (version) => {
    expect(deskVersionSupportsContactRemoval(version)).toBe(false);
  });
});
