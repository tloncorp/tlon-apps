import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { WalletView } from '@tloncorp/api/client/browserWallet';
import { A2UICardButton } from '../../ui/components/PostContent/a2uiCardParts';
import { BrowserWalletConnectCard } from './BrowserWalletConnectCard';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  refreshStatus: vi.fn(),
  onEvent: undefined as undefined | ((event: { type: string }) => void),
}));
vi.mock('@tloncorp/ui', () => ({
  Button: 'Button',
  Icon: 'Icon',
  Text: 'Text',
}));
vi.mock('tamagui', () => ({
  XStack: 'XStack',
  YStack: 'YStack',
  isWeb: false,
}));
vi.mock(
  '../../ui/components/PostContent/a2uiCardParts',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../ui/components/PostContent/a2uiCardParts')
    >()),
    A2UICardButton: 'A2UICardButton',
  })
);
vi.mock('../settings/useMcpConnections', () => ({
  useMcpConnections: ({ onEvent }: { onEvent: typeof mocks.onEvent }) => {
    mocks.onEvent = onEvent;
    return {
      connect: mocks.connect,
      refreshStatus: mocks.refreshStatus,
      providerConfigs: [{ id: 'stripe', template: 'link' }],
      initialLoading: false,
    };
  },
}));
const view: WalletView = {
  request_id: 'request',
  kind: 'connect',
  status: 'pending',
  expires_at: Date.now() + 60000,
  connection_mode: 'tlon_oauth',
};
let tree: ReactTestRenderer;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  mocks.connect.mockResolvedValue('started');
});
afterEach(() => {
  if (tree) act(() => tree.unmount());
  vi.unstubAllGlobals();
});
function mount(next = view) {
  act(() => {
    tree = create(<BrowserWalletConnectCard view={next} />);
  });
}
it('starts the existing connector OAuth flow only after tapping Connect', async () => {
  mount();
  expect(mocks.refreshStatus).toHaveBeenCalledOnce();
  expect(mocks.connect).not.toHaveBeenCalled();
  const button = tree.root.findByType(A2UICardButton);
  expect(button.props.label).toBe('Connect Stripe Link');
  await act(async () => button.props.onPress());
  expect(mocks.connect).toHaveBeenCalledTimes(1);
  expect(mocks.connect).toHaveBeenCalledWith('stripe');
});
it.each(['connected', 'expired', 'cancelled'] as const)(
  'removes the action for %s requests',
  (status) => {
    mount({ ...view, status });
    expect(tree.root.findAllByType(A2UICardButton)).toHaveLength(0);
  }
);
it('surfaces an OAuth start failure and keeps the connect action available', () => {
  mount();
  act(() => mocks.onEvent?.({ type: 'start-failed' }));
  expect(JSON.stringify(tree.toJSON())).toContain('Couldn’t open Stripe Link');
  expect(tree.root.findByType(A2UICardButton).props.disabled).toBeFalsy();
});

it('shows a wallet polling failure and lets the owner retry it', () => {
  const onRetry = vi.fn();
  act(() => {
    tree = create(
      <BrowserWalletConnectCard
        view={view}
        walletError="Unable to refresh this wallet request."
        onRetry={onRetry}
      />
    );
  });
  expect(JSON.stringify(tree.toJSON())).toContain(
    'Unable to refresh this wallet request.'
  );
  const retry = tree.root
    .findAllByType(A2UICardButton)
    .find(({ props }) => props.label === 'Try again');
  act(() => retry?.props.onPress());
  expect(onRetry).toHaveBeenCalledOnce();
});
