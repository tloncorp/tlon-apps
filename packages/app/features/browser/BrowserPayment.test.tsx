import React from 'react';
import { Button } from '@tloncorp/ui';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { WalletView } from '@tloncorp/api/client/browserWallet';

import { A2UICardButton } from '../../ui/components/PostContent/a2uiCardParts';
import { BrowserPaymentCard, BrowserPaymentContent } from './BrowserPayment';
import {
  displayPaymentAmount,
  paymentStatus,
} from './browserPaymentPresentation';

vi.mock('@tloncorp/ui', () => ({
  Button: 'Button',
  Icon: 'Icon',
  Text: 'Text',
}));
vi.mock('tamagui', () => ({
  YStack: 'YStack',
  XStack: 'XStack',
  Spinner: 'Spinner',
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
vi.mock('../../ui/components/BottomSheetWrapper', () => ({
  BottomSheetScrollView: 'ScrollView',
}));
vi.mock('../../ui/components/ActionSheet', () => ({
  ActionSheet: 'ActionSheet',
}));

const view: WalletView = {
  request_id: 'd59fdb74-99f8-4523-94a3-c131131ebfca',
  kind: 'payment',
  status: 'review',
  expires_at: 1999999999999,
  purchase: {
    merchant: 'Demo',
    page_url: 'https://example.com/checkout',
    amount: 2400,
    currency: 'usd',
    description: 'Socks',
  },
  payment_methods: [
    { id: 'one', display: 'Visa 4242' },
    { id: 'two', display: 'Visa 4444' },
  ],
};
let tree: ReactTestRenderer;
const approve = vi.fn();
const openLink = vi.fn();
const cancel = vi.fn();
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
});
afterEach(() => {
  if (tree) act(() => tree.unmount());
});
function mount(next = view, error?: string) {
  act(() => {
    tree = create(
      <BrowserPaymentContent
        view={next}
        error={error}
        onApprove={approve}
        onOpenLink={openLink}
        onRetry={() => {}}
        onCancel={cancel}
      />
    );
  });
}
const buttons = () => tree.root.findAllByType(Button);
const button = (label: string) =>
  buttons().find((item) => item.props.label === label)!;
const cardButton = (label: string) =>
  tree.root
    .findAllByType(A2UICardButton)
    .find((item) => item.props.label === label)!;

it('requires a choice when multiple methods exist and sends only the selected id', () => {
  mount();
  expect(button('Prepare Link approval').props.disabled).toBe(true);
  act(() => button('Visa 4444').props.onPress());
  expect(button('Prepare Link approval').props.disabled).toBe(false);
  act(() => button('Prepare Link approval').props.onPress());
  expect(approve).toHaveBeenCalledWith('two');
});
it('uses the only method without an unnecessary picker', () => {
  mount({ ...view, payment_methods: view.payment_methods!.slice(0, 1) });
  expect(button('Visa 4242')).toBeUndefined();
  act(() => button('Prepare Link approval').props.onPress());
  expect(approve).toHaveBeenCalledWith('one');
});
it('does not allow approval without purchase details or a payment method, or after a refresh error', () => {
  for (const next of [
    { ...view, payment_methods: [] },
    { ...view, purchase: undefined },
  ]) {
    mount(next);
    expect(button('Prepare Link approval').props.disabled).toBe(true);
    act(() => tree.unmount());
  }
  mount(view, 'Couldn’t refresh');
  expect(button('Prepare Link approval').props.disabled).toBe(true);
  expect(button('Check status')).toBeDefined();
});
it.each([
  'ready',
  'filled',
  'cancelled',
  'expired',
  'failed',
  'unknown',
] as const)(
  'never reauthorizes a %s request, even if an old action URL is present',
  (status) => {
    mount({
      ...view,
      status,
      action: { name: 'approve', url: 'https://example.com/consent' },
    });
    expect(buttons()).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).not.toContain(
      'https://example.com/consent'
    );
  }
);
it('opening an approved card shows details, not another approval', () => {
  const open = vi.fn();
  act(() => {
    tree = create(
      <BrowserPaymentCard view={{ ...view, status: 'ready' }} onOpen={open} />
    );
  });
  act(() => cardButton('View details').props.onPress());
  expect(open).toHaveBeenCalledOnce();
  expect(approve).not.toHaveBeenCalled();
});
it('formats minor units for zero- and three-decimal currencies too', () => {
  expect(displayPaymentAmount(2400, 'usd')).toContain('24.00');
  expect(displayPaymentAmount(2400, 'jpy')).toContain('2,400');
  expect(displayPaymentAmount(2400, 'kwd')).toContain('2.400');
});

it('shows a structured bill without adding shipping or calling it paid', () => {
  const bill: WalletView = {
    ...view,
    status: 'filled',
    purchase: {
      ...view.purchase!,
      order: {
        items: [{ name: 'Electricity', quantity: 1, amount: 2400 }],
        subtotal: 2400,
        details: [{ label: 'Billing period', value: 'October 2026' }],
      },
    },
  };
  mount(bill);
  const rendered = JSON.stringify(tree.toJSON());
  expect(rendered).toContain('Electricity');
  expect(rendered).toContain('October 2026');
  expect(rendered).not.toContain('Shipping');
  expect(paymentStatus(bill)).toBe('Approved');
  expect(rendered).not.toContain('Paid');
});
it('opens the prepared approval from the card and keeps details separate', () => {
  const details = vi.fn();
  act(() => {
    tree = create(
      <BrowserPaymentCard
        view={{
          ...view,
          status: 'pending',
          action: { name: 'approve', url: 'https://link.example/approve' },
        }}
        onOpen={details}
        onOpenLink={openLink}
      />
    );
  });
  act(() => cardButton('Review payment').props.onPress());
  expect(openLink).toHaveBeenCalledOnce();
  expect(details).not.toHaveBeenCalled();
  act(() => cardButton('View details').props.onPress());
  expect(details).toHaveBeenCalledOnce();
});

it('authorizes a saved site method in Tlon without a Link picker or external approval', () => {
  mount({
    ...view,
    payment_source: 'site_saved',
    payment_methods: undefined,
    saved_payment: {
      method: 'Bank account ending 6789',
      destination: 'Service address · Seattle',
    },
  });
  const rendered = JSON.stringify(tree.toJSON());
  expect(rendered).toContain('Bank account ending 6789');
  expect(rendered).toContain('Service address · Seattle');
  expect(rendered).not.toContain('Stripe Link');
  expect(button('Prepare Link approval')).toBeUndefined();
  expect(button('Authorize payment').props.disabled).toBe(false);
  act(() => button('Authorize payment').props.onPress());
  expect(approve).toHaveBeenCalledWith();
  expect(openLink).not.toHaveBeenCalled();
});
it('does not authorize a saved method without its review details or when refresh failed', () => {
  mount({ ...view, payment_source: 'site_saved' });
  expect(button('Authorize payment').props.disabled).toBe(true);
  act(() => tree.unmount());
  mount(
    {
      ...view,
      payment_source: 'site_saved',
      saved_payment: { method: 'Visa ending 4242' },
    },
    'Unable to refresh'
  );
  expect(button('Authorize payment').props.disabled).toBe(true);
});
