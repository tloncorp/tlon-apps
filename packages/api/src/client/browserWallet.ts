import { z } from 'zod';
import type { A2UI } from './a2ui';

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
  purchase: z
    .object({
      merchant: z.string(),
      page_url: z.string().url(),
      amount: z.number().int(),
      currency: z.string(),
      description: z.string(),
    })
    .optional(),
  payment_methods: z
    .array(z.object({ id: z.string(), display: z.string() }))
    .optional(),
  action: z.object({ name: z.string(), url: z.string().url() }).optional(),
});
export type WalletView = z.infer<typeof walletViewSchema>;

/** Only opaque IDs are carried in a chat card. Owner authentication happens on open. */
export function browserWalletCard(
  requestId: string,
  surfaceId: string
): A2UI.BlobEntry {
  z.string().uuid().parse(requestId);
  return {
    type: 'a2ui',
    version: 1,
    storyMode: 'fallback',
    messages: [
      {
        version: 'v0.9',
        createSurface: { surfaceId, catalogId: 'tlon.a2ui.basic.v2' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId,
          root: 'root',
          components: [
            { id: 'root', component: 'Card', child: 'body' },
            {
              id: 'body',
              component: 'Column',
              children: ['title', 'description', 'open'],
            },
            {
              id: 'title',
              component: 'Text',
              variant: 'h3',
              text: 'Tlon wallet',
            },
            {
              id: 'description',
              component: 'Text',
              text: 'Review this wallet request. Connecting Link does not approve a purchase.',
            },
            {
              id: 'open',
              component: 'Button',
              variant: 'primary',
              child: 'label',
              action: {
                event: {
                  name: 'tlon.navigate',
                  context: {
                    target: {
                      type: 'screen',
                      screen: 'browserWallet',
                      requestId,
                    },
                  },
                },
              },
            },
            { id: 'label', component: 'Text', text: 'Open wallet request' },
          ],
        },
      },
    ],
  };
}
