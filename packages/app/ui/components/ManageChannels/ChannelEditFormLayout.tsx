import * as db from '@tloncorp/shared/db';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View } from 'tamagui';

import { ScreenHeader } from '../ScreenHeader';

interface ChannelEditFormLayoutProps {
  title: string;
  channel?: db.Channel | null;
  group?: db.Group | null;
  onGoBack: () => void;
  isLoading: boolean;
  rightControls?: ReactNode;
  children: ReactNode;
}

/**
 * Shared layout wrapper for channel edit screens (meta, privacy, etc.)
 * Provides consistent ScreenHeader, ScrollView with safe area padding,
 * and responsive layout behavior.
 */
export function ChannelEditFormLayout({
  title,
  channel,
  group,
  onGoBack,
  isLoading,
  rightControls,
  children,
}: ChannelEditFormLayoutProps) {
  const insets = useSafeAreaInsets();
  const isWindowNarrow = useIsWindowNarrow();

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        title={title}
        subtitle={`${group?.title}: ${channel?.title}`}
        showSubtitle={!!channel?.title && !!group?.title}
        backgroundColor="$secondaryBackground"
        backAction={onGoBack}
        loadingSubtitle={isLoading ? 'Loading…' : null}
        useHorizontalTitleLayout={!isWindowNarrow}
        rightControls={rightControls}
      />
      <ScrollView
        flex={1}
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          minHeight: '100%',
          paddingBottom: insets.bottom,
        }}
      >
        {children}
      </ScrollView>
    </View>
  );
}
