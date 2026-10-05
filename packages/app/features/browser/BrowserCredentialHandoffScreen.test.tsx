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
import type {
  BrowserCredentialHandoff,
  BrowserSecureField,
} from './browserCredentialHandoff';

const mocks = vi.hoisted(() => ({
  beginHandoff: vi.fn(),
  nextHandoff: vi.fn(),
  submitCredentials: vi.fn(),
  complete: vi.fn(),
  discard: vi.fn(),
  resolve: vi.fn(),
  openURL: vi.fn(),
  isWeb: false,
}));
vi.mock('@tloncorp/ui', () => ({
  Button: 'Button',
  Icon: 'Icon',
  Pressable: 'Pressable',
  Text: 'Text',
}));
vi.mock('react-native', () => ({ Linking: { openURL: mocks.openURL } }));
vi.mock('tamagui', () => ({
  get isWeb() {
    return mocks.isWeb;
  },
  View: 'View',
  XStack: 'XStack',
  YStack: 'YStack',
  ScrollView: 'ScrollView',
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
vi.mock('./browserCredentialHandoff', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./browserCredentialHandoff')>()),
  beginBrowserCredentialHandoff: mocks.beginHandoff,
  nextBrowserCredentialHandoff: mocks.nextHandoff,
  submitBrowserCredentials: mocks.submitCredentials,
}));

const username: BrowserSecureField = {
  id: 'f0',
  purpose: 'username',
  label: 'Email, phone, or username',
  inputType: 'text',
  required: true,
};
const password: BrowserSecureField = {
  id: 'f1',
  purpose: 'current-password',
  label: 'Password',
  inputType: 'password',
  required: true,
};
const code: BrowserSecureField = {
  id: 'f2',
  purpose: 'one-time-code',
  label: 'Verification code',
  inputType: 'text',
  required: true,
  exactLength: 6,
};
function form(
  fields: BrowserSecureField[] = [username, password],
  extra: Partial<BrowserCredentialHandoff> = {}
): BrowserCredentialHandoff {
  return {
    fillUrl: 'https://browser-session.tlon.network/credential-fills/one-use',
    formId: 'form-1',
    origin: 'https://example.com',
    expiresAt: Date.now() + 60_000,
    kind: 'login',
    fields,
    ...extra,
  };
}
async function render(navigation = { goBack: vi.fn(), isFocused: () => true }) {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <BrowserCredentialHandoffScreen
        navigation={navigation}
        route={{ params: { handoffId: 'opaque-handoff-id' } }}
      />
    );
  });
  return { renderer, navigation };
}
function enter(renderer: ReactTestRenderer, label: string, value: string) {
  renderer.root
    .findByProps({ accessibilityLabel: label })
    .props.onChangeText(value);
}
async function press(renderer: ReactTestRenderer, label = 'Continue') {
  await act(async () => {
    await renderer.root.findByProps({ label }).props.onPress();
  });
}

