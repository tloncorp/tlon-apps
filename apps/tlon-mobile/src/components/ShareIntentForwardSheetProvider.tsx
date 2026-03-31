import {
  ForwardToChannelSheet,
  useForwardToChannelSheet,
} from '@tloncorp/app/ui';
import type {
  ChannelShareIntentParams,
  RootStackParamList,
} from '@tloncorp/app/navigation/types';
import { screenNameFromChannelId } from '@tloncorp/app/navigation/utils';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { APP_SCHEME } from '@tloncorp/app/constants';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useShareIntent } from 'expo-share-intent';
import { PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react';

import {
  extractSharedFile,
  extractSharedText,
  getShareIntentFingerprint,
} from '../lib/shareIntent';

const IMAGE_FILE_EXTENSION_REGEX = /\.(png|jpe?g|gif|webp|heic|heif|bmp|tiff?)$/i;
const shareIntentLogger = createDevLogger('shareIntent', true);

const isLikelyImageFile = (file: NonNullable<ChannelShareIntentParams['file']>) => {
  if (file.mimeType?.startsWith('image/')) {
    return true;
  }
  const sourceName = file.fileName || file.path;
  return IMAGE_FILE_EXTENSION_REGEX.test(sourceName);
};

type ShareIntentForwardSheetProviderProps = PropsWithChildren<{
  enabled?: boolean;
}>;

export function ShareIntentForwardSheetProvider({
  children,
  enabled = true,
}: ShareIntentForwardSheetProviderProps) {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingShare, setPendingShare] =
    useState<ChannelShareIntentParams | null>(null);
  const lastHandledShareRef = useRef<string | null>(null);
  const { error, hasShareIntent, isReady, resetShareIntent, shareIntent } =
    useShareIntent({
      scheme: APP_SCHEME,
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

      if (sharedText || sharedFile) {
        setPendingShare({
          createdAt: Date.now(),
          text: sharedText,
          file: sharedFile,
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
  }, [hasShareIntent, isReady, resetShareIntent, shareIntent]);

  useEffect(() => {
    if (!pendingShare || !enabled || isOpen) {
      return;
    }
    setIsOpen(true);
  }, [enabled, isOpen, pendingShare]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (!open) {
        setPendingShare((current) => (current ? null : current));
      }
    },
    []
  );

  const handleNavigateToChannel = useCallback(
    async (channel: db.Channel) => {
      if (!enabled) {
        throw new Error('Share routing is not ready yet');
      }
      if (!pendingShare) {
        throw new Error('Missing pending share');
      }

      if (
        channel.type === 'gallery' &&
        pendingShare.file &&
        !isLikelyImageFile(pendingShare.file)
      ) {
        throw new Error('Gallery channels only support image shares');
      }

      const screenName = screenNameFromChannelId(channel.id);
      if (screenName === 'Channel') {
        navigation.navigate('Channel', {
          channelId: channel.id,
          groupId: channel.groupId ?? undefined,
          startDraft: true,
          shareIntent: pendingShare,
        });
      } else if (screenName === 'DM') {
        navigation.navigate('DM', {
          channelId: channel.id,
          startDraft: true,
          shareIntent: pendingShare,
        });
      } else {
        navigation.navigate('GroupDM', {
          channelId: channel.id,
          startDraft: true,
          shareIntent: pendingShare,
        });
      }

      setPendingShare(null);
    },
    [enabled, navigation, pendingShare]
  );

  const { handleChannelSelected, renderFooter } = useForwardToChannelSheet({
    isOpen,
    onClose: () => handleOpenChange(false),
    onForwardToChannel: handleNavigateToChannel,
    successMessage: () => null,
    failureMessage: 'Failed to open channel',
  });

  return (
    <>
      {children}
      <ForwardToChannelSheet
        open={isOpen}
        onOpenChange={handleOpenChange}
        title="Send to channel"
        onChannelSelected={handleChannelSelected}
        footerComponent={renderFooter}
      />
    </>
  );
}
