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
}));

vi.mock('@tloncorp/ui', () => ({
  Button: 'Button',
  Icon: 'Icon',
  Pressable: 'Pressable',
  Text: 'Text',
}));

vi.mock('tamagui', () => ({
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

vi.mock('./BrowserCredentialHandoffCompletion', () => ({
  useBrowserCredentialHandoffCompletion: () => ({
    complete: mocks.complete,
    discard: mocks.discard,
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

  it('retains credentials and does not offer continuation when submission fails', async () => {
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <BrowserCredentialHandoffScreen
          navigation={{ goBack: vi.fn() }}
          route={{
            params: {
              viewerUrl:
                'https://browser-session-ovh1.tlon.network/s/payload.signature',
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
      renderer!.root.findByProps({ autoComplete: 'username' }).props.value
    ).toBe('person@example.com');
    expect(
      renderer!.root.findByProps({ autoComplete: 'current-password' }).props
        .value
    ).toBe('keep-in-form');
    expect(renderer!.root.findByProps({ label: 'Password' }).props.error).toBe(
      'The browser filled the form but could not submit it. Check that the entries are correct and try again.'
    );
    expect(
      renderer!.root.findAllByProps({ label: 'Return to conversation' })
    ).toHaveLength(0);

    act(() => renderer!.unmount());
  });
});
