import {
  AnalyticsEvent,
  createDevLogger,
  useConnectionStatus,
} from '@tloncorp/shared';
import { Icon } from '@tloncorp/ui';
import { useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SizableText, View, YStack } from 'tamagui';

const logger = createDevLogger('ReadOnlyNotice', false);

export function ReadOnlyNotice({
  type,
}: {
  type:
    | 'read-only'
    | 'dm-mismatch'
    | 'group-dm-mismatch'
    | 'channel-mismatch'
    | 'no-longer-read'
    | 'channel-deleted'
    | 'group-deleted';
}) {
  const connectionStatus = useConnectionStatus();
  const hasTrackedProtocolMismatchNotice = useRef(false);
  const isProtocolMismatch =
    type === 'dm-mismatch' ||
    type === 'group-dm-mismatch' ||
    type === 'channel-mismatch';

  useEffect(() => {
    if (!isProtocolMismatch || hasTrackedProtocolMismatchNotice.current) {
      return;
    }

    hasTrackedProtocolMismatchNotice.current = true;
    logger.trackEvent(AnalyticsEvent.ProtocolMismatchNoticeSeen, {
      noticeType: type,
      connectionStatus,
      isShipConnectionStatusConnected: connectionStatus === 'Connected',
    });
  }, [connectionStatus, isProtocolMismatch, type]);

  const Message =
    type === 'read-only' ? (
      <>This channel is read-only for you.</>
    ) : type === 'no-longer-read' ? (
      <>You no longer have permission to read this channel.</>
    ) : type === 'group-deleted' ? (
      <>This group no longer exists.</>
    ) : (
      <>
        Your node&apos;s version of the Tlon app doesn&apos;t match the{' '}
        {type === 'dm-mismatch'
          ? 'other node.'
          : type === 'group-dm-mismatch'
            ? 'other nodes.'
            : 'channel host.'}
      </>
    );

  return (
    <SafeAreaView edges={['right', 'left', 'bottom']}>
      <YStack
        padding="$l"
        alignItems="center"
        justifyContent="center"
        backgroundColor="$background"
        borderTopWidth={1}
        borderTopColor="$border"
        testID={`read-only-notice-${type}`}
      >
        <View flexDirection="row" alignItems="center" gap="$m">
          <Icon type="Info" size="$s" color="$tertiaryText" />
          <SizableText size="$s" color="$tertiaryText">
            {Message}
          </SizableText>
        </View>
      </YStack>
    </SafeAreaView>
  );
}
