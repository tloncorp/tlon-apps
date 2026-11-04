import { z } from 'zod';
import { PostBlobDataEntryBrowserWalletSchema } from './browserCards';
import {
  browserOwnerRequest,
  browserOwnerServiceOrigin,
} from './browserOwnerSession';

export const paymentOrderSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      detail: z.string().optional(),
      quantity: z.number().int(),
      amount: z.number().int(),
    })
  ),
  subtotal: z.number().int(),
  shipping: z
    .object({ amount: z.number().int(), method: z.string() })
    .optional(),
  tax: z
    .object({ amount: z.number().int(), estimated: z.boolean() })
    .optional(),
  discount: z.number().int().optional(),
  fees: z.number().int().optional(),
  details: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .optional(),
});
export type PaymentOrder = z.infer<typeof paymentOrderSchema>;

export const walletViewSchema = z.object({
  request_id: z.string().uuid(),
  kind: z.enum(['connect', 'payment']),
  status: z.enum([
    'pending',
    'review',
    'authorizing',
    'ready',
    'connected',
    'filled',
    'filling',
    'cancelled',
    'expired',
    'failed',
    'unknown',
  ]),
  expires_at: z.number(),
  connection_mode: z.literal('tlon_oauth').optional(),
  payment_source: z.enum(['link', 'site_saved']).optional(),
  saved_payment: z
    .object({ method: z.string(), destination: z.string().optional() })
    .optional(),
  purchase: z
    .object({
      merchant: z.string(),
      page_url: z.string().url(),
      amount: z.number().int(),
      currency: z.string(),
      description: z.string(),
      order: paymentOrderSchema.optional(),
    })
    .optional(),
  payment_methods: z
    .array(z.object({ id: z.string(), display: z.string() }))
    .optional(),
  action: z.object({ name: z.string(), url: z.string().url() }).optional(),
});
export type WalletView = z.infer<typeof walletViewSchema>;

/** Only the opaque request ID is carried in chat; details require owner authentication. */
export function browserWalletCard(requestId: string, _surfaceId?: string) {
  return PostBlobDataEntryBrowserWalletSchema.parse({
    type: 'browser-wallet',
    version: 1,
    requestId,
  });
}

export async function browserWalletRequest(
  botMoon: string,
  requestId: string,
  operation: 'view' | 'approve' | 'cancel' = 'view',
  body?: { confirmed: true; payment_method_id?: string },
  signal?: AbortSignal
): Promise<WalletView> {
  z.string().uuid().parse(requestId);
  const suffix = operation === 'view' ? '' : `/${operation}`;
  return (await browserOwnerRequest(
    `${browserOwnerServiceOrigin()}/owner/wallet-actions/${requestId}${suffix}`,
    botMoon,
    operation === 'view' ? 'GET' : 'POST',
    body,
    signal
  )) as WalletView;
}
