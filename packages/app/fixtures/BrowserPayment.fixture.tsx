import type { WalletView } from '@tloncorp/api/client/browserWallet';
import { Button, Text } from '@tloncorp/ui';
import { useState } from 'react';
import { YStack } from 'tamagui';

import {
  BrowserPaymentCard,
  BrowserPaymentSheet,
} from '../features/browser/BrowserPayment';
import { FixtureWrapper } from './FixtureWrapper';

const payment: WalletView = {
  request_id: 'd59fdb74-99f8-4523-94a3-c131131ebfca',
  kind: 'payment',
  status: 'review',
  expires_at: 1999999999999,
  purchase: {
    merchant: 'Comfrt',
    page_url: 'https://example.com/checkout',
    amount: 22357,
    currency: 'usd',
    description:
      'Five items. Standard delivery. Approve only the displayed total; your Tlonbot will place the order after Link approval.',
    order: {
      items: [
        {
          name: 'Camo Tee',
          detail: 'Shadow Forest · XL',
          quantity: 1,
          amount: 3900,
        },
        {
          name: 'Relaxed Hoodie',
          detail: 'Heather Gray · XL',
          quantity: 1,
          amount: 6800,
        },
        {
          name: 'Lounge Jogger',
          detail: 'Black · L',
          quantity: 1,
          amount: 5800,
        },
        {
          name: 'Crew Socks, 3-pack',
          detail: 'White · One size',
          quantity: 2,
          amount: 3600,
        },
      ],
      subtotal: 20100,
      shipping: { amount: 995, method: 'Standard, 3–6 days' },
      tax: { amount: 1262, estimated: true },
      details: [
        { label: 'Delivery', value: 'Waukesha, WI' },
        {
          label: 'Returns',
          value: 'Review the merchant’s return terms before approving.',
        },
      ],
    },
  },
  payment_methods: [
    { id: 'fixture-visa', display: 'Visa ···· 4242' },
    { id: 'fixture-mastercard', display: 'Mastercard ···· 4444' },
  ],
};

function Demo({
  status = 'pending',
  single = false,
  empty = false,
  loadError = false,
  purchase = payment.purchase,
}: {
  status?: WalletView['status'];
  single?: boolean;
  empty?: boolean;
  loadError?: boolean;
  purchase?: WalletView['purchase'];
}) {
  const [view, setView] = useState<WalletView>({
    ...payment,
    status,
    purchase,
    ...(status === 'pending'
      ? { action: { name: 'approve', url: 'https://example.com/fixture-only' } }
      : {}),
    payment_methods: empty
      ? []
      : single
        ? payment.payment_methods?.slice(0, 1)
        : payment.payment_methods,
  });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(
    loadError
      ? 'Couldn’t load this payment request. Please try again.'
      : undefined
  );
  return (
    <FixtureWrapper fillWidth fillHeight>
      <YStack padding="$l" gap="$l" width="100%" maxWidth={560}>
        <Text color="$secondaryText">
          Demo only. No connection to Link and no purchase.
        </Text>
        <Text size="$label/l">~zod</Text>
        <Text>
          Your payment is ready to review. After you approve in Stripe Link,
          I’ll complete it.
        </Text>
        <BrowserPaymentCard
          view={view}
          onOpen={() => setOpen(true)}
          onOpenLink={() => setView({ ...view, status: 'ready' })}
        />
        <BrowserPaymentSheet
          open={open}
          onClose={() => setOpen(false)}
          view={error ? undefined : view}
          error={error}
          onRetry={() => setError(undefined)}
          onCancel={() => setView({ ...view, status: 'cancelled' })}
          onApprove={() => setView({ ...view, status: 'authorizing' })}
          onOpenLink={() => setView({ ...view, status: 'ready' })}
        />
        {view.status === 'authorizing' ? (
          <YStack gap="$m">
            <Text>Simulate Link’s response, then reopen the card:</Text>
            <Button
              label="Simulate approval"
              onPress={() => setView({ ...view, status: 'ready' })}
            />
            <Button
              label="Simulate cancellation"
              onPress={() => setView({ ...view, status: 'cancelled' })}
            />
          </YStack>
        ) : null}
      </YStack>
    </FixtureWrapper>
  );
}

export default {
  Pending: <Demo />,
  ChoosePaymentMethod: <Demo status="review" />,
  Flight: (
    <Demo
      purchase={{
        merchant: 'Example Air',
        page_url: 'https://example.com/checkout',
        amount: 35460,
        currency: 'usd',
        description:
          'One adult, round trip. Non-refundable fare; no checked baggage included.',
        order: {
          items: [
            {
              name: 'Chicago → New York',
              detail: 'Round trip · Economy',
              quantity: 1,
              amount: 30000,
            },
          ],
          subtotal: 30000,
          tax: { amount: 5460, estimated: false },
          details: [
            { label: 'Travel dates', value: 'Nov 10–14, 2026' },
            { label: 'Traveler', value: 'Alex Example' },
            {
              label: 'Fare rules',
              value: 'Non-refundable. Changes may incur a fare difference.',
            },
          ],
        },
      }}
    />
  ),
  Hotel: (
    <Demo
      purchase={{
        merchant: 'Example Hotel',
        page_url: 'https://example.com/checkout',
        amount: 46000,
        currency: 'usd',
        description: 'Two nights, one room, two adults.',
        order: {
          items: [
            {
              name: 'King room',
              detail: 'Two nights',
              quantity: 1,
              amount: 40000,
            },
          ],
          subtotal: 40000,
          tax: { amount: 4000, estimated: false },
          fees: 2000,
          details: [
            { label: 'Stay', value: 'Nov 10–12, 2026' },
            {
              label: 'Cancellation',
              value: 'Free until Nov 8 at 6 PM local time.',
            },
          ],
        },
      }}
    />
  ),
  Bill: (
    <Demo
      purchase={{
        merchant: 'Example Energy',
        page_url: 'https://example.com/pay',
        amount: 8472,
        currency: 'usd',
        description:
          'One-time payment of the current balance. Does not enroll in autopay.',
        order: {
          items: [
            {
              name: 'Electricity bill',
              detail: 'October 2026',
              quantity: 1,
              amount: 8472,
            },
          ],
          subtotal: 8472,
          details: [
            { label: 'Account', value: 'Ending 1234' },
            { label: 'Due date', value: 'November 15, 2026' },
          ],
        },
      }}
    />
  ),
  OnePaymentMethod: <Demo single />,
  NoPaymentMethods: <Demo empty />,
  WaitingForLink: <Demo status="authorizing" />,
  Approved: <Demo status="ready" />,
  Filled: <Demo status="filled" />,
  Cancelled: <Demo status="cancelled" />,
  Expired: <Demo status="expired" />,
  Failed: <Demo status="failed" />,
  Unknown: <Demo status="unknown" />,
  LoadFailure: <Demo loadError />,
};
