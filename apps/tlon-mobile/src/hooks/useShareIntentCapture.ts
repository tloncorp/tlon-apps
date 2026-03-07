import { useToast } from '@tloncorp/app/ui';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useShareIntent } from 'expo-share-intent';
import { useEffect, useRef } from 'react';

import {
  extractSharedFile,
  extractSharedText,
  getShareIntentFingerprint,
} from '../lib/shareIntent';

const shareIntentLogger = createDevLogger('shareIntent', true);

export const useShareIntentCapture = () => {
  const toast = useToast();
  const lastHandledShareRef = useRef<string | null>(null);
  const { error, hasShareIntent, isReady, resetShareIntent, shareIntent } =
    useShareIntent({
      scheme: 'io.tlon.groups',
    });

  useEffect(() => {
    if (!error) {
      return;
    }

    shareIntentLogger.error('Failed to read share intent', error);
  }, [error]);

  useEffect(() => {
    if (!hasShareIntent) {
      lastHandledShareRef.current = null;
    }
  }, [hasShareIntent]);

  useEffect(() => {
    if (!isReady || !hasShareIntent) {
      return;
    }

    const fingerprint = getShareIntentFingerprint(shareIntent);

    if (lastHandledShareRef.current === fingerprint) {
      return;
    }

    lastHandledShareRef.current = fingerprint;

    void (async () => {
      const sharedText = extractSharedText(shareIntent);
      const sharedFile = extractSharedFile(shareIntent.files);
      const hasMoreThanOneFile = (shareIntent.files?.length ?? 0) > 1;

      if (!sharedText && !sharedFile) {
        toast({
          message: 'Share opened in Tlon.',
          duration: 1800,
        });
      } else {
        await db.pendingShareIntent.setValue({
          createdAt: Date.now(),
          text: sharedText,
          file: sharedFile,
        });

        const hasText = Boolean(sharedText);
        toast({
          message:
            sharedFile
              ? hasText
                ? 'Shared content is ready. Open a channel to attach.'
                : 'Shared file is ready. Open a channel to attach.'
              : 'Shared text is ready. Open a channel to insert.',
          duration: 2400,
        });
      }

      if (hasMoreThanOneFile) {
        shareIntentLogger.log('Received multiple files; only the first will be used');
      }

      shareIntentLogger.log(
        `Processed share intent type=${shareIntent.type} files=${shareIntent.files?.length ?? 0}`
      );
    })()
      .catch((err) => {
        shareIntentLogger.error('Failed to process share intent', err);
      })
      .finally(() => {
        resetShareIntent();
      });
  }, [hasShareIntent, isReady, resetShareIntent, shareIntent, toast]);
};
