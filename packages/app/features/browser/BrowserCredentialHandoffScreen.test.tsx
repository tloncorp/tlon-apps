import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { BrowserCredentialHandoffScreen } from './BrowserCredentialHandoffScreen';

const mocks = vi.hoisted(() => ({
  beginHandoff: vi.fn(),
  submitCredentials: vi.fn(),
  complete: vi.fn(),
  discard: vi.fn(),
  resolve: vi.fn(),
  isWeb: false,
}));

vi.mock('@tloncorp/ui', () => ({
  Button: 'Button',
  Icon: 'Icon',
  Pressable: 'Pressable',
  Text: 'Text',
}));

vi.mock('tamagui', () => ({
  get isWeb() {
    return mocks.isWeb;
  },
  View: 'View',
  XStack: 'XStack',
  YStack: 'YStack',
}));

vi.mock('../../ui', () => ({
  Field: 'Field',
  ScreenHeader: 'ScreenHeader',
  SettingsContentScrollView: 'SettingsContentScrollView',
  TextInput: 'TextInput',
}));

vi.mock('./BrowserCredentialHandoffProvider', () => ({
  useBrowserCredentialHandoff: () => ({
    complete: mocks.complete,
    discard: mocks.discard,
    resolve: mocks.resolve,
  }),
}));

vi.mock('./browserCredentialHandoff', () => ({
  beginBrowserCredentialHandoff: mocks.beginHandoff,
  submitBrowserCredentials: mocks.submitCredentials,
}));

