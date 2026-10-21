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
 * How long an older sent value can sit unanswered before it is taken as an
 * outside change. Echoes that are still arriving follow each other within a
 * single save, far sooner than this, however far behind the saves are.
 */
export const ECHO_SETTLE_MS = 1000;

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
  // many are outstanding and however long the saves take: forgetting one would
  // make its echo look like an outside change and write an old value over
  // newer typing.
  const pendingEchoes = useRef<string[]>([]);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelSettle = useCallback(() => {
    if (settleTimer.current !== null) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
  }, []);

  useEffect(() => {
    const adopt = () => {
      pendingEchoes.current = [];
      if (state.get() !== value) {
        state.set(value);
      }
    };
    const remaining = takeEcho(pendingEchoes.current, value);
    if (!remaining) {
      adopt();
      return;
    }
    pendingEchoes.current = remaining;
    if (state.get() === value) {
      return;
    }
    // An older sent value. While echoes are still arriving, a newer one follows
    // at once and cancels this. If nothing follows and nothing more is typed,
    // batched updates skipped this value on its way back earlier, so this is
    // an outside change to the same text, such as a discarded edit.
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      adopt();
    }, ECHO_SETTLE_MS);
    return cancelSettle;
  }, [cancelSettle, state, value]);

  return useCallback(
    (text: string) => {
      // Newer typing wins over whatever was waiting to be taken.
      cancelSettle();
      pendingEchoes.current = [...pendingEchoes.current, text];
      onChangeText(text);
    },
    [cancelSettle, onChangeText]
  );
}
