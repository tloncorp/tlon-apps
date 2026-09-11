import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button, Pressable } from '@tloncorp/ui';
import { config } from '@tloncorp/ui/config';
import React from 'react';
import { GestureResponderEvent, Text } from 'react-native';
import { TamaguiProvider } from 'tamagui';

// Importing anything from the `@tloncorp/ui` barrel drags in `@tloncorp/shared`'s
// store (via `Carousel` -> `Image`), which reaches expo native modules that have
// no JSI backing under jest.
jest.mock('expo-contacts', () => ({}));
jest.mock('expo-speech-recognition', () => ({}));

// Regression test for TLON-6529 (Sentry REACT-NATIVE-13R). `Pressable` used to
// call `useLinkProps` on every render, which throws "Couldn't find a navigation
// object" wherever it renders outside a `NavigationContainer` — as it does when
// `@gorhom/portal` hoists a sheet out of the navigation tree during onboarding.
// These tests render with no navigation context at all.
function renderWithoutNavigation(ui: React.ReactElement) {
  return render(
    <TamaguiProvider config={config} defaultTheme="light">
      {ui}
    </TamaguiProvider>
  );
}

describe('Pressable outside a NavigationContainer', () => {
  it('renders and handles presses', () => {
    const onPress = jest.fn<(event: GestureResponderEvent) => void>();

    expect(() =>
      renderWithoutNavigation(
        <Pressable testID="pressable" onPress={onPress}>
          <Text>tap</Text>
        </Pressable>
      )
    ).not.toThrow();

    fireEvent.press(screen.getByTestId('pressable'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // The reported crash arrived through `styled(Pressable)`, so cover a wrapper
  // as well as the bare component.
  it('renders and handles presses through Button', () => {
    const onPress = jest.fn<(event: GestureResponderEvent) => void>();

    expect(() =>
      renderWithoutNavigation(
        <Button testID="button" label="x" onPress={onPress} />
      )
    ).not.toThrow();

    fireEvent.press(screen.getByTestId('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
