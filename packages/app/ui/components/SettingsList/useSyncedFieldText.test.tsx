import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { takeEcho, useSyncedFieldText } from './useSyncedFieldText';

describe('takeEcho', () => {
  it('recognizes a sent value and keeps the ones sent after it', () => {
    expect(takeEcho(['a', 'ab', 'abc'], 'ab')).toEqual(['abc']);
  });

  it('returns null for a value the field never sent', () => {
    expect(takeEcho(['a', 'ab'], 'reset')).toBeNull();
    expect(takeEcho([], 'a')).toBeNull();
  });
});

describe('useSyncedFieldText', () => {
  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  /** A field whose native text is `field.text`, under a screen value. */
  function mount(initial: string) {
    const field = {
      text: initial,
      writes: [] as string[],
      type: (_text: string) => {},
    };
    const state = {
      get: () => field.text,
      set: (value: string) => {
        field.text = value;
        field.writes.push(value);
      },
    };
    function Field({ value }: { value: string }) {
      const onChangeText = useSyncedFieldText(state, value, () => {});
      field.type = (text: string) => {
        field.text = text;
        onChangeText(text);
      };
      return null;
    }
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(<Field value={initial} />);
    });
    const setScreenValue = (value: string) =>
      act(() => renderer.update(<Field value={value} />));
    return { field, setScreenValue };
  }

  it('ignores slow echoes however many edits are outstanding', () => {
    const { field, setScreenValue } = mount('');
    const typed = Array.from({ length: 40 }, (_, index) =>
      'x'.repeat(index + 1)
    );
    typed.forEach((text) => field.type(text));

    // The save is far behind: every value comes back, oldest first.
    typed.forEach((text) => setScreenValue(text));

    expect(field.writes).toEqual([]);
    expect(field.text).toBe(typed.at(-1));
  });

  it('still takes a change made elsewhere', () => {
    const { field, setScreenValue } = mount('');
    field.type('a');
    field.type('ab');

    setScreenValue('reset');

    expect(field.writes).toEqual(['reset']);
    expect(field.text).toBe('reset');
  });
});
