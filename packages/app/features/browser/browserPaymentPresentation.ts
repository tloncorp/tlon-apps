import type { WalletView } from '@tloncorp/api/client/browserWallet';

export function displayPaymentAmount(amount: number, currency: string) {
  const format = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
    currencyDisplay: currency.toUpperCase() === 'USD' ? 'narrowSymbol' : 'code',
  });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(amount / 10 ** digits);
}

export const walletFinished = new Set<WalletView['status']>([
  'connected',
  'ready',
  'filled',
  'cancelled',
  'expired',
  'failed',
  'unknown',
]);

export const walletStatusCopy: Record<
  WalletView['status'],
  { title: string; description: string }
> = {
  pending: {
    title: 'Connect Link',
    description:
      'Connect your Link account to use your saved payment methods. Connecting does not approve a purchase.',
  },
  review: {
    title: 'Review payment',
    description:
      'After you approve in Link, your Tlonbot will place this order for the amount shown.',
  },
  authorizing: {
    title: 'Waiting for Link',
    description:
      'Complete your approval in Link. This request will update when Link confirms your decision.',
  },
  ready: {
    title: 'Payment approved',
    description:
      'Your Tlonbot is continuing with the approved order and will report the result in chat.',
  },
  connected: {
    title: 'Link connected',
    description:
      'Your bot can request a payment when you’re ready. Each payment needs your approval.',
  },
  filling: {
    title: 'Filling checkout',
    description:
      'Your payment details are being sent to the browser. This is not an order confirmation.',
  },
  filled: {
    title: 'Checkout filled',
    description:
      'Your Tlonbot has filled the checkout and will verify the order result. This is not an order confirmation.',
  },
  cancelled: {
    title: 'Request cancelled',
    description:
      'This payment request was cancelled. Ask your bot for a new request if you want to continue.',
  },
  expired: {
    title: 'Request expired',
    description:
      'This payment request has expired. Ask your bot for a new request if you want to continue.',
  },
  failed: {
    title: 'Payment request failed',
    description:
      'This request couldn’t be completed. Ask your bot to check the checkout before trying again.',
  },
  unknown: {
    title: 'Payment needs checking',
    description:
      'We couldn’t confirm the result. Ask your bot to inspect the existing checkout before starting another payment.',
  },
};

export function paymentStatus(
  view: WalletView
): 'Pending' | 'Approved' | 'Expired' {
  if (['ready', 'filling', 'filled', 'connected'].includes(view.status))
    return 'Approved';
  if (view.status === 'expired' || view.status === 'cancelled')
    return 'Expired';
  return 'Pending';
}

export function paymentStatusCopy(view: WalletView) {
  if (view.kind === 'payment' && view.status === 'pending')
    return {
      title: 'Pending',
      description:
        'Approve in Stripe Link. Your Tlonbot will then complete this payment and report the result in chat.',
    };
  return walletStatusCopy[view.status];
}
