import { describe, expect, it } from 'vitest';

import { type JsonObject, applyStateOp, isStateOp } from './state-ops.js';

function ok(result: ReturnType<typeof applyStateOp>): JsonObject {
  if (!result.ok) {
    throw new Error(`expected ok, got: ${result.reason}`);
  }
  return result.state;
}

function reason(result: ReturnType<typeof applyStateOp>): string {
  if (result.ok) {
    throw new Error('expected a refusal');
  }
  return result.reason;
}

describe('isStateOp', () => {
  it('recognizes the vocabulary and nothing else', () => {
    for (const name of ['set', 'toggle', 'increment', 'append', 'remove']) {
      expect(isStateOp(name)).toBe(true);
    }
    expect(isStateOp('setPortions')).toBe(false);
    expect(isStateOp('')).toBe(false);
  });
});

describe('applyStateOp', () => {
  // An action a kit invented but the agent does not implement must refuse
  // loudly rather than silently doing nothing, or a card would look broken with
  // no explanation anywhere.
  it('refuses an unknown action', () => {
    expect(reason(applyStateOp({}, 'frobnicate', { path: 'a' }))).toContain(
      'unknown action'
    );
  });

  it('requires a path', () => {
    expect(reason(applyStateOp({}, 'toggle', undefined))).toContain(
      'requires a string path'
    );
    expect(reason(applyStateOp({}, 'toggle', { path: '' }))).toContain(
      'requires a string path'
    );
    expect(reason(applyStateOp({}, 'toggle', { path: 42 }))).toContain(
      'requires a string path'
    );
  });

  it('refuses a malformed path', () => {
    expect(reason(applyStateOp({}, 'toggle', { path: 'a..b' }))).toContain(
      'malformed path'
    );
  });

  // A card's params are attacker-controlled in the sense that anyone who can
  // post in the channel can send them.
  it('refuses a path that reaches outside state', () => {
    for (const path of ['__proto__', 'a.__proto__.b', 'constructor']) {
      expect(reason(applyStateOp({}, 'set', { path, value: 1 }))).toContain(
        'malformed path'
      );
    }
  });

  it('never mutates the state it was given', () => {
    const before: JsonObject = { days: { mon: { done: false } } };
    const snapshot = JSON.stringify(before);
    ok(applyStateOp(before, 'toggle', { path: 'days.mon.done' }));
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  describe('set', () => {
    it('writes a value at a nested path', () => {
      expect(
        ok(applyStateOp({}, 'set', { path: 'days.mon.meal', value: 'tacos' }))
      ).toEqual({ days: { mon: { meal: 'tacos' } } });
    });

    it('overwrites an existing value', () => {
      expect(
        ok(applyStateOp({ portions: 2 }, 'set', { path: 'portions', value: 4 }))
      ).toEqual({ portions: 4 });
    });

    it('requires a value, so setting undefined is not a way to delete', () => {
      expect(reason(applyStateOp({}, 'set', { path: 'a' }))).toContain(
        'requires a value'
      );
    });

    it('refuses to write through a non-object', () => {
      expect(
        reason(applyStateOp({ a: 'text' }, 'set', { path: 'a.b', value: 1 }))
      ).toContain('expected an object');
    });

    it('writes into an array by index', () => {
      expect(
        ok(
          applyStateOp({ items: ['a', 'b'] }, 'set', {
            path: 'items.1',
            value: 'c',
          })
        )
      ).toEqual({ items: ['a', 'c'] });
    });

    // Writing past the end would leave holes, which JSON turns into nulls.
    it('refuses an index past the end of an array', () => {
      expect(
        reason(
          applyStateOp({ items: ['a'] }, 'set', { path: 'items.5', value: 'x' })
        )
      ).toContain('past the end');
    });

    // The state root is an object, so an index at the top is a caller mistake
    // rather than a request to turn the whole card's state into an array.
    it('refuses an index at the root', () => {
      expect(
        reason(applyStateOp({}, 'set', { path: '0', value: 1 }))
      ).toContain('expected an array');
    });
  });

  describe('toggle', () => {
    it('flips a boolean', () => {
      expect(
        ok(applyStateOp({ done: true }, 'toggle', { path: 'done' }))
      ).toEqual({ done: false });
    });

    // A first tap on a key that does not exist yet should turn it on.
    it('treats absent as false', () => {
      expect(ok(applyStateOp({}, 'toggle', { path: 'done' }))).toEqual({
        done: true,
      });
    });

    // Truthy-flipping a string would quietly destroy whatever owns that key.
    it('refuses a non-boolean', () => {
      expect(
        reason(applyStateOp({ done: 'yes' }, 'toggle', { path: 'done' }))
      ).toContain('expects a boolean');
    });
  });

  describe('increment', () => {
    it('adds one by default', () => {
      expect(ok(applyStateOp({ n: 2 }, 'increment', { path: 'n' }))).toEqual({
        n: 3,
      });
    });

    it('adds a given amount, including a negative one', () => {
      expect(
        ok(applyStateOp({ n: 2 }, 'increment', { path: 'n', by: -2 }))
      ).toEqual({ n: 0 });
    });

    it('treats absent as zero', () => {
      expect(ok(applyStateOp({}, 'increment', { path: 'n', by: 3 }))).toEqual({
        n: 3,
      });
    });

    it('refuses a non-numeric target or amount', () => {
      expect(
        reason(applyStateOp({ n: 'two' }, 'increment', { path: 'n' }))
      ).toContain('expects a number');
      expect(
        reason(applyStateOp({ n: 1 }, 'increment', { path: 'n', by: 'lots' }))
      ).toContain('finite numeric');
    });
  });

  describe('append', () => {
    it('adds to an existing array', () => {
      expect(
        ok(
          applyStateOp({ list: ['milk'] }, 'append', {
            path: 'list',
            value: 'eggs',
          })
        )
      ).toEqual({ list: ['milk', 'eggs'] });
    });

    it('creates the array when absent', () => {
      expect(
        ok(applyStateOp({}, 'append', { path: 'list', value: 'milk' }))
      ).toEqual({ list: ['milk'] });
    });

    it('refuses to append to a non-array', () => {
      expect(
        reason(
          applyStateOp({ list: 'milk' }, 'append', {
            path: 'list',
            value: 'eggs',
          })
        )
      ).toContain('expects an array');
    });
  });

  describe('remove', () => {
    it('splices an array element when the last segment is an index', () => {
      expect(
        ok(
          applyStateOp({ list: ['milk', 'eggs', 'jam'] }, 'remove', {
            path: 'list.1',
          })
        )
      ).toEqual({ list: ['milk', 'jam'] });
    });

    it('deletes an object key otherwise', () => {
      expect(ok(applyStateOp({ a: 1, b: 2 }, 'remove', { path: 'b' }))).toEqual(
        { a: 1 }
      );
    });

    it('removes a nested key without disturbing its siblings', () => {
      expect(
        ok(
          applyStateOp({ days: { mon: 1, tue: 2 } }, 'remove', {
            path: 'days.mon',
          })
        )
      ).toEqual({ days: { tue: 2 } });
    });

    it('refuses to remove something that is not there', () => {
      expect(reason(applyStateOp({ a: 1 }, 'remove', { path: 'b' }))).toContain(
        'nothing at'
      );
      expect(
        reason(applyStateOp({ list: ['a'] }, 'remove', { path: 'list.3' }))
      ).toContain('out of range');
    });
  });
});
