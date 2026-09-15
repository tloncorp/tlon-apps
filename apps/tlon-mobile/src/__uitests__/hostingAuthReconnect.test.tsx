import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react-native';
import type { HostingLoginOtpInfo } from '@tloncorp/api';
import { useCallback, type PropsWithChildren, type ReactNode } from 'react';
import type { PressableProps } from 'react-native';

import { useRecaptcha } from '../hooks/useRecaptcha';
import { useOnboardingContext } from '../lib/OnboardingContext';
import { HostingAuthReconnectScreen } from '../screens/HostingAuthReconnectScreen';

jest.mock('@tloncorp/app/constants', () => ({
  RECAPTCHA_SITE_KEY: 'test-key',
}));
jest.mock('@tloncorp/shared', () => ({
  createDevLogger: () => ({
    log: jest.fn(),
    trackEvent: jest.fn(),
    trackError: jest.fn(),
  }),
}));
jest.mock('../lib/OnboardingContext', () => ({
  useOnboardingContext: jest.fn(),
}));
jest.mock(
  '@tloncorp/api',
  () => ({ HostingError: class HostingError extends Error {} }),
  { virtual: true }
);
jest.mock('@tloncorp/app/ui', () => {
  const { View, Text, Pressable } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const ScreenHeader = ({ leftControls }: { leftControls: ReactNode }) => (
    <View>{leftControls}</View>
  );
  ScreenHeader.TextButton = ({
    children,
    ...props
  }: PropsWithChildren<PressableProps>) => (
    <Pressable accessibilityRole="button" {...props}>
      <Text>{children}</Text>
    </Pressable>
  );
  return {
    AppDataContextProvider: View,
    KeyboardAvoidingView: View,
    LoadingSpinner: View,
    ScreenHeader,
    TlonText: { Text },
    View,
    YStack: View,
  };
});
jest.mock('@tloncorp/app/ui/components/Badge', () => ({ Badge: () => null }));
jest.mock('@tloncorp/app/ui/components/ProfileRow', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@tloncorp/ui', () => {
  const { Pressable, Text } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Button: ({ label, ...props }: PressableProps & { label: string }) => (
      <Pressable accessibilityRole="button" {...props}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});
jest.mock('../components/OnboardingInputs', () => {
  const { TextInput } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    OTPInput: ({
      onChange,
      value,
      length,
    }: {
      onChange: (code: string[]) => void;
      value: string[];
      length: number;
    }) => (
      <TextInput
        testID="otp"
        value={value.join('')}
        onChangeText={(text) =>
          onChange(Array.from({ length }, (_, index) => text[index] ?? ''))
        }
      />
    ),
  };
});

const initRecaptcha =
  jest.fn<ReturnType<typeof useOnboardingContext>['initRecaptcha']>();
const execRecaptchaLogin = jest.fn<() => Promise<string>>();
const execRecaptchaRequestOtp = jest.fn<() => Promise<string>>();
const sendCode = jest.fn<() => Promise<HostingLoginOtpInfo>>();
const verifyCode = jest.fn<(otp: string) => Promise<void>>();
const logout = jest.fn<() => void>();

function ReconnectGate({ expired }: { expired: boolean }) {
  const { getToken: getRecaptchaToken } = useRecaptcha(expired);
  const requestCode = useCallback(async () => {
    await getRecaptchaToken('request_otp');
    return sendCode();
  }, [getRecaptchaToken]);
  return expired ? (
    <HostingAuthReconnectScreen
      profileId="~zod"
      onRequestCode={requestCode}
      onVerifyCode={verifyCode}
      onLogout={logout}
    />
  ) : null;
}

