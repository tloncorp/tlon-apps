import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import { Icon } from '@tloncorp/ui';
import { useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SizableText, View, YStack } from 'tamagui';

const logger = createDevLogger('UnsupportedViewNotice', false);

/**
 * Shown where a channel's composer would go when the channel declares a draft
 * input this build has not registered — a view from a newer client or from a
 * kit whose renderer ships in a later release.
 *
 * Deliberately not a `ReadOnlyNotice` variant: that component's vocabulary is
 * permission and protocol states, and this is neither. The posts themselves
 * still render, so this notice is the whole degradation — see
 * `docs/tlon-apps/channel-views.md`.
 */
export function UnsupportedViewNotice({
  slot,
  viewId,
}: {
  slot: 'draft-input';
  viewId: string;
}) {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (hasTracked.current) {
      return;
    }
    hasTracked.current = true;
    logger.trackEvent(AnalyticsEvent.UnknownChannelViewSeen, {
      slot,
      viewId,
    });
  }, [slot, viewId]);

  return (
    <SafeAreaView edges={['right', 'left', 'bottom']}>
      <YStack
        padding="$l"
        alignItems="center"
        justifyContent="center"
        backgroundColor="$background"
        borderTopWidth={1}
        borderTopColor="$border"
        testID="unsupported-view-notice"
      >
        <View flexDirection="row" alignItems="center" gap="$m">
          <Icon type="Info" size="$s" color="$tertiaryText" />
          <SizableText size="$s" color="$tertiaryText">
            Upgrade your app to post in this channel.
          </SizableText>
        </View>
      </YStack>
    </SafeAreaView>
  );
}
