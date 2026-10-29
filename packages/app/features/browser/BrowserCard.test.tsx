import React from 'react';
import { Button } from '@tloncorp/ui';
import { BrowserSessionPreview } from './BrowserSessionPreview';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { BrowserCard, BrowserCardBlock } from './BrowserCard';
const mocks = vi.hoisted(() => ({
  openForm: vi.fn(),
  openViewer: vi.fn(),
  toast: vi.fn(),
  allowed: true,
  trackError: vi.fn(),
}));
vi.mock('@tloncorp/shared', () => ({
  createDevLogger: () => ({
    trackEvent: vi.fn(),
    trackError: mocks.trackError,
  }),
}));
vi.mock('@tloncorp/ui', () => ({
  Button: 'Button',
  Icon: 'Icon',
  Text: 'Text',
  useToast: () => mocks.toast,
}));
vi.mock('tamagui', () => ({ XStack: 'XStack', YStack: 'YStack' }));
vi.mock('./BrowserCredentialHandoffContext', () => ({
  useOptionalBrowserCredentialHandoff: () => mocks,
}));
vi.mock('./BrowserSecureEntryAction', () => ({
  BrowserSecureEntryAction: ({ children }: { children: React.ReactNode }) =>
    children,
}));
vi.mock('./BrowserSessionPreview', () => ({
  BrowserSessionPreview: 'Preview',
  BrowserSessionAction: ({ children }: { children: React.ReactNode }) =>
    children,
}));
vi.mock('../../ui/components/PostContent/contentUtils', () => ({
  useContentContext: () => ({ canUseBrowserCards: mocks.allowed }),
}));
const viewerUrl = 'https://browser-session.tlon.network/s/payload.signature';
const login = {
  type: 'browser-secure-entry',
  version: 1,
  viewerUrl,
  presentation: { purpose: 'login', site: 'wikipedia.org' },
} as const;
let tree: ReactTestRenderer;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  mocks.allowed = true;
});
afterEach(() => {
  if (tree) act(() => tree.unmount());
});
function mount(node: React.ReactElement) {
  act(() => {
    tree = create(node);
  });
  return tree.root.findByType(Button);
}
it('renders the real vault card and allows reopening its sheet', async () => {
  const button = mount(
    <BrowserCardBlock block={{ type: 'browser-card', card: login }} />
  );
  expect(JSON.stringify(tree.toJSON())).toContain('Secure Vault');
  expect(JSON.stringify(tree.toJSON())).toContain('wikipedia.org');
  expect(button.props.label).toBe('Add');
  await act(() => button.props.onPress());
  await act(() => button.props.onPress());
  expect(mocks.openForm).toHaveBeenCalledTimes(2);
  expect(mocks.openForm).toHaveBeenCalledWith(viewerUrl, undefined);
});
it('keeps OTP wording distinct from vault logins', () => {
  const button = mount(
    <BrowserCard
      card={{
        ...login,
        presentation: { purpose: 'otp', site: 'wikipedia.org' },
      }}
      allowed
    />
  );
  expect(button.props.label).toBe('Enter code');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Secure Vault');
});
it('preserves the saved-record approval pointer', async () => {
  const loginApproval = {
    record: { id: '8e40b5f5-fd41-4851-8922-b9545e470d6e', revision: 3 },
  };
  const button = mount(
    <BrowserCard card={{ ...login, loginApproval }} allowed />
  );
  expect(button.props.label).toBe('Review');
  await act(() => button.props.onPress());
  expect(mocks.openForm).toHaveBeenCalledWith(viewerUrl, loginApproval);
});
it.each([false, true])(
  'blocks foreign bots and untrusted viewer hosts (%s)',
  async (invalidHost) => {
    mocks.allowed = invalidHost;
    const card = {
      type: 'browser-session',
      version: 1,
      viewerUrl: invalidHost ? 'https://evil.test/s/cap' : viewerUrl,
    } as const;
    const button = mount(
      <BrowserCardBlock block={{ type: 'browser-card', card }} />
    );
    expect(button.props.disabled).toBe(true);
    expect(tree.root.findAllByType(BrowserSessionPreview)).toHaveLength(0);
    await act(() => button.props.onPress());
    expect(mocks.openViewer).not.toHaveBeenCalled();
  }
);
it('reports viewer failure without leaking capabilities and allows retry', async () => {
  mocks.openViewer.mockRejectedValueOnce(new Error(viewerUrl));
  const button = mount(
    <BrowserCard
      card={{ type: 'browser-session', version: 1, viewerUrl }}
      allowed
    />
  );
  expect(tree.root.findAllByType(BrowserSessionPreview)).toHaveLength(1);
  await act(() => button.props.onPress());
  expect(mocks.toast).toHaveBeenCalled();
  expect(JSON.stringify(mocks.trackError.mock.calls)).not.toContain(viewerUrl);
  expect(button.props.disabled).toBe(false);
});