describe('Hosting auth reconnect interactions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    initRecaptcha.mockReset().mockResolvedValue('initialized');
    verifyCode.mockReset();
    execRecaptchaLogin.mockResolvedValue('login-token');
    execRecaptchaRequestOtp.mockResolvedValue('otp-token');
    sendCode.mockResolvedValue({ retryAfter: 0 });
    jest.mocked(useOnboardingContext).mockReturnValue({
      initRecaptcha,
      execRecaptchaLogin,
      execRecaptchaRequestOtp,
    } as unknown as ReturnType<typeof useOnboardingContext>);
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  it('waits for slow initialization and automatically sends one code', async () => {
    initRecaptcha.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve('initialized'), 6000);
        })
    );
    const view = render(<ReconnectGate expired={false} />);
    expect(initRecaptcha).not.toHaveBeenCalled();

    view.rerender(<ReconnectGate expired />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(4000);
    });
    expect(screen.getByText('Sending a code…')).toBeTruthy();
    expect(sendCode).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByText('Confirm code')).toBeTruthy();
    expect(initRecaptcha).toHaveBeenCalledTimes(1);
    expect(initRecaptcha).toHaveBeenCalledWith('test-key', 10_000);
    expect(execRecaptchaRequestOtp).toHaveBeenCalledTimes(1);
    expect(sendCode).toHaveBeenCalledTimes(1);
  });

  it('allows retrying after initialization fails', async () => {
    initRecaptcha.mockRejectedValueOnce(new Error('Initialization failed'));
    render(<ReconnectGate expired />);
    await act(async () => {});
    expect(
      screen.getByText(
        'We could not send a confirmation code. Please try again.'
      )
    ).toBeTruthy();
    expect(sendCode).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Send code'));
    });
    expect(initRecaptcha).toHaveBeenCalledTimes(2);
    expect(sendCode).toHaveBeenCalledTimes(1);
  });

  it('still supports the default login action', async () => {
    const { result } = renderHook(() => useRecaptcha());
    await expect(result.current.getToken()).resolves.toBe('login-token');
    expect(execRecaptchaLogin).toHaveBeenCalledTimes(1);
    expect(execRecaptchaRequestOtp).not.toHaveBeenCalled();
    expect(initRecaptcha).toHaveBeenCalledTimes(1);
  });

  it.each([
    { method: 'typing', values: ['1', '12', '123', '1234', '12345', '123456'] },
    { method: 'pasting', values: ['123456'] },
  ])(
    'automatically verifies a complete code after $method',
    async ({ values }) => {
      let finishVerification!: () => void;
      verifyCode.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finishVerification = resolve;
          })
      );
      render(
        <HostingAuthReconnectScreen
          profileId="~zod"
          autoRequest={false}
          initialOtpInfo={{ retryAfter: 0 }}
          onRequestCode={sendCode}
          onVerifyCode={verifyCode}
          onLogout={logout}
        />
      );

      for (const value of values) {
        fireEvent.changeText(screen.getByTestId('otp'), value);
        if (value.length < 6) {
          expect(verifyCode).not.toHaveBeenCalled();
        }
      }
      expect(verifyCode).toHaveBeenCalledWith('123456');
      expect(
        screen.getByTestId('hosting-auth-reconnect-primary-action').props
          .loading
      ).toBe(true);

      fireEvent.changeText(screen.getByTestId('otp'), '123456');
      fireEvent.press(screen.getByText('Confirm code'));
      expect(verifyCode).toHaveBeenCalledTimes(1);

      await act(async () => finishVerification());
    }
  );

  it('allows another automatic verification after a failed attempt', async () => {
    verifyCode
      .mockRejectedValueOnce(new Error('Verification failed'))
      .mockResolvedValueOnce();
    render(
      <HostingAuthReconnectScreen
        profileId="~zod"
        autoRequest={false}
        initialOtpInfo={{ retryAfter: 0 }}
        onRequestCode={sendCode}
        onVerifyCode={verifyCode}
        onLogout={logout}
      />
    );

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('otp'), '123456');
    });
    expect(screen.getByTestId('otp').props.value).toBe('');
    expect(
      screen.getByTestId('hosting-auth-reconnect-primary-action').props.loading
    ).toBe(false);

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('otp'), '123456');
    });
    expect(verifyCode).toHaveBeenCalledTimes(2);
  });

  it('disables logout until pending verification fails', async () => {
    let rejectVerification!: (error: Error) => void;
    verifyCode.mockImplementation(
      () =>
        new Promise<void>((_, reject) => {
          rejectVerification = reject;
        })
    );
    render(
      <HostingAuthReconnectScreen
        profileId="~zod"
        autoRequest={false}
        initialOtpInfo={{ retryAfter: 0 }}
        onRequestCode={sendCode}
        onVerifyCode={verifyCode}
        onLogout={logout}
      />
    );
    fireEvent.changeText(screen.getByTestId('otp'), '123456');
    expect(verifyCode).toHaveBeenCalledWith('123456');
    fireEvent.press(screen.getByText('Log out'));
    expect(logout).not.toHaveBeenCalled();

    await act(async () => {
      rejectVerification(new Error('Verification failed'));
    });
    fireEvent.press(screen.getByText('Log out'));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
