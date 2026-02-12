import { Alert } from 'react-native';

/**
 * Shows an alert with a single acknowledgement button.
 * Resolves when the user taps the button.
 */
export function platformAlert(
  title: string,
  message: string,
  buttonLabel: string
): Promise<void> {
  return new Promise<void>((resolve) => {
    Alert.alert(
      title,
      message,
      [{ text: buttonLabel, onPress: () => resolve() }],
      {
        cancelable: false,
      }
    );
  });
}