describe('BrowserCredentialHandoffScreen', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isWeb = false;
    mocks.resolve.mockReturnValue(
      'https://browser-session-ovh1.tlon.network/s/payload.signature'
    );
    mocks.beginHandoff.mockResolvedValue({
      fillUrl:
        'https://browser-session-ovh1.tlon.network/credential-fills/handoff',
      origin: 'https://example.com',
      expiresAt: Date.now() + 60_000,
      kind: 'password',
      hasUsername: true,
    });
    mocks.submitCredentials.mockResolvedValue({ submitted: false });
  });

  it.each(['not submitted', 'request failed'])(
    'obtains a fresh handle before resubmitting after %s',
    async (failure) => {
      if (failure === 'request failed') {
        mocks.submitCredentials.mockRejectedValueOnce(
          new Error('Connection lost')
        );
      }
      let renderer: ReactTestRenderer;
      await act(async () => {
        renderer = create(
          <BrowserCredentialHandoffScreen
            navigation={{ goBack: vi.fn(), isFocused: () => true }}
            route={{
              params: {
                handoffId: 'opaque-handoff-id',
              },
            }}
          />
        );
      });

      const usernameInput = renderer!.root.findByProps({
        autoComplete: 'username',
      });
      const passwordInput = renderer!.root.findByProps({
        autoComplete: 'current-password',
      });

      act(() => {
        usernameInput.props.onChangeText('person@example.com');
        passwordInput.props.onChangeText('keep-in-form');
      });
      await act(async () => {
        await renderer!.root
          .findByProps({ label: 'Fill and sign in' })
          .props.onPress();
      });

      expect(mocks.submitCredentials).toHaveBeenCalledWith(expect.any(Object), {
        username: 'person@example.com',
        password: 'keep-in-form',
        submit: true,
      });
      expect(
        renderer!.root.findAllByProps({ label: 'Fill and sign in' })
      ).toHaveLength(0);
      expect(
        renderer!.root.findAllByProps({ label: 'Return to conversation' })
      ).toHaveLength(0);

      // A failed refresh must not expose the consumed handle for another submit.
      mocks.beginHandoff.mockRejectedValueOnce(
        new Error('Browser unavailable')
      );
      await act(async () => {
        renderer!.root.findByProps({ label: 'Try again' }).props.onPress();
      });
      expect(
        renderer!.root.findAllByProps({ label: 'Fill and sign in' })
      ).toHaveLength(0);
      expect(mocks.submitCredentials).toHaveBeenCalledTimes(1);

      const freshHandoff = {
        ...mocks.submitCredentials.mock.calls[0][0],
        fillUrl:
          'https://browser-session-ovh1.tlon.network/credential-fills/fresh',
      };
      mocks.beginHandoff.mockResolvedValueOnce(freshHandoff);
      await act(async () => {
        renderer!.root.findByProps({ label: 'Try again' }).props.onPress();
      });
      expect(mocks.beginHandoff).toHaveBeenCalledTimes(3);
      expect(
        renderer!.root.findByProps({ autoComplete: 'username' }).props.value
      ).toBe('person@example.com');
      expect(
        renderer!.root.findByProps({ autoComplete: 'current-password' }).props
          .value
      ).toBe('keep-in-form');
      mocks.submitCredentials.mockResolvedValueOnce({ submitted: true });
      await act(async () => {
        await renderer!.root
          .findByProps({ label: 'Fill and sign in' })
          .props.onPress();
      });
      expect(mocks.submitCredentials).toHaveBeenLastCalledWith(freshHandoff, {
        username: 'person@example.com',
        password: 'keep-in-form',
        submit: true,
      });
      act(() => renderer!.unmount());
    }
  );

  it('submits a verification code with its original casing', async () => {
    mocks.beginHandoff.mockResolvedValue({
      fillUrl:
        'https://browser-session-ovh1.tlon.network/credential-fills/handoff',
      origin: 'https://example.com',
      expiresAt: Date.now() + 60_000,
      kind: 'otp',
    });
    mocks.submitCredentials.mockResolvedValue({ submitted: true });
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <BrowserCredentialHandoffScreen
          navigation={{ goBack: vi.fn(), isFocused: () => true }}
          route={{
            params: {
              handoffId: 'opaque-handoff-id',
            },
          }}
        />
      );
    });
    const input = renderer!.root.findByProps({ autoComplete: 'one-time-code' });
    expect(input.props.autoCapitalize).toBe('none');
    act(() => input.props.onChangeText('aBc123'));
    await act(async () => {
      await renderer!.root
        .findByProps({ label: 'Submit code' })
        .props.onPress();
    });
    expect(mocks.submitCredentials).toHaveBeenCalledWith(expect.any(Object), {
      code: 'aBc123',
      submit: true,
    });
    act(() => renderer!.unmount());
  });

  it.each(['focused', 'dismissed', 'unmounted'] as const)(
    'only navigates back from an active route after completion (%s)',
    async (routeState) => {
      mocks.beginHandoff.mockResolvedValue({
        kind: 'otp',
        origin: 'https://example.com',
      });
      mocks.submitCredentials.mockResolvedValue({ submitted: true });
      let finishCompletion!: () => void;
      mocks.complete.mockReturnValue(
        new Promise<void>((resolve) => {
          finishCompletion = resolve;
        })
      );
      let focused = true;
      const navigation = {
        isFocused: () => focused,
        goBack: vi.fn(() => {
          focused = false;
        }),
      };
      let renderer: ReactTestRenderer;
      await act(async () => {
        renderer = create(
          <BrowserCredentialHandoffScreen
            navigation={navigation}
            route={{ params: { handoffId: 'opaque-handoff-id' } }}
          />
        );
      });
      act(() => {
        renderer!.root
          .findByProps({ autoComplete: 'one-time-code' })
          .props.onChangeText('123456');
      });
      await act(async () => {
        await renderer!.root
          .findByProps({ label: 'Submit code' })
          .props.onPress();
      });
      let returning!: Promise<void>;
      act(() => {
        returning = renderer!.root
          .findByProps({ label: 'Return to conversation' })
          .props.onPress();
      });
      expect(mocks.complete).toHaveBeenCalledWith('opaque-handoff-id');
      expect(navigation.goBack).not.toHaveBeenCalled();
      if (routeState === 'dismissed') {
        act(() => {
          renderer!.root
            .findByType('ScreenHeader' as React.ElementType)
            .props.backAction();
        });
      } else if (routeState === 'unmounted') {
        focused = false;
        act(() => renderer!.unmount());
      }
      await act(async () => {
        finishCompletion();
        await returning;
      });
      expect(navigation.goBack).toHaveBeenCalledTimes(
        routeState === 'unmounted' ? 0 : 1
      );
      if (routeState !== 'unmounted') act(() => renderer!.unmount());
    }
  );

  it.each([true, false])(
    'sets credential autofill for isWeb=%s',
    async (isWeb) => {
      mocks.isWeb = isWeb;
      let renderer: ReactTestRenderer;
      await act(async () => {
        renderer = create(
          <BrowserCredentialHandoffScreen
            navigation={{ goBack: vi.fn(), isFocused: () => true }}
            route={{ params: { handoffId: 'opaque-handoff-id' } }}
          />
        );
      });
      const inputs = renderer!.root.findAllByType(
        'TextInput' as React.ElementType
      );
      expect(inputs).toHaveLength(2);
      expect(inputs[0].props).toMatchObject({
        autoComplete: isWeb ? 'off' : 'username',
        textContentType: isWeb ? 'none' : 'username',
        importantForAutofill: isWeb ? 'no' : 'yes',
      });
      expect(inputs[1].props).toMatchObject({
        autoComplete: isWeb ? 'off' : 'current-password',
        textContentType: isWeb ? 'none' : 'password',
        importantForAutofill: isWeb ? 'no' : 'yes',
        secureTextEntry: true,
      });
      act(() =>
        renderer!.root
          .findByProps({ accessibilityLabel: 'Show password' })
          .props.onPress()
      );
      expect(inputs[1].props.autoComplete).toBe(
        isWeb ? 'off' : 'current-password'
      );
      await act(async () => renderer!.unmount());
    }
  );

  it('requires reopening the card when the in-memory handoff is unavailable', async () => {
    mocks.resolve.mockReturnValue(undefined);
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <BrowserCredentialHandoffScreen
          navigation={{ goBack: vi.fn(), isFocused: () => true }}
          route={{ params: { handoffId: 'expired-id' } }}
        />
      );
    });
    expect(mocks.beginHandoff).not.toHaveBeenCalled();
    expect(JSON.stringify(renderer!.toJSON())).toContain(
      'Reopen the browser login form from the conversation.'
    );
    await act(async () => renderer!.unmount());
    expect(mocks.discard).toHaveBeenCalledWith('expired-id');
  });
});
