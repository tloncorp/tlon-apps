import { useCallback, useEffect, useRef } from 'react';

/**
 * Whether `value` is one the field sent that is now coming back. Returns the
 * sent values still on their way back after it, or null for a value the field
 * never sent.
 */
export function takeEcho(
  pending: readonly string[],
  value: string
): string[] | null {
  const index = pending.indexOf(value);
  return index >= 0 ? pending.slice(index + 1) : null;
}

/**
 * How long after the last keystroke a sent value can still be on its way back.
 * These values round-trip through local state or storage, which takes moments.
 */
export const ECHO_WINDOW_MS = 1000;

/**
 * Keeps a native text field's own state in step with the screen's value.
 * Typing sends each value up, and it comes back as the prop a moment later;
 * after fast typing, an older value can arrive after newer keystrokes. Values
 * the field sent are recognized as echoes and ignored, so only a change made
 * elsewhere, such as a reset, replaces what is in the field.
 */
export function useSyncedFieldText(
  state: { get(): string; set(value: string): void },
  value: string,
  onChangeText: (text: string) => void
) {
  // Every sent value stays here until it, or a later one, comes back, however
  // many are outstanding: forgetting one mid-typing would make its echo look
  // like an outside change and write an old value over newer typing.
  const pendingEchoes = useRef<string[]>([]);
  const lastSentAt = useRef(0);

  useEffect(() => {
    // Updates that are batched can skip a sent value, so it never comes back.
    // Left here for good, it would make a later outside change to that same
    // text, such as a discarded edit, look like an echo and be ignored. Once
    // the field has been quiet for a while, nothing is still on its way.
    const outstanding =
      Date.now() - lastSentAt.current > ECHO_WINDOW_MS
        ? []
        : pendingEchoes.current;
    const remaining = takeEcho(outstanding, value);
    if (remaining) {
      pendingEchoes.current = remaining;
      return;
    }
    pendingEchoes.current = [];
    if (state.get() !== value) {
      state.set(value);
    }
  }, [state, value]);

  return useCallback(
    (text: string) => {
      pendingEchoes.current = [...pendingEchoes.current, text];
      lastSentAt.current = Date.now();
      onChangeText(text);
    },
    [onChangeText]
  );
}