describe('secure browser form screen', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });
  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.isWeb = false;
    mocks.resolve.mockReturnValue(
      'https://browser-session.tlon.network/s/payload.signature'
    );
    mocks.beginHandoff.mockResolvedValue(form());
    mocks.nextHandoff.mockResolvedValue(null);
    mocks.submitCredentials.mockResolvedValue({ submitted: false });
    mocks.complete.mockResolvedValue(undefined);
  });

  it.each([password, code, username])(
    'locks $purpose before React commits pending state',
    async (field) => {
      mocks.beginHandoff.mockResolvedValue(form([field]));
      let finish!: (value: { submitted: boolean }) => void;
      mocks.submitCredentials.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      );
      const { renderer, navigation } = await render();
      act(() => enter(renderer, field.label, 'aBc123'));
      let submission!: Promise<void>;
      act(() => {
        submission = renderer.root
          .findByProps({ label: 'Continue' })
          .props.onPress();
        renderer.root
          .findByProps({ accessibilityLabel: field.label })
          .props.onSubmitEditing();
        void renderer.root.findByProps({ label: 'Continue' }).props.onPress();
      });
      expect(mocks.submitCredentials).toHaveBeenCalledOnce();
      expect(
        renderer.root.findByProps({ label: 'Continue' }).props.disabled
      ).toBe(true);
      await act(async () => {
        finish({ submitted: true });
        await submission;
      });
      expect(mocks.complete).toHaveBeenCalledOnce();
      expect(navigation.goBack).toHaveBeenCalledOnce();
      expect(JSON.stringify(renderer.toJSON())).not.toContain('aBc123');
      act(() => renderer.unmount());
    }
  );

  it('stays in secure entry through identifier, password, and code steps', async () => {
    mocks.beginHandoff.mockResolvedValue(form([username]));
    mocks.submitCredentials.mockResolvedValue({ submitted: true });
    const passwordStep = form([password], {
      formId: 'form-2',
      origin: 'https://identity.example',
    });
    const codeStep = form([code], {
      formId: 'form-3',
      origin: 'https://identity.example',
    });
    mocks.nextHandoff
      .mockResolvedValueOnce(passwordStep)
      .mockResolvedValueOnce(codeStep)
      .mockResolvedValueOnce(null);
    const { renderer, navigation } = await render();
    for (const [index, field] of [username, password, code].entries()) {
      expect(
        renderer.root.findByProps({ accessibilityLabel: field.label }).props
          .value
      ).toBe('');
      act(() =>
        enter(
          renderer,
          field.label,
          index === 2 ? 'aBc123' : `private-${index}`
        )
      );
      await press(renderer);
      if (index < 2) {
        expect(mocks.complete).not.toHaveBeenCalled();
        expect(navigation.goBack).not.toHaveBeenCalled();
      }
    }
    expect(mocks.submitCredentials.mock.calls.map((call) => call[1])).toEqual([
      { values: { f0: 'private-0' }, submit: true },
      { values: { f1: 'private-1' }, submit: true },
      { values: { f2: 'aBc123' }, submit: true },
    ]);
    expect(mocks.complete).toHaveBeenCalledOnce();
    expect(navigation.goBack).toHaveBeenCalledOnce();
    act(() => renderer.unmount());
  });

  it('fills card and address fields and choices without requesting transaction submission', async () => {
    const fields: BrowserSecureField[] = [
      {
        id: 'f0',
        purpose: 'cc-number',
        label: 'Card number',
        inputType: 'numeric',
        required: true,
      },
      {
        id: 'f1',
        purpose: 'street-address',
        label: 'Street address',
        inputType: 'textarea',
        required: true,
      },
      {
        id: 'f2',
        purpose: 'country',
        label: 'Country',
        inputType: 'select',
        required: true,
        options: [
          { value: '1', label: 'Canada' },
          { value: '2', label: 'United States' },
        ],
      },
    ];
    mocks.beginHandoff.mockResolvedValue(form(fields, { kind: 'details' }));
    const { renderer } = await render();
    act(() => {
      enter(renderer, 'Card number', '4111111111111111');
      enter(renderer, 'Street address', '1 Test St\nUnit 2');
    });
    await press(renderer, 'Choose country');
    await press(renderer, 'Canada');
    await press(renderer, 'Fill fields');
    expect(mocks.submitCredentials).toHaveBeenCalledWith(
      expect.anything(),
      {
        values: { f0: '4111111111111111', f1: '1 Test St\nUnit 2', f2: '1' },
        submit: false,
      },
      expect.any(AbortSignal)
    );
    expect(mocks.nextHandoff).not.toHaveBeenCalled();
    expect(mocks.complete).toHaveBeenCalledOnce();
    expect(JSON.stringify(renderer.toJSON())).not.toContain('4111111111111111');
    act(() => renderer.unmount());
  });

  it('continues with the bot when the filled login form has no safe submit control', async () => {
    const handoff = form([password]);
    mocks.beginHandoff.mockResolvedValue(handoff);
    mocks.submitCredentials.mockResolvedValue({ submitted: false });
    mocks.nextHandoff.mockResolvedValue(
      form([password], {
        fillUrl:
          'https://browser-session.tlon.network/credential-fills/fresh-handle',
      })
    );
    const { renderer, navigation } = await render();
    act(() => enter(renderer, 'Password', 'private-input'));
    await press(renderer);
    expect(mocks.submitCredentials).toHaveBeenCalledOnce();
    expect(mocks.submitCredentials).toHaveBeenCalledWith(
      handoff,
      { values: { f1: 'private-input' }, submit: true },
      expect.any(AbortSignal)
    );
    expect(mocks.nextHandoff).toHaveBeenCalledWith(
      'https://browser-session.tlon.network/s/payload.signature',
      handoff.formId,
      expect.any(AbortSignal)
    );
    expect(mocks.complete).toHaveBeenCalledOnce();
    expect(mocks.complete).toHaveBeenCalledWith('opaque-handoff-id');
    expect(navigation.goBack).toHaveBeenCalledOnce();
    expect(JSON.stringify(renderer.toJSON())).not.toContain('private-input');
    act(() => renderer.unmount());
  });

  it('does not auto-replay a form that remains after submission', async () => {
    mocks.beginHandoff.mockResolvedValue(form([password]));
    mocks.submitCredentials.mockResolvedValue({ submitted: true });
    mocks.nextHandoff.mockResolvedValue(form([password]));
    const { renderer } = await render();
    act(() => enter(renderer, 'Password', 'private-input'));
    await press(renderer);
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Password' }).props.value
    ).toBe('');
    expect(
      renderer.root.findByProps({ label: 'Continue' }).props.disabled
    ).toBe(true);
    expect(JSON.stringify(renderer.toJSON())).toContain(
      'The site still shows this form'
    );
    expect(mocks.submitCredentials).toHaveBeenCalledOnce();
    act(() => renderer.unmount());
  });

  it.each(['back', 'unmount'] as const)(
    'aborts pending submission on %s and ignores a late response',
    async (dismissal) => {
      let finish!: (value: { submitted: boolean }) => void;
      mocks.beginHandoff.mockResolvedValue(form([password]));
      mocks.submitCredentials.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      );
      const { renderer, navigation } = await render();
      act(() => enter(renderer, 'Password', 'secret'));
      let pending!: Promise<void>;
      act(() => {
        pending = renderer.root
          .findByProps({ label: 'Continue' })
          .props.onPress();
      });
      const signal = mocks.submitCredentials.mock.calls[0][2];
      await act(async () => {
        if (dismissal === 'unmount') renderer.unmount();
        else
          renderer.root
            .findByType('ScreenHeader' as React.ElementType)
            .props.backAction();
      });
      expect(signal.aborted).toBe(true);
      const tree = renderer.toJSON();
      await act(async () => {
        finish({ submitted: true });
        await pending;
      });
      expect(renderer.toJSON()).toEqual(tree);
      expect(mocks.nextHandoff).not.toHaveBeenCalled();
      expect(mocks.complete).not.toHaveBeenCalled();
      expect(navigation.goBack).toHaveBeenCalledTimes(
        dismissal === 'back' ? 1 : 0
      );
      if (dismissal === 'back') await act(async () => renderer.unmount());
      expect(mocks.discard).toHaveBeenCalledWith('opaque-handoff-id');
    }
  );

  it('aborts waiting for a next step without resuming the bot', async () => {
    let finish!: (value: BrowserCredentialHandoff | null) => void;
    mocks.beginHandoff.mockResolvedValue(form([password]));
    mocks.submitCredentials.mockResolvedValue({ submitted: true });
    mocks.nextHandoff.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const { renderer } = await render();
    act(() => enter(renderer, 'Password', 'secret'));
    let pending!: Promise<void>;
    await act(async () => {
      pending = renderer.root
        .findByProps({ label: 'Continue' })
        .props.onPress();
    });
    const signal = mocks.nextHandoff.mock.calls[0][2];
    act(() => renderer.unmount());
    await act(async () => {
      finish(null);
      await pending;
    });
    expect(signal.aborted).toBe(true);
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it('requires a fresh handle and fresh input after an uncertain fill response', async () => {
    mocks.beginHandoff.mockResolvedValue(form([password]));
    mocks.submitCredentials.mockRejectedValueOnce(new Error('Connection lost'));
    const { renderer } = await render();
    act(() => enter(renderer, 'Password', 'private-input'));
    await press(renderer);
    expect(renderer.root.findAllByProps({ label: 'Continue' })).toHaveLength(0);
    mocks.beginHandoff.mockRejectedValueOnce(new Error('Unavailable'));
    await press(renderer, 'Try again');
    expect(renderer.root.findAllByProps({ label: 'Continue' })).toHaveLength(0);
    mocks.beginHandoff.mockResolvedValueOnce(
      form([code], { origin: 'https://other.example', formId: 'next' })
    );
    await press(renderer, 'Try again');
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Verification code' })
        .props.value
    ).toBe('');
    expect(
      renderer.root.findByProps({ label: 'Continue' }).props.disabled
    ).toBe(true);
    expect(mocks.submitCredentials).toHaveBeenCalledOnce();
    act(() => renderer.unmount());
  });

  it('retries completion without filling a one-use form again', async () => {
    mocks.beginHandoff.mockResolvedValue(form([password]));
    mocks.complete.mockRejectedValueOnce(new Error('Could not notify the bot'));
    const { renderer } = await render();
    act(() => enter(renderer, 'Password', 'secret'));
    await press(renderer);
    await press(renderer, 'Return to conversation');
    expect(mocks.complete).toHaveBeenCalledTimes(2);
    expect(mocks.submitCredentials).toHaveBeenCalledOnce();
    act(() => renderer.unmount());
  });

  it.each(['focused', 'dismissed', 'unmounted'] as const)(
    'only navigates from an active route after completion: %s',
    async (state) => {
      mocks.beginHandoff.mockResolvedValue(form([password]));
      let finish!: () => void;
      mocks.complete.mockReturnValue(
        new Promise<void>((resolve) => {
          finish = resolve;
        })
      );
      let focused = true;
      const navigation = {
        isFocused: () => focused,
        goBack: vi.fn(() => {
          focused = false;
        }),
      };
      const { renderer } = await render(navigation);
      act(() => enter(renderer, 'Password', 'secret'));
      let pending!: Promise<void>;
      await act(async () => {
        pending = renderer.root
          .findByProps({ label: 'Continue' })
          .props.onPress();
      });
      if (state === 'dismissed')
        act(() =>
          renderer.root
            .findByType('ScreenHeader' as React.ElementType)
            .props.backAction()
        );
      if (state === 'unmounted') {
        focused = false;
        act(() => renderer.unmount());
      }
      await act(async () => {
        finish();
        await pending;
      });
      expect(navigation.goBack).toHaveBeenCalledTimes(
        state === 'unmounted' ? 0 : 1
      );
      if (state !== 'unmounted') act(() => renderer.unmount());
    }
  );

  it.each([true, false])(
    'uses target-site credential autofill only on native (web=%s)',
    async (web) => {
      mocks.isWeb = web;
      const { renderer } = await render();
      const inputs = renderer.root.findAllByType(
        'TextInput' as React.ElementType
      );
      expect(inputs[0].props.autoComplete).toBe(web ? 'off' : 'username');
      expect(inputs[1].props.autoComplete).toBe(
        web ? 'off' : 'current-password'
      );
      expect(inputs[1].props.secureTextEntry).toBe(true);
      act(() =>
        renderer.root
          .findByProps({ accessibilityLabel: 'Show password' })
          .props.onPress()
      );
      expect(inputs[1].props.secureTextEntry).toBe(false);
      act(() => renderer.unmount());
    }
  );

  it('offers the live browser when a form is unsupported', async () => {
    mocks.beginHandoff.mockRejectedValue(new Error('No supported form'));
    const { renderer } = await render();
    await press(renderer, 'Open live browser');
    expect(mocks.openURL).toHaveBeenCalledWith(
      'https://browser-session.tlon.network/s/payload.signature'
    );
    expect(mocks.submitCredentials).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });

  it('requires reopening an unavailable in-memory handoff', async () => {
    mocks.resolve.mockReturnValue(undefined);
    const { renderer } = await render();
    expect(mocks.beginHandoff).not.toHaveBeenCalled();
    expect(JSON.stringify(renderer.toJSON())).toContain(
      'Reopen the secure browser form'
    );
    await act(async () => renderer.unmount());
    expect(mocks.discard).toHaveBeenCalledWith('opaque-handoff-id');
  });
});
