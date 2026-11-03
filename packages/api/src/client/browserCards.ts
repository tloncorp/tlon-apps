import { z } from 'zod';
import { MAX_BROWSER_VIEWER_URL_LENGTH } from './browserSession';

const viewerUrl = z.string().url().max(MAX_BROWSER_VIEWER_URL_LENGTH);
export const BrowserCardPresentationSchema = z
  .object({
    purpose: z.enum(['login', 'otp', 'details']),
    site: z.string().min(1).max(253),
  })
  .strict();

export const PostBlobDataEntryBrowserSessionSchema = z
  .object({
    type: z.literal('browser-session'),
    version: z.literal(1),
    viewerUrl,
  })
  .strict();

export const PostBlobDataEntryBrowserSecureEntrySchema = z
  .object({
    type: z.literal('browser-secure-entry'),
    version: z.literal(1),
    viewerUrl,
    presentation: BrowserCardPresentationSchema.optional(),
    loginApproval: z
      .object({
        record: z
          .object({
            id: z.string().min(1).max(128),
            revision: z.number().int().positive(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type PostBlobDataEntryBrowserSession = z.infer<
  typeof PostBlobDataEntryBrowserSessionSchema
>;
export type PostBlobDataEntryBrowserSecureEntry = z.infer<
  typeof PostBlobDataEntryBrowserSecureEntrySchema
>;
export type BrowserCardData =
  | PostBlobDataEntryBrowserSession
  | PostBlobDataEntryBrowserSecureEntry;
