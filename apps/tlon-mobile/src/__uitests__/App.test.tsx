import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { setupDb } from '@tloncorp/app/lib/nativeDb';
import fetchMock from 'jest-fetch-mock';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { act } from 'react-test-renderer';

import App from '../App.main';

describe('App', () => {
  beforeAll(() => {
    setupDb();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock.resetMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders', async () => {
    fetchMock.enableMocks();

    const user = userEvent.setup();

    const app = await waitFor(() => {
      return render(
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <App />
        </SafeAreaProvider>
      );
    });

    await user.press(await app.findByText('Configure self-hosted'));

    await user.type(
      screen.getByTestId('textInput shipUrl'),
      'http://localhost'
    );
    await user.type(
      screen.getByTestId('textInput accessCode'),
      'sicben-tocdep-shanem-gillis'
    );

    fetchMock.once(async (req) => {
      expect(req.url).toBe('http://localhost/~/login');
      return {
        status: 200,
        headers: {
          'set-cookie': 'urbauth-~botnul-banpex-ravseg-nosduc=',
        },
      };
    });

    await user.press(screen.getByText('Connect'));

    // Wait for animations to complete
    await act(async () => {
      await jest.runAllTimersAsync();
    });

    const eulaLabel = screen.queryByText(/End-User License Agreement/);
    expect(eulaLabel).not.toBeNull();

    await user.press(screen.getByText('I Agree'));

    // Wait for animations to complete
    await act(async () => {
      await jest.runAllTimersAsync();
    });

    // See mock of `AuthenticatedApp` in `jestSetup.tsx`
    expect(screen.queryByText('AuthenticatedApp')).not.toBeNull();
  });
});
