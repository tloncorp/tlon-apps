import type * as db from '@tloncorp/shared/dist/db';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeft, Search } from '../../assets/icons';
import { SizableText, View, XStack } from '../../core';
import { IconButton } from '../IconButton';
import { BaubleHeader } from './BaubleHeader';

// TODO: break this out, use for all headers.
export function GenericHeader({
  title,
  goBack,
  showSpinner,
  rightContent,
}: {
  title?: string;
  goBack?: () => void;
  showSpinner?: boolean;
  rightContent?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View paddingTop={insets.top}>
      <XStack
        alignItems="center"
        gap="$m"
        height="$4xl"
        justifyContent="space-between"
        paddingHorizontal="$xl"
        paddingVertical="$m"
      >
        <XStack alignItems="center" gap="$m" flex={1}>
          <IconButton onPress={goBack}>
            <ChevronLeft />
          </IconButton>
          <Animated.View
            key={showSpinner?.toString()}
            entering={FadeInDown}
            exiting={FadeOutUp}
            style={{ flex: 1 }}
          >
            <SizableText
              flexShrink={1}
              numberOfLines={1}
              color="$primaryText"
              size="$m"
              fontWeight="500"
            >
              {showSpinner ? 'Loading…' : title}
            </SizableText>
          </Animated.View>
        </XStack>
        <XStack gap="$m" alignItems="center">
          {rightContent}
        </XStack>
      </XStack>
    </View>
  );
}

export function ChannelHeader({
  title,
  mode = 'default',
  channel,
  group,
  goBack,
  goToSearch,
  showSpinner,
  showSearchButton = true,
}: {
  title: string;
  mode?: 'default' | 'next';
  channel: db.Channel;
  group?: db.Group | null;
  goBack?: () => void;
  goToSearch?: () => void;
  showSpinner?: boolean;
  showSearchButton?: boolean;
}) {
  if (mode === 'next') {
    return <BaubleHeader channel={channel} group={group} />;
  }
  return (
    <GenericHeader
      title={title}
      goBack={goBack}
      showSpinner={showSpinner}
      rightContent={
        <>
          {showSearchButton && (
            <IconButton onPress={goToSearch}>
              <Search />
            </IconButton>
          )}
        </>
      }
    />
  );
}
