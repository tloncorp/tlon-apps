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
  // Every sent value stays here until it, or a later one, comes back. A slow
  // save can leave many outstanding, and forgetting one would make its echo
  // look like an outside change and write an old value over newer typing.
  const pendingEchoes = useRef<string[]>([]);

  useEffect(() => {
    const remaining = takeEcho(pendingEchoes.current, value);
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
      onChangeText(text);
    },
    [onChangeText]
  );
}
