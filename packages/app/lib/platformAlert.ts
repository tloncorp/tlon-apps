/**
 * Web fallback — uses window.alert which blocks until acknowledged.
 */
export function platformAlert(
  title: string,
  message: string,
  _buttonLabel: string
): Promise<void> {
  window.alert(`${title}\n\n${message}`);
  return Promise.resolve();
}
