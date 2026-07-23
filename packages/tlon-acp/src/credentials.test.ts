import { describe, expect, test } from 'vitest';

import { adapterEnvironment } from './credentials.js';

describe('adapterEnvironment', () => {
  test('sets HOME only in a cloned adapter environment', () => {
    const base = { HOME: '/host', TOKEN: 'present' };
    const child = adapterEnvironment(base, '/bots/one');
    expect(child).toEqual({ HOME: '/bots/one', TOKEN: 'present' });
    expect(base.HOME).toBe('/host');
  });

  test('rejects relative credential homes', () => {
    expect(() => adapterEnvironment({}, 'shared/home')).toThrow(/absolute/);
  });
});
