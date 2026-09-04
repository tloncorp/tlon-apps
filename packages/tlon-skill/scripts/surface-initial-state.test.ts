import { describe, expect, it } from 'bun:test';

import { initialStateDivergence } from './surface-initial-state';

/**
 * The diff `surface publish` refuses a preserving revision on.
 *
 * Each case is one of the four questions a merge design would have had to
 * answer and this one answers by refusing: nesting, arrays, removal, and a
 * type conflict. They are here rather than in the publish tests because they
 * are statements about the function, and the publish tests are statements
 * about what the command does with it.
 */
describe('initialStateDivergence', () => {
  it('descends into objects present on both sides', () => {
    expect(
      initialStateDivergence(
        { config: { theme: 'dark' }, kept: 1 },
        { config: { theme: 'dark', density: 'tight' }, kept: 1 }
      )
    ).toEqual(['/config/density']);
  });

  it('treats an array as a leaf and reports it whole', () => {
    expect(
      initialStateDivergence({ order: ['a', 'b'] }, { order: ['a', 'b', 'c'] })
    ).toEqual(['/order']);
  });

  it('reports a key the revision drops as well as one it adds', () => {
    expect(initialStateDivergence({ gone: 1 }, { fresh: 2 })).toEqual([
      '/fresh',
      '/gone',
    ]);
  });

  it('reports a retype at the path, not as a pair of presences', () => {
    expect(initialStateDivergence({ count: 0 }, { count: {} })).toEqual([
      '/count',
    ]);
  });

  it('names a one-sided subtree once, not every leaf inside it', () => {
    expect(
      initialStateDivergence({}, { items: { lift: { paid: {} } } })
    ).toEqual(['/items']);
  });

  it('is silent on reordered keys', () => {
    expect(initialStateDivergence({ a: 1, b: 2 }, { b: 2, a: 1 })).toEqual([]);
  });

  it('escapes a reported path the way an op targeting it must (D51)', () => {
    // A bare ship is legal as an object key inside a value; the same ship in a
    // pointer needs `~0zod`. The message exists to be pasted into an op.
    expect(
      initialStateDivergence({}, { bringing: { '~zod': 'bread' } })
    ).toEqual(['/bringing']);
    expect(
      initialStateDivergence(
        { bringing: { '~zod': 'bread' } },
        { bringing: { '~zod': 'bread', '~ten': 'pie' } }
      )
    ).toEqual(['/bringing/~0ten']);
  });
});
