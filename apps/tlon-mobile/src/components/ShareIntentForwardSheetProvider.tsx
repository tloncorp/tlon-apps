import { NavigationProp, useNavigation } from '@react-navigation/native';
import { APP_SCHEME } from '@tloncorp/app/constants';
import { RootStackParamList } from '@tloncorp/app/navigation/types';
import { screenNameFromChannelId } from '@tloncorp/app/navigation/utils';
import type { ChannelShareIntent } from '@tloncorp/app/types/shareIntent';
import {
  ChannelShareIntentProvider,
  ForwardToChannelSheet,
  useForwardToChannelSheet,
} from '@tloncorp/app/ui';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useMutableRef } from '@tloncorp/shared/logic';
import { useShareIntent } from 'expo-share-intent';
import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  extractSharedFile,
  extractSharedText,
  extractSharedWebUrl,
  getShareIntentFingerprint,
} from '../lib/shareIntent';

const shareIntentLogger = createDevLogger('shareIntent', true);

type ShareIntentForwardSheetProviderProps = PropsWithChildren<{
  enabled?: boolean;
}>;

export function ShareIntentForwardSheetProvider({
  children,
  enabled = true,
}: ShareIntentForwardSheetProviderProps) {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingShare, setPendingShare] = useState<ChannelShareIntent | null>(
    null
  );
  const pendingShareIntentRef = useRef<{
    channelId: string;
    shareIntent: ChannelShareIntent;
  } | null>(null);
  const [pendingShareIntent, setPendingShareIntent] = useState<{
    channelId: string;
    shareIntent: ChannelShareIntent;
  } | null>(null);
  const lastHandledShareRef = useRef<string | null>(null);
  const { error, hasShareIntent, isReady, resetShareIntent, shareIntent } =
    useShareIntent({
      scheme: APP_SCHEME,
    });
  const resetShareIntentRef = useMutableRef(resetShareIntent);

  // Surface share-extension read failures without interrupting app startup.
  useEffect(() => {
    if (!error) {
      return;
    }
    shareIntentLogger.error('Failed to read share intent', error);
  }, [error]);

  // Allow the same shared content to be handled again after native state clears.
  useEffect(() => {
    if (!hasShareIntent) {
      lastHandledShareRef.current = null;
    }
  }, [hasShareIntent]);

  // Translate the current native share into app state once, then consume it.
  useEffect(() => {
    if (!isReady || !hasShareIntent) {
      return;
    }

    const fingerprint = getShareIntentFingerprint(shareIntent);
    if (lastHandledShareRef.current === fingerprint) {
      return;
    }

    lastHandledShareRef.current = fingerprint;

    try {
      const sharedText = extractSharedText(shareIntent);
      const sharedWebUrl = extractSharedWebUrl(shareIntent);
      const sharedFile = extractSharedFile(shareIntent.files);
      const hasMoreThanOneFile = (shareIntent.files?.length ?? 0) > 1;

      if (sharedText || sharedWebUrl || sharedFile) {
        setPendingShare({
          createdAt: Date.now(),
          text: sharedText,
          webUrl: sharedWebUrl,
          file: sharedFile,
        });
      }

      if (hasMoreThanOneFile) {
        shareIntentLogger.log(
          'Received multiple files; only the first will be used'
        );
      }

      shareIntentLogger.log(
        `Processed share intent type=${shareIntent.type} files=${shareIntent.files?.length ?? 0}`
      );
    } catch (err) {
      shareIntentLogger.error('Failed to process share intent', err);
    } finally {
      resetShareIntentRef.current();
    }
  }, [hasShareIntent, isReady, resetShareIntentRef, shareIntent]);

  // Open the channel picker as soon as there is a pending share to route.
  useEffect(() => {
    if (!pendingShare || !enabled || isOpen) {
      return;
    }
    setIsOpen(true);
  }, [enabled, isOpen, pendingShare]);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setPendingShare((current) => (current ? null : current));
    }
  }, []);

  const navigateToChannelTarget = useCallback(
    (channel: db.Channel) => {
      const screenName = screenNameFromChannelId(channel.id);
      if (screenName === 'Channel') {
        navigation.navigate('Channel', {
          channelId: channel.id,
          groupId: channel.groupId ?? undefined,
        });
      } else if (screenName === 'DM') {
        navigation.navigate('DM', {
          channelId: channel.id,
        });
      } else {
        navigation.navigate('GroupDM', {
          channelId: channel.id,
        });
      }
    },
    [navigation]
  );

  const popShareIntent = useCallback((channelId: string) => {
    const pendingChannelShareIntent = pendingShareIntentRef.current;
    if (
      !pendingChannelShareIntent ||
      pendingChannelShareIntent.channelId !== channelId
    ) {
      return null;
    }

    pendingShareIntentRef.current = null;
    setPendingShareIntent(null);

    return pendingChannelShareIntent.shareIntent;
  }, []);

  const channelShareIntentContextValue = useMemo(
    () => ({
      pendingShareIntent,
      popShareIntent,
    }),
    [pendingShareIntent, popShareIntent]
  );

  const routeShareIntentToChannel = useCallback(
    async (channel: db.Channel) => {
      if (!enabled) {
        throw new Error('Share routing is not ready yet');
      }
      if (!pendingShare) {
        throw new Error('Missing pending share');
      }

      // Route the pending share atomically: stash it for the destination
      // channel, then immediately navigate there to consume it.
      const nextPendingShareIntent = {
        channelId: channel.id,
        shareIntent: pendingShare,
      };

      pendingShareIntentRef.current = nextPendingShareIntent;
      setPendingShareIntent(nextPendingShareIntent);
      navigateToChannelTarget(channel);

      setPendingShare(null);
    },
    [enabled, navigateToChannelTarget, pendingShare]
  );

  const { handleChannelSelected, renderFooter } = useForwardToChannelSheet({
    isOpen,
    onClose: () => handleOpenChange(false),
    onForwardToChannel: routeShareIntentToChannel,
    successMessage: () => null,
    failureMessage: 'Failed to open channel',
  });

  return (
    <ChannelShareIntentProvider value={channelShareIntentContextValue}>
      {children}
      <ForwardToChannelSheet
        open={isOpen}
        onOpenChange={handleOpenChange}
        title="Send to channel"
        onChannelSelected={handleChannelSelected}
        channelFilter={(channel) => channel.type !== 'notebook'}
        footerComponent={renderFooter}
      />
    </ChannelShareIntentProvider>
  );
}
