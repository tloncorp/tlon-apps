export type KeyboardControlEvent = {
  key: string;
  repeat?: boolean;
  preventDefault: () => void;
};

/** Give the cross-platform Pressable's web div native-button keyboard behavior. */
export function activateAgentControlFromKeyboard(
  event: KeyboardControlEvent,
  activate: () => void
) {
  if (event.repeat || (event.key !== 'Enter' && event.key !== ' ')) {
    return;
  }

  event.preventDefault();
  activate();
}
