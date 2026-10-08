import { afterEach, beforeEach, describe, it, jest } from '@jest/globals';
import {
  NavigationContainer,
  NavigationIndependentTree,
} from '@react-navigation/native';
import { render, screen, userEvent } from '@testing-library/react-native';
import '@testing-library/react-native/extend-expect';
import { DESK_UPDATE_HELP_URL, SUPPORT_EMAIL } from '@tloncorp/app/constants';
import { DeskOutdatedScreen } from '@tloncorp/app/features/DeskOutdatedScreen';
import { Provider as TamaguiProvider } from '@tloncorp/app/provider';
import { QueryClientProvider, queryClient } from '@tloncorp/shared';
import type { ComponentProps, PropsWithChildren } from 'react';
import { Linking } from 'react-native';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';

// Reached transitively through the UI packages; their native modules can't load
// under jest and nothing on this screen touches them.
jest.mock('expo-contacts', () => ({}));
jest.mock('expo-speech-recognition', () => ({}));

type ScreenProps = ComponentProps<typeof DeskOutdatedScreen>;

function Wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationIndependentTree>
        <NavigationContainer>
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <TamaguiProvider defaultTheme="light">{children}</TamaguiProvider>
          </SafeAreaProvider>
        </NavigationContainer>
      </NavigationIndependentTree>
    </QueryClientProvider>
  );
}

function screenWith(props: Partial<ScreenProps> = {}) {
  return (
    <DeskOutdatedScreen
      currentVersion="12.1.0"
      minimumVersion="12.2.0"
      onRetry={() => {}}
      {...props}
    />
  );
}

function renderScreen(props: Partial<ScreenProps> = {}) {
  return render(screenWith(props), { wrapper: Wrapper });
}

describe('DeskOutdatedScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('reports the version the ship has and the one it needs', () => {
    renderScreen();

    expect(screen.getByTestId('desk-outdated-screen')).toBeOnTheScreen();
    expect(screen.getByTestId('desk-outdated-current')).toHaveTextContent(
      '12.1.0'
    );
    expect(screen.getByTestId('desk-outdated-minimum')).toHaveTextContent(
      '12.2.0'
    );
  });

  it('falls back to generic copy when no version was reported', () => {
    renderScreen({ currentVersion: null });

    expect(screen.getByTestId('desk-outdated-current')).toHaveTextContent(
      'an older version'
    );
  });

  it('retries on demand, and not while a probe is already running', async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();
    const { rerender } = renderScreen({ onRetry });

    await user.press(screen.getByTestId('desk-outdated-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(screenWith({ onRetry, isProbing: true }));

    await user.press(screen.getByTestId('desk-outdated-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('tells a hosted customer Tlon runs the update, and drops the how-to', async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();
    renderScreen({ isHosted: true, onRetry });

    // The version sentence still reports what the ship has and what it needs.
    expect(screen.getByTestId('desk-outdated-current')).toHaveTextContent(
      '12.1.0'
    );
    expect(screen.getByTestId('desk-outdated-minimum')).toHaveTextContent(
      '12.2.0'
    );
    expect(screen.getByTestId('desk-outdated-hosted-note')).toBeOnTheScreen();
    // Nothing a hosted customer could act on: they have no shell to run the
    // self-hosting instructions in.
    expect(screen.queryByTestId('desk-outdated-help')).toBeNull();
    // Support is the escalation the copy points at, so it has to be there.
    expect(screen.getByText(SUPPORT_EMAIL)).toBeOnTheScreen();

    await user.press(screen.getByTestId('desk-outdated-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('keeps the self-update instructions for a self-hosted ship', () => {
    renderScreen();

    expect(screen.getByTestId('desk-outdated-help')).toBeOnTheScreen();
    expect(screen.queryByTestId('desk-outdated-hosted-note')).toBeNull();
  });

  it('opens the update instructions', async () => {
    const user = userEvent.setup();
    const openURL = jest
      .spyOn(Linking, 'openURL')
      .mockImplementation(async () => true);
    renderScreen();

    await user.press(screen.getByTestId('desk-outdated-help'));

    expect(openURL).toHaveBeenCalledWith(DESK_UPDATE_HELP_URL);
  });

  it('offers a way out when a logout handler is given', async () => {
    const user = userEvent.setup();
    const onLogout = jest.fn<() => void>();
    renderScreen({ onLogout });

    await user.press(screen.getByText('Log out'));

    expect(onLogout).toHaveBeenCalled();
  });

  it('omits the logout control where there is no logout to offer', () => {
    renderScreen();

    expect(screen.queryByText('Log out')).toBeNull();
  });
});
