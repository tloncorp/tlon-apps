import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { browserWalletRequest } from '@tloncorp/api/client/browserWallet';
import { useBrowserWallet } from './useBrowserWallet';
import { Linking } from 'react-native';

const platform = vi.hoisted(() => ({ isWeb: true }));

vi.mock('@tloncorp/api/client/browserWallet', () => ({
  browserWalletRequest: vi.fn(),
}));
vi.mock('@tloncorp/api', () => ({ getTlawnMoon: vi.fn() }));
vi.mock('@tloncorp/shared', () => ({
  createDevLogger: () => ({ trackError: vi.fn(), trackEvent: vi.fn() }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: '~zod', refetch: vi.fn() }),
}));
vi.mock('../settings/bot/useBotSettingsData', () => ({
  useBotSettingsIds: () => ({ ship: '~ten' }),
}));
vi.mock('../settings/bot/helpers', () => ({
  normalizeMoonName: (name: string) => name,
}));
vi.mock('react-native', () => ({ Linking: { openURL: vi.fn() } }));
vi.mock('tamagui', () => platform);

let tree: ReactTestRenderer;
let wallet: ReturnType<typeof useBrowserWallet>;
function Harness() {
  wallet = useBrowserWallet('request', false);
  return null;
}
afterEach(() => {
  if (tree) act(() => tree.unmount());
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  platform.isWeb = true;
});

it('opens the prepared owner-only URL synchronously, without another wallet request or blank tab', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const popup = { opener: {} };
  const open = vi.fn(() => popup);
  vi.stubGlobal('window', { open });
  vi.mocked(browserWalletRequest).mockResolvedValue({
    request_id: 'request',
    kind: 'payment',
    status: 'pending',
    expires_at: Date.now() + 60000,
    action: { name: 'spend_approval', url: 'https://link.example/approve' },
  });
  await act(async () => {
    tree = create(<Harness />);
  });
  expect(browserWalletRequest).toHaveBeenCalledTimes(1);
  act(() => {
    wallet.onOpenLink();
  });
  expect(open).toHaveBeenCalledWith('https://link.example/approve', '_blank');
  expect(popup.opener).toBeNull();
  expect(browserWalletRequest).toHaveBeenCalledTimes(1);
});

it('opens mobile approvals through the system link handler', async () => {
  platform.isWeb = false;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.mocked(browserWalletRequest).mockResolvedValue({
    request_id: 'request',
    kind: 'payment',
    status: 'pending',
    expires_at: Date.now() + 60000,
    action: { name: 'spend_approval', url: 'https://link.example/approve' },
  });
  await act(async () => {
    tree = create(<Harness />);
  });
  await act(async () => {
    wallet.onOpenLink();
  });
  expect(Linking.openURL).toHaveBeenCalledWith('https://link.example/approve');
  expect(browserWalletRequest).toHaveBeenCalledTimes(1);
});

it('sends saved-method approval without a Link payment-method id', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.mocked(browserWalletRequest).mockResolvedValue({
    request_id: 'request',
    kind: 'payment',
    status: 'review',
    expires_at: Date.now() + 60000,
    payment_source: 'site_saved',
    saved_payment: { method: 'Card ending 4242' },
  });
  await act(async () => {
    tree = create(<Harness />);
  });
  await act(async () => {
    wallet.onApprove();
  });
  expect(browserWalletRequest).toHaveBeenLastCalledWith(
    '~zod',
    'request',
    'approve',
    { confirmed: true },
    undefined
  );
  expect(Linking.openURL).not.toHaveBeenCalled();
});
