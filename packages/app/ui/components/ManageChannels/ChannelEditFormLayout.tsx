import * as db from '@tloncorp/shared/db';
import { KeyboardAvoidingView, useIsWindowNarrow } from '@tloncorp/ui';
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
      {/* Keyboard avoidance wraps only the scrollable content, not the
          ScreenHeader. On Android the shared KeyboardAvoidingView uses
          behavior="position", which shifts its subtree up when the keyboard
          opens; including the header there leaves it stranded under the status
          bar after the keyboard is dismissed (TLON-6173). */}
      <KeyboardAvoidingView style={{ flex: 1 }}>
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
      </KeyboardAvoidingView>
    </View>
  );
}
