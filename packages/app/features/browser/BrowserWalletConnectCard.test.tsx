import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Button } from '@tloncorp/ui';
import type { WalletView } from '@tloncorp/api/client/browserWallet';
import { BrowserWalletConnectCard } from './BrowserWalletConnectCard';

vi.mock('@tloncorp/ui', () => ({
  Button: 'Button',
  Icon: 'Icon',
  Text: 'Text',
}));
vi.mock('tamagui', () => ({ XStack: 'XStack', YStack: 'YStack' }));
const view: WalletView = {
  request_id: 'request',
  kind: 'connect',
  status: 'pending',
  expires_at: Date.now() + 60000,
  connection_mode: 'tlon_oauth',
  action: { name: 'link_oauth', url: 'https://link.example/authorize' },
};
let tree: ReactTestRenderer;
const onOpenLink = vi.fn();
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
});
afterEach(() => {
  if (tree) act(() => tree.unmount());
  vi.unstubAllGlobals();
});
function mount(next = view) {
  act(() => {
    tree = create(
      <BrowserWalletConnectCard view={next} onOpenLink={onOpenLink} />
    );
  });
}
it('opens the prepared owner link directly when Connect is tapped', () => {
  mount();
  expect(onOpenLink).not.toHaveBeenCalled();
  const button = tree.root.findByType(Button);
  expect(button.props.label).toBe('Connect Stripe Link');
  expect(button.props.disabled).toBeFalsy();
  act(() => button.props.onPress());
  expect(onOpenLink).toHaveBeenCalledOnce();
});
it.each(['connected', 'expired', 'cancelled'] as const)(
  'removes the action for %s requests',
  (status) => {
    mount({ ...view, status });
    expect(tree.root.findAllByType(Button)).toHaveLength(0);
  }
);
it('disables an unavailable link with an actionable explanation', () => {
  mount({ ...view, action: undefined });
  expect(JSON.stringify(tree.toJSON())).toContain(
    'Ask your bot for a new one.'
  );
  expect(tree.root.findByType(Button).props.disabled).toBe(true);
});

it('shows a wallet polling failure and lets the owner retry it', () => {
  const onRetry = vi.fn();
  act(() => {
    tree = create(
      <BrowserWalletConnectCard
        view={view}
        onOpenLink={onOpenLink}
        walletError="Unable to refresh this wallet request."
        onRetry={onRetry}
      />
    );
  });
  expect(JSON.stringify(tree.toJSON())).toContain(
    'Unable to refresh this wallet request.'
  );
  const retry = tree.root
    .findAllByType(Button)
    .find(({ props }) => props.label === 'Try again');
  act(() => retry?.props.onPress());
  expect(onRetry).toHaveBeenCalledOnce();
});
