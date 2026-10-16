import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  ECHO_SETTLE_MS,
  takeEcho,
  useSyncedFieldText,
} from './useSyncedFieldText';

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
  afterEach(() => {
    vi.useRealTimers();
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

  it('ignores each echo of a text typed twice while they are still arriving', () => {
    const { field, setScreenValue } = mount('');
    ['ab', 'a', 'ab'].forEach((text) => field.type(text));

    ['ab', 'a', 'ab'].forEach((text) => setScreenValue(text));

    expect(field.writes).toEqual([]);
    expect(field.text).toBe('ab');
  });

  it('takes a discarded edit after batched updates skipped an echo', () => {
    vi.useFakeTimers();
    const { field, setScreenValue } = mount('a');
    // Typed away from the saved text and back, then away again.
    ['ab', 'a', 'ab'].forEach((text) => field.type(text));
    // The updates were batched: only the last text ever comes back.
    setScreenValue('ab');

    // Discard puts the saved text back, which the field itself once sent. It
    // could still be an echo, so it waits to see whether a newer one follows.
    setScreenValue('a');
    expect(field.writes).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(ECHO_SETTLE_MS);
    });
    expect(field.writes).toEqual(['a']);
    expect(field.text).toBe('a');
  });

  it('never replays old text when the saves run far behind', () => {
    vi.useFakeTimers();
    const { field, setScreenValue } = mount('');
    const typed = ['t', 'to', 'tok', 'toke', 'token'];
    typed.forEach((text) => field.type(text));

    // Nothing comes back until long after the last keystroke, then each value
    // arrives a single save apart.
    act(() => {
      vi.advanceTimersByTime(ECHO_SETTLE_MS * 5);
    });
    typed.forEach((text) => {
      setScreenValue(text);
      act(() => {
        vi.advanceTimersByTime(ECHO_SETTLE_MS / 4);
      });
    });
    act(() => {
      vi.advanceTimersByTime(ECHO_SETTLE_MS * 2);
    });

    expect(field.writes).toEqual([]);
    expect(field.text).toBe('token');
  });

  it('lets newer typing win over an older value that was waiting', () => {
    vi.useFakeTimers();
    const { field, setScreenValue } = mount('a');
    ['ab', 'a', 'ab'].forEach((text) => field.type(text));
    setScreenValue('ab');
    setScreenValue('a');

    field.type('abc');
    act(() => {
      vi.advanceTimersByTime(ECHO_SETTLE_MS * 2);
    });

    expect(field.writes).toEqual([]);
    expect(field.text).toBe('abc');
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
