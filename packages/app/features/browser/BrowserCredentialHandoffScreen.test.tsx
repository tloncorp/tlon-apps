import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import {
  afterAll,
  beforeAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { BrowserCredentialHandoffScreen } from './BrowserCredentialHandoffScreen';
import { BrowserViewerModal } from './BrowserViewerModal';
import {
  BrowserFormError,
  type BrowserCredentialHandoff,
  type BrowserSecureField,
} from './browserCredentialHandoff';

const mocks = vi.hoisted(() => ({
  beginHandoff: vi.fn(),
  submitCredentials: vi.fn(),
  authorize: vi.fn(),
  cancel: vi.fn(),
  discard: vi.fn(),
  resolve: vi.fn(),
  isWeb: false,
  openURL: vi.fn(),
  openWindow: vi.fn(),
}));
vi.mock('@tloncorp/shared', () => ({
  createDevLogger: () => ({ trackError: vi.fn() }),
}));
vi.mock('react-native', () => ({
  Linking: { openURL: mocks.openURL },
  Keyboard: { dismiss: vi.fn() },
  Switch: 'Switch',
}));
vi.mock('@tloncorp/ui', () => ({
  Button: 'Button',
  Icon: 'Icon',
  Pressable: 'Pressable',
  Text: 'Text',
}));
vi.mock('./BrowserViewerModal', () => ({
  BrowserViewerModal: 'BrowserViewerModal',
}));
vi.mock('tamagui', () => ({
  get isWeb() {
    return mocks.isWeb;
  },
  View: 'View',
  XStack: 'XStack',
  YStack: 'YStack',
  ScrollView: 'ScrollView',
}));
vi.mock('../../ui/components/Form/inputs', () => ({ TextInput: 'TextInput' }));
vi.mock('../../ui', () => ({
  Field: 'Field',
  ScreenHeader: 'ScreenHeader',
  SettingsContentScrollView: 'SettingsContentScrollView',
  TextInput: 'TextInput',
}));
vi.mock('./BrowserCredentialHandoffProvider', () => ({
  useBrowserCredentialHandoff: () => ({
    discard: mocks.discard,
    resolve: mocks.resolve,
  }),
}));
vi.mock('./browserCredentialHandoff', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./browserCredentialHandoff')>();
  return {
    ...actual,
    authorizeBrowserViewer: async (url: string) =>
      actual.trustedBrowserViewerUrl(url),
    beginBrowserCredentialHandoff: mocks.beginHandoff,
    submitBrowserCredentials: mocks.submitCredentials,
    authorizeBrowserLogins: mocks.authorize,
    cancelBrowserCredentialHandoff: mocks.cancel,
  };
});

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
async function render(
  navigation = { goBack: vi.fn(), isFocused: () => true },
  loginApproval?: { record?: { id: string; revision: number } }
) {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <BrowserCredentialHandoffScreen
        navigation={navigation}
        route={{
          params: {
            handoffId: 'opaque-handoff-id',
            ...(loginApproval ? { loginApproval } : {}),
          },
        }}
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
async function press(renderer: ReactTestRenderer, label = 'Fill fields') {
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
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.openWindow.mockReturnValue({
      opener: {},
      document: { write: vi.fn() },
      location: { replace: vi.fn() },
      close: vi.fn(),
      closed: false,
    });
    vi.stubGlobal(
      'window',
      Object.assign(new EventTarget(), { open: mocks.openWindow })
    );
    vi.stubGlobal(
      'document',
      Object.assign(new EventTarget(), { visibilityState: 'visible' })
    );
    mocks.isWeb = false;
    mocks.resolve.mockReturnValue(
      'https://browser-session.tlon.network/s/payload.signature'
    );
    mocks.beginHandoff.mockResolvedValue(form());
    mocks.submitCredentials.mockResolvedValue({ submitted: false });
    mocks.cancel.mockResolvedValue(undefined);
    mocks.authorize.mockResolvedValue({ grant: 'g'.repeat(43), accounts: [] });
  });

  const vault = {
    planet: 'sampel-palnet',
    moon: 'pinser-botter-sampel-palnet',
    authorizeUrl:
      'https://browser-session.tlon.network/credential-vault/handoff',
  };

  it('clears temporary vault state on cancellation but preserves a completed handoff', async () => {
    const canceled = await render();
    await press(canceled.renderer, 'Cancel secure entry');
    await act(async () => canceled.renderer.unmount());
    expect(mocks.cancel).toHaveBeenCalledWith(
      'https://browser-session.tlon.network/s/payload.signature'
    );
    mocks.cancel.mockClear();
    const completed = await render();
    act(() => {
      enter(completed.renderer, username.label, 'fixture-user');
      enter(completed.renderer, password.label, 'fixture-password');
    });
    await press(completed.renderer);
    await act(async () => completed.renderer.unmount());
    expect(mocks.cancel).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'reopens a dismissed form with empty inputs (web: %s)',
    async (web) => {
      mocks.isWeb = web;
      const first = await render();
      act(() => enter(first.renderer, password.label, 'unsent-password'));
      await act(async () => first.renderer.unmount());
      expect(mocks.cancel).not.toHaveBeenCalled();
      const reopened = await render();
      expect(mocks.beginHandoff).toHaveBeenCalledTimes(2);
      expect(
        reopened.renderer.root.findByProps({
          accessibilityLabel: password.label,
        }).props.value
      ).toBe('');
      expect(
        reopened.renderer.root.findAllByProps({ label: 'Fill fields' })
      ).toHaveLength(1);
      await act(async () => reopened.renderer.unmount());
    }
  );

  it('keeps the sheet open when explicit cancellation fails', async () => {
    mocks.cancel.mockRejectedValueOnce(new Error('Network unavailable'));
    const { renderer, navigation } = await render();
    await press(renderer, 'Cancel secure entry');
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(JSON.stringify(renderer.toJSON())).toContain(
      'Could not cancel secure entry. Try again.'
    );
    await press(renderer, 'Cancel secure entry');
    expect(navigation.goBack).toHaveBeenCalledOnce();
    await act(async () => renderer.unmount());
    expect(mocks.cancel).toHaveBeenCalledTimes(2);
  });

  it('preserves manual entry when the service does not advertise a vault', async () => {
    mocks.beginHandoff.mockResolvedValue(form());
    const { renderer } = await render();
    expect(mocks.authorize).not.toHaveBeenCalled();
    act(() => {
      enter(renderer, username.label, 'manual-user');
      enter(renderer, password.label, 'manual-password');
    });
    await press(renderer);
    expect(mocks.authorize).not.toHaveBeenCalled();
    expect(mocks.submitCredentials.mock.calls[0][1]).toEqual({
      values: { f0: 'manual-user', f1: 'manual-password' },
      submit: false,
    });
  });

  it('saves new logins with ask permission without showing save or label controls', async () => {
    mocks.beginHandoff.mockResolvedValue(form(undefined, { vault }));
    mocks.authorize.mockResolvedValue({
      grant: 'g'.repeat(43),
      accounts: [
        {
          id: '8e40b5f5-fd41-4851-8922-b9545e470d6e',
          revision: 1,
          label: 'Another account',
          username: 'previously-saved-user',
          origin: 'https://example.com',
          updatedAt: 1,
          permission: 'ask',
        },
      ],
    });
    const { renderer } = await render();
    expect(mocks.authorize).toHaveBeenCalledOnce();
    expect(
      renderer.root.findAllByProps({
        accessibilityLabel: 'Save login for this bot',
      })
    ).toHaveLength(0);
    expect(
      renderer.root.findAllByProps({
        accessibilityLabel: 'Allow automatic sign-in',
      })
    ).toHaveLength(0);
    expect(
      renderer.root.findAllByProps({ placeholder: 'Personal or work' })
    ).toHaveLength(0);
    await press(renderer, 'Enter a new login');
    await act(async () => {
      enter(renderer, username.label, 'private-user');
      enter(renderer, password.label, 'private-password');
    });
    expect(JSON.stringify(renderer.toJSON())).not.toContain(
      'previously-saved-user'
    );
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Another account');
    mocks.submitCredentials.mockResolvedValue({
      submitted: true,
      saveStatus: 'saved',
    });
    await press(renderer);
    expect(mocks.submitCredentials.mock.calls[0][1]).toMatchObject({
      values: { f0: 'private-user', f1: 'private-password' },
      grant: 'g'.repeat(43),
      save: { label: 'private-user', permission: 'ask' },
    });
    expect(mocks.discard.mock.calls[0]).toEqual(['opaque-handoff-id']);
  });

  it('shows entry directly without saved-login controls when the site has no saved accounts', async () => {
    mocks.beginHandoff.mockResolvedValue(form(undefined, { vault }));
    const { renderer } = await render();
    expect(
      renderer.root.findAllByProps({ accessibilityLabel: username.label })
    ).toHaveLength(1);
    expect(
      renderer.root.findAllByProps({ label: 'Use saved login' })
    ).toHaveLength(0);
    expect(
      renderer.root.findAllByProps({ label: 'Enter a new login' })
    ).toHaveLength(0);
    expect(
      renderer.root.findAll(
        (node) =>
          typeof node.props.label === 'string' &&
          node.props.label.startsWith('Update ')
      )
    ).toHaveLength(0);
    await act(async () => renderer.unmount());
  });

  it.each([false, true])(
    'preselects one saved login without filling or showing a picker (web: %s)',
    async (web) => {
      mocks.isWeb = web;
      mocks.beginHandoff.mockResolvedValue(form(undefined, { vault }));
      mocks.authorize.mockResolvedValue({
        grant: 'g'.repeat(43),
        accounts: [
          {
            id: 'only',
            revision: 1,
            label: 'Personal',
            username: 'saved-user',
          },
        ],
      });
      const { renderer } = await render();
      expect(JSON.stringify(renderer.toJSON())).toContain('saved-user');
      expect(renderer.root.findAllByProps({ label: 'Personal' })).toHaveLength(
        0
      );
      expect(
        renderer.root.findAllByProps({ label: 'Use saved login' })
      ).toHaveLength(0);
      expect(
        renderer.root.findAllByProps({ accessibilityLabel: password.label })
      ).toHaveLength(0);
      expect(
        renderer.root.findByProps({ label: 'Approve and fill' }).props.disabled
      ).toBe(false);
      expect(mocks.submitCredentials).not.toHaveBeenCalled();
      await press(renderer, 'Enter a new login');
      expect(
        renderer.root.findAllByProps({ accessibilityLabel: password.label })
      ).toHaveLength(1);
      await press(renderer, 'Use saved login');
      expect(mocks.submitCredentials).not.toHaveBeenCalled();
      await press(renderer, 'Approve and fill');
      expect(mocks.submitCredentials.mock.calls[0][1]).toMatchObject({
        use: { id: 'only', revision: 1 },
        allowAutomatic: false,
      });
      await act(async () => renderer.unmount());
    }
  );

  it('opens saved-login approval directly and fills only after explicit approval', async () => {
    mocks.beginHandoff.mockResolvedValue(form(undefined, { vault }));
    const account = {
      id: '8e40b5f5-fd41-4851-8922-b9545e470d6e',
      revision: 1,
      label: 'Personal',
      username: 'test-account',
      origin: 'https://example.com',
      updatedAt: 1,
      permission: 'ask',
    };
    mocks.authorize.mockResolvedValue({
      grant: 'g'.repeat(43),
      accounts: [account],
    });
    const { renderer } = await render(undefined, {
      record: { id: account.id, revision: 1 },
    });
    expect(mocks.authorize).toHaveBeenCalledOnce();
    expect(mocks.submitCredentials).not.toHaveBeenCalled();
    expect(
      renderer.root.findAllByProps({ accessibilityLabel: password.label })
    ).toHaveLength(0);
    expect(
      renderer.root.findAllByProps({ accessibilityLabel: username.label })
    ).toHaveLength(0);
    expect(
      renderer.root.findAllByProps({ label: 'Use saved login' })
    ).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain('Personal');
    expect(JSON.stringify(renderer.toJSON())).toContain('test-account');
    await press(renderer, 'Approve and fill');
    expect(mocks.submitCredentials.mock.calls[0][1]).toEqual({
      values: undefined,
      submit: false,
      grant: 'g'.repeat(43),
      use: { id: account.id, revision: 1 },
      allowAutomatic: false,
    });
    expect(mocks.discard).toHaveBeenCalledOnce();
  });

  it.each([false, true])(
    'allows closing after manual browser navigation invalidates the form (web=%s)',
    async (web) => {
      mocks.isWeb = web;
      const { renderer } = await render();
      await press(renderer, 'Open live browser');
      mocks.beginHandoff.mockRejectedValue(
        new BrowserFormError('The form changed', 409)
      );
      await act(async () => {
        if (web) window.dispatchEvent(new Event('focus'));
        else renderer.root.findByType(BrowserViewerModal).props.onClose();
      });
      expect(JSON.stringify(renderer.toJSON())).not.toContain(
        'The form changed'
      );
      expect(
        renderer.root.findAllByProps({ label: 'Fill fields' })
      ).toHaveLength(0);
      expect(renderer.root.findAllByType(BrowserViewerModal)).toHaveLength(0);

      await press(renderer, 'Cancel secure entry');
      await act(async () => renderer.unmount());
      expect(mocks.cancel).toHaveBeenCalledOnce();
      expect(mocks.submitCredentials).not.toHaveBeenCalled();
      act(() => renderer.unmount());
    }
  );

  it('cancels saved-login approval without filling or resuming the task', async () => {
    mocks.beginHandoff.mockResolvedValue(form(undefined, { vault }));
    mocks.authorize.mockResolvedValue({
      grant: 'g'.repeat(43),
      accounts: [{ id: 'account', revision: 1, label: 'Personal' }],
    });
    const { renderer, navigation } = await render(undefined, {});
    await press(renderer, 'Cancel');
    await act(async () => renderer.unmount());
    expect(mocks.submitCredentials).not.toHaveBeenCalled();

    expect(mocks.cancel).toHaveBeenCalledOnce();
    expect(navigation.goBack).toHaveBeenCalledOnce();
  });

  it('keeps approval disabled if the requested saved account changes', async () => {
    mocks.beginHandoff.mockResolvedValue(form(undefined, { vault }));
    mocks.authorize.mockResolvedValue({
      grant: 'g'.repeat(43),
      accounts: [{ id: 'account', revision: 2, label: 'Personal' }],
    });
    const { renderer } = await render(undefined, {
      record: { id: 'account', revision: 1 },
    });
    expect(
      renderer.root.findByProps({ label: 'Approve and fill' }).props.disabled
    ).toBe(true);
    expect(
      renderer.root.findAllByProps({ accessibilityLabel: password.label })
    ).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain('no longer available');
    expect(mocks.submitCredentials).not.toHaveBeenCalled();
  });

  it('uses a saved account only for this sign-in even if it previously allowed automatic use', async () => {
    mocks.beginHandoff.mockResolvedValue(form(undefined, { vault }));
    const account = {
      id: '8e40b5f5-fd41-4851-8922-b9545e470d6e',
      revision: 1,
      label: 'Personal',
      permission: 'allow',
      origin: 'https://example.com',
      updatedAt: 1,
    };
    mocks.authorize.mockResolvedValue({
      grant: 'g'.repeat(43),
      accounts: [account, { ...account, id: 'other', label: 'Work' }],
    });
    const { renderer } = await render();
    expect(
      renderer.root.findByProps({ label: 'Fill fields' }).props.disabled
    ).toBe(true);
    expect(
      renderer.root.findAllByProps({ label: 'Use saved login' })
    ).toHaveLength(0);
    expect(
      renderer.root.findAllByProps({ label: 'Update Personal' })
    ).toHaveLength(0);
    await press(renderer, 'Personal');
    expect(mocks.submitCredentials).not.toHaveBeenCalled();
    await press(renderer, 'Approve and fill');
    expect(mocks.submitCredentials.mock.calls[0][1]).toEqual({
      values: undefined,
      submit: false,
      grant: 'g'.repeat(43),
      use: { id: account.id, revision: 1 },
      allowAutomatic: false,
    });
  });

  it('requires vault authorization before filling and saving', async () => {
    mocks.beginHandoff.mockResolvedValue(form(undefined, { vault }));
    mocks.authorize.mockRejectedValueOnce(new Error('Unavailable'));
    const { renderer } = await render();
    expect(
      renderer.root.findAllByProps({ accessibilityLabel: username.label })
    ).toHaveLength(0);
    expect(
      renderer.root.findByProps({ label: 'Fill fields' }).props.disabled
    ).toBe(true);
    await press(renderer);
    expect(mocks.submitCredentials).not.toHaveBeenCalled();
    await press(renderer, 'Try again');
    expect(mocks.authorize).toHaveBeenCalledTimes(2);
    act(() => {
      enter(renderer, username.label, 'private-user');
      enter(renderer, password.label, 'private-password');
    });
    await press(renderer);
    expect(mocks.submitCredentials.mock.calls[0][1].save.permission).toBe(
      'ask'
    );
    await act(async () => renderer.unmount());
  });

  it('saves a password-only step without asking for an account label', async () => {
    mocks.beginHandoff.mockResolvedValue(form([password], { vault }));
    const { renderer } = await render();
    act(() => enter(renderer, password.label, 'private-password'));
    await press(renderer);
    expect(mocks.submitCredentials.mock.calls[0][1].save).toEqual({
      label: 'example.com',
      permission: 'ask',
    });
    await act(async () => renderer.unmount());
  });

  it('updates a saved login with ask permission even if it previously allowed automatic use', async () => {
    mocks.beginHandoff.mockResolvedValue(form(undefined, { vault }));
    mocks.authorize.mockResolvedValue({
      grant: 'g'.repeat(43),
      accounts: [
        { id: 'old', revision: 2, label: 'Old login', permission: 'allow' },
      ],
    });
    const { renderer } = await render();
    await press(renderer, 'Update Old login');
    act(() => {
      enter(renderer, username.label, 'user');
      enter(renderer, password.label, 'new-password');
    });
    await press(renderer);
    expect(mocks.submitCredentials.mock.calls[0][1].save).toEqual({
      label: 'user',
      permission: 'ask',
      update: { id: 'old', revision: 2 },
    });
    await act(async () => renderer.unmount());
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
          .findByProps({ label: 'Fill fields' })
          .props.onPress();
        renderer.root
          .findByProps({ accessibilityLabel: field.label })
          .props.onSubmitEditing();
        void renderer.root
          .findByProps({ label: 'Fill fields' })
          .props.onPress();
      });
      expect(mocks.submitCredentials).toHaveBeenCalledOnce();
      expect(
        renderer.root.findByProps({ label: 'Fill fields' }).props.disabled
      ).toBe(true);
      await act(async () => {
        finish({ submitted: true });
        await submission;
      });
      expect(mocks.discard).toHaveBeenCalledOnce();
      expect(navigation.goBack).toHaveBeenCalledOnce();
      expect(JSON.stringify(renderer.toJSON())).not.toContain('aBc123');
      act(() => renderer.unmount());
    }
  );

  it.each([username, password, code])(
    'finishes one $purpose step without scanning the next page',
    async (field) => {
      mocks.beginHandoff
        .mockResolvedValueOnce(form([field]))
        .mockRejectedValue(new Error('Passkey setup has no supported fields'));
      mocks.submitCredentials.mockResolvedValue({ submitted: true });
      const { renderer, navigation } = await render();
      act(() =>
        enter(
          renderer,
          field.label,
          field === code ? '123456' : 'private-input'
        )
      );
      await press(renderer);
      expect(mocks.beginHandoff).toHaveBeenCalledOnce();
      expect(mocks.submitCredentials).toHaveBeenCalledOnce();
      expect(navigation.goBack).toHaveBeenCalledOnce();
      expect(JSON.stringify(renderer.toJSON())).not.toContain('private-input');
      await act(async () => renderer.unmount());
      expect(mocks.cancel).not.toHaveBeenCalled();
    }
  );

  it('finishes saved-login approval without inspecting the subsequent page', async () => {
    mocks.beginHandoff
      .mockResolvedValueOnce(form(undefined, { vault }))
      .mockRejectedValue(new Error('Passkey setup'));
    mocks.authorize.mockResolvedValue({
      grant: 'grant',
      accounts: [{ id: 'account', revision: 1, label: 'Personal' }],
    });
    mocks.submitCredentials.mockResolvedValue({ submitted: true });
    const { renderer, navigation } = await render(undefined, {});
    await press(renderer, 'Approve and fill');
    expect(mocks.beginHandoff).toHaveBeenCalledOnce();
    expect(mocks.submitCredentials.mock.calls[0][1].values).toBeUndefined();
    expect(navigation.goBack).toHaveBeenCalledOnce();
    await act(async () => renderer.unmount());
  });

  it.each(['pending', 'saved', 'failed'] as const)(
    'keeps a %s save result separate from filling',
    async (saveStatus) => {
      mocks.beginHandoff.mockResolvedValue(form(undefined, { vault }));
      mocks.submitCredentials.mockResolvedValue({
        submitted: true,
        saveStatus,
      });
      const { renderer, navigation } = await render();
      await act(async () => {
        enter(renderer, username.label, 'private-user');
        enter(renderer, password.label, 'private-password');
      });
      await press(renderer);
      expect(mocks.beginHandoff).toHaveBeenCalledOnce();
      expect(mocks.submitCredentials).toHaveBeenCalledOnce();
      if (saveStatus === 'failed') {
        expect(navigation.goBack).not.toHaveBeenCalled();
        expect(JSON.stringify(renderer.toJSON())).toContain(
          'could not be saved'
        );
        await press(renderer, 'Return to conversation');
      }
      expect(navigation.goBack).toHaveBeenCalledOnce();
      await act(async () => renderer.unmount());
      expect(mocks.cancel).not.toHaveBeenCalled();
    }
  );

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
    expect(mocks.beginHandoff).toHaveBeenCalledOnce();
    expect(mocks.discard).toHaveBeenCalledOnce();
    expect(JSON.stringify(renderer.toJSON())).not.toContain('4111111111111111');
    act(() => renderer.unmount());
  });

  it('cleans checkout labels while preserving the original fill handles and choices', async () => {
    const fields: BrowserSecureField[] = [
      {
        id: 'f0',
        purpose: 'given-name',
        label: 'Shipping: First name',
        inputType: 'text',
        required: true,
      },
      {
        id: 'f1',
        purpose: 'address-line2',
        label: 'Shipping: Apartment (optional) (optional)',
        inputType: 'text',
        required: false,
      },
      {
        id: 'f2',
        purpose: 'payment-method',
        label: 'basic',
        inputType: 'select',
        required: false,
        options: [
          { value: '3', label: 'Credit card' },
          { value: '7', label: 'PayPal' },
        ],
      },
      {
        id: 'f3',
        purpose: 'cc-number',
        label: 'Card number',
        inputType: 'numeric',
        required: true,
      },
      {
        id: 'f4',
        purpose: 'marketing',
        label: 'Text me with news and offers',
        inputType: 'select',
        required: false,
        options: [
          { value: '0', label: 'No' },
          { value: '1', label: 'Yes' },
        ],
      },
    ];
    mocks.beginHandoff.mockResolvedValue(form(fields, { kind: 'details' }));
    const { renderer } = await render();
    const tree = JSON.stringify(renderer.toJSON());
    expect(tree).not.toContain('Shipping: First name');
    expect(tree).not.toContain('(optional)');
    expect(tree).not.toContain('Choose basic');
    expect(tree).toContain('Shipping');
    expect(tree).toContain('Payment');
    act(() => {
      enter(renderer, 'First name', 'Sample');
      enter(renderer, 'Card number', '4111111111111111');
    });
    await press(renderer, 'Choose payment method');
    await press(renderer, 'PayPal');
    const no = renderer.root.findByProps({
      accessibilityLabel: 'Text me with news and offers: No',
    });
    expect(no.props.accessibilityState.selected).toBe(false);
    act(() => no.props.onPress());
    await press(renderer, 'Fill fields');
    expect(mocks.submitCredentials).toHaveBeenCalledWith(
      expect.anything(),
      {
        values: { f0: 'Sample', f2: '7', f3: '4111111111111111', f4: '0' },
        submit: false,
      },
      expect.any(AbortSignal)
    );
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
          .findByProps({ label: 'Fill fields' })
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
      expect(mocks.cancel).not.toHaveBeenCalled();
      const tree = renderer.toJSON();
      await act(async () => {
        finish({ submitted: true });
        await pending;
      });
      expect(renderer.toJSON()).toEqual(tree);
      expect(mocks.beginHandoff).toHaveBeenCalledOnce();

      expect(navigation.goBack).toHaveBeenCalledTimes(
        dismissal === 'back' ? 1 : 0
      );
      if (dismissal === 'back') await act(async () => renderer.unmount());
      expect(mocks.discard).toHaveBeenCalledWith('opaque-handoff-id');
    }
  );

  it('shows an uncertain fill response without replaying input', async () => {
    mocks.beginHandoff.mockResolvedValue(form([password]));
    mocks.submitCredentials.mockRejectedValueOnce(new Error('Connection lost'));
    const { renderer } = await render();
    act(() => enter(renderer, 'Password', 'private-input'));
    await press(renderer);
    expect(renderer.root.findAllByProps({ label: 'Fill fields' })).toHaveLength(
      0
    );
    expect(renderer.root.findAllByProps({ label: 'Try again' })).toHaveLength(
      0
    );
    expect(mocks.beginHandoff).toHaveBeenCalledOnce();
    expect(mocks.submitCredentials).toHaveBeenCalledOnce();
    expect(JSON.stringify(renderer.toJSON())).not.toContain('private-input');
    act(() => renderer.unmount());
  });

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

  it('opens the live browser when no secure form is available and stays closed on dismissal', async () => {
    mocks.beginHandoff.mockRejectedValue(
      new BrowserFormError('No supported form', 404)
    );
    const { renderer } = await render();
    expect(renderer.root.findByType(BrowserViewerModal).props.viewerUrl).toBe(
      'https://browser-session.tlon.network/s/payload.signature'
    );
    expect(JSON.stringify(renderer.toJSON())).not.toContain(
      'No supported form'
    );

    expect(mocks.openURL).not.toHaveBeenCalled();
    expect(mocks.openWindow).not.toHaveBeenCalled();
    expect(mocks.submitCredentials).not.toHaveBeenCalled();
    await act(async () =>
      renderer.root.findByType(BrowserViewerModal).props.onClose()
    );
    expect(mocks.beginHandoff).toHaveBeenCalledTimes(2);
    expect(renderer.root.findAllByType(BrowserViewerModal)).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain(
      'Continue in the live browser.'
    );
    await press(renderer, 'Open live browser');
    expect(renderer.root.findAllByType(BrowserViewerModal)).toHaveLength(1);
    act(() => renderer.unmount());
  });

  it('shows a fresh secure form after closing the automatic live viewer', async () => {
    mocks.beginHandoff.mockRejectedValueOnce(
      new BrowserFormError('No supported form', 404)
    );
    const { renderer } = await render();
    await act(async () =>
      renderer.root.findByType(BrowserViewerModal).props.onClose()
    );
    expect(renderer.root.findAllByType(BrowserViewerModal)).toHaveLength(0);
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Password' }).props.value
    ).toBe('');

    act(() => renderer.unmount());
  });

  it('shows an ended handoff instead of the live-browser fallback', async () => {
    mocks.beginHandoff.mockRejectedValue(
      new BrowserFormError(
        'This secure-entry request has ended. Ask your bot for a new form.',
        404,
        'handoff_complete'
      )
    );
    const { renderer } = await render();
    expect(renderer.root.findAllByType(BrowserViewerModal)).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain(
      'This secure-entry request has ended.'
    );
    expect(JSON.stringify(renderer.toJSON())).not.toContain(
      'Continue in the live browser.'
    );
    expect(renderer.root.findAllByProps({ label: 'Try again' })).toHaveLength(
      0
    );
    expect(
      renderer.root.findAllByProps({ label: 'Open live browser' })
    ).toHaveLength(0);
    expect(
      renderer.root.findAllByProps({ label: 'Return to conversation' })
    ).toHaveLength(1);
    act(() => renderer.unmount());
  });

  it.each([401, 410, 429, 500])(
    'keeps discovery error %s visible without opening the browser',
    async (status) => {
      mocks.beginHandoff.mockRejectedValue(
        new BrowserFormError('Browser unavailable', status)
      );
      const { renderer } = await render();
      expect(renderer.root.findAllByType(BrowserViewerModal)).toHaveLength(0);
      expect(JSON.stringify(renderer.toJSON())).toContain(
        'Browser unavailable'
      );

      act(() => renderer.unmount());
    }
  );

  it('ignores a missing-form response after leaving the screen', async () => {
    let reject!: (error: Error) => void;
    mocks.beginHandoff.mockImplementation(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        })
    );
    const { renderer, navigation } = await render();
    await act(async () =>
      renderer.root
        .findByType('ScreenHeader' as React.ElementType)
        .props.backAction()
    );
    const tree = renderer.toJSON();
    await act(async () =>
      reject(new BrowserFormError('No supported form', 404))
    );
    expect(renderer.toJSON()).toEqual(tree);
    expect(navigation.goBack).toHaveBeenCalledOnce();

    act(() => renderer.unmount());
  });

  it('offers a user-initiated live browser tab on web when no secure form is available', async () => {
    mocks.isWeb = true;
    mocks.beginHandoff.mockRejectedValue(
      new BrowserFormError('No supported form', 404)
    );
    const { renderer } = await render();
    expect(mocks.openWindow).not.toHaveBeenCalled();
    expect(JSON.stringify(renderer.toJSON())).toContain(
      'Continue in the live browser.'
    );
    expect(JSON.stringify(renderer.toJSON())).not.toContain(
      'No supported form'
    );
    await press(renderer, 'Open live browser');
    expect(mocks.openWindow).toHaveBeenCalledOnce();

    act(() => renderer.unmount());
  });

  it('clears typed secrets and reloads the form after closing live control', async () => {
    const { renderer } = await render();
    act(() => enter(renderer, 'Password', 'private-password'));
    await press(renderer, 'Open live browser');
    expect(JSON.stringify(renderer.toJSON())).not.toContain('private-password');
    await act(async () =>
      renderer.root.findByType(BrowserViewerModal).props.onClose()
    );
    expect(renderer.root.findAllByType(BrowserViewerModal)).toHaveLength(0);
    expect(mocks.beginHandoff).toHaveBeenCalledTimes(2);

    act(() => renderer.unmount());
  });

  it.each([false, true])(
    'rejects untrusted handoff URLs (web=%s)',
    async (web) => {
      mocks.isWeb = web;
      const { renderer } = await render();
      mocks.resolve.mockReturnValue('https://evil.example/s/payload.signature');
      await press(renderer, 'Open live browser');
      expect(renderer.root.findAllByType(BrowserViewerModal)).toHaveLength(0);
      expect(mocks.openWindow).not.toHaveBeenCalled();
      expect(JSON.stringify(renderer.toJSON())).toContain(
        'not from a trusted Tlon host'
      );
      act(() => renderer.unmount());
    }
  );

  it('opens web handoffs in a separate tab without completing or submitting the form', async () => {
    mocks.isWeb = true;
    const { renderer } = await render();
    await press(renderer, 'Open live browser');
    expect(mocks.openWindow).toHaveBeenCalledOnce();
    expect(mocks.openWindow).toHaveBeenCalledWith('about:blank', '_blank');
    expect(renderer.root.findAllByType(BrowserViewerModal)).toHaveLength(0);

    expect(mocks.submitCredentials).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });

  it.each(['focus', 'visibility', 'both'] as const)(
    'refreshes once on browser return via %s',
    async (signal) => {
      mocks.isWeb = true;
      const { renderer } = await render();
      await act(async () => {
        window.dispatchEvent(new Event('focus'));
      });
      expect(mocks.beginHandoff).toHaveBeenCalledTimes(1);
      await press(renderer, 'Open live browser');
      mocks.beginHandoff.mockResolvedValue(form([code], { formId: 'form-2' }));
      Object.assign(document, { visibilityState: 'hidden' });
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(mocks.beginHandoff).toHaveBeenCalledTimes(1);
      Object.assign(document, { visibilityState: 'visible' });
      await act(async () => {
        if (signal !== 'focus')
          document.dispatchEvent(new Event('visibilitychange'));
        if (signal !== 'visibility') window.dispatchEvent(new Event('focus'));
      });
      expect(mocks.beginHandoff).toHaveBeenCalledTimes(2);
      expect(
        renderer.root.findAllByProps({ accessibilityLabel: 'Password' })
      ).toHaveLength(0);
      expect(
        renderer.root.findByProps({ accessibilityLabel: 'Verification code' })
      ).toBeDefined();
      await act(async () => {
        window.dispatchEvent(new Event('focus'));
      });
      expect(mocks.beginHandoff).toHaveBeenCalledTimes(2);

      expect(mocks.submitCredentials).not.toHaveBeenCalled();
      act(() => renderer.unmount());
      window.dispatchEvent(new Event('focus'));
      expect(mocks.beginHandoff).toHaveBeenCalledTimes(2);
    }
  );

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
