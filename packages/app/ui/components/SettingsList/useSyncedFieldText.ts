import { useCallback, useEffect, useRef } from 'react';

/** How many sent values to remember while waiting for them to come back. */
const maxPendingEchoes = 20;

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
  const pendingEchoes = useRef<string[]>([]);

  useEffect(() => {
    const echoIndex = pendingEchoes.current.indexOf(value);
    if (echoIndex >= 0) {
      pendingEchoes.current = pendingEchoes.current.slice(echoIndex + 1);
      return;
    }
    pendingEchoes.current = [];
    if (state.get() !== value) {
      state.set(value);
    }
  }, [state, value]);

  return useCallback(
    (text: string) => {
      pendingEchoes.current = [...pendingEchoes.current, text].slice(
        -maxPendingEchoes
      );
      onChangeText(text);
    },
    [onChangeText]
  );
}
