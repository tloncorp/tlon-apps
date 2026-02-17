import { useCallback, useEffect, useRef, useState } from 'react';
import { useValue } from 'react-cosmos/client';

import { Button, ScreenHeader, View } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';

function StaticHeaderFixture() {
  return (
    <FixtureWrapper fillWidth verticalAlign="top" backgroundColor="$background">
      <ScreenHeader title="heelo" />
    </FixtureWrapper>
  );
}

function AnimatedLoadingHeaderFixture({
  fixtureName,
  defaultTitle,
  defaultSubtitle,
  defaultLoadingSubtitle,
  useHorizontalTitleLayout = false,
  showSubtitle = false,
  withTitleIcon = false,
}: {
  fixtureName: string;
  defaultTitle: string;
  defaultSubtitle?: string;
  defaultLoadingSubtitle: string;
  useHorizontalTitleLayout?: boolean;
  showSubtitle?: boolean;
  withTitleIcon?: boolean;
}) {
  const [title] = useValue(`${fixtureName} Title`, { defaultValue: defaultTitle });
  const [subtitle] = useValue(`${fixtureName} Subtitle`, {
    defaultValue: defaultSubtitle ?? 'Important announcements',
  });
  const [loadingSubtitle] = useValue(`${fixtureName} Loading Subtitle`, {
    defaultValue: defaultLoadingSubtitle,
  });
  const [holdForMs] = useValue(`${fixtureName} Replay Duration (ms)`, {
    defaultValue: 1400,
  });
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearReplayTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const replay = useCallback(() => {
    clearReplayTimeout();
    setIsLoading(true);
    timeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      timeoutRef.current = null;
    }, Number(holdForMs) || 1400);
  }, [clearReplayTimeout, holdForMs]);

  useEffect(() => {
    return clearReplayTimeout;
  }, [clearReplayTimeout]);

  return (
    <FixtureWrapper fillWidth verticalAlign="top" backgroundColor="$background">
      <ScreenHeader
        title={title}
        subtitle={showSubtitle ? subtitle : undefined}
        showSubtitle={showSubtitle}
        titleIcon={withTitleIcon
          ? (
              <View
                width={18}
                height={18}
                borderRadius={999}
                backgroundColor="$tertiaryText"
              />
            )
          : undefined}
        onTitlePress={useHorizontalTitleLayout ? () => {} : undefined}
        loadingSubtitle={isLoading ? loadingSubtitle : null}
        useHorizontalTitleLayout={useHorizontalTitleLayout}
        borderBottom
      />
      <View
        flexDirection="row"
        alignItems="center"
        gap="$s"
        paddingHorizontal="$l"
        paddingTop="$s"
      >
        <Button
          fill="outline"
          type="primary"
          onPress={replay}
          label="Replay Animation"
        />
        <Button
          fill="outline"
          type="primary"
          onPress={() => {
            clearReplayTimeout();
            setIsLoading((prev) => !prev);
          }}
          label={isLoading ? 'Stop Loading' : 'Start Loading'}
        />
      </View>
    </FixtureWrapper>
  );
}

export default {
  Static: <StaticHeaderFixture />,
  'Animated Loading (Mobile)': (
    <AnimatedLoadingHeaderFixture
      fixtureName="Mobile"
      defaultTitle="Watercooler"
      defaultLoadingSubtitle="Loading 231 messages from host..."
    />
  ),
  'Animated Loading (Desktop)': (
    <AnimatedLoadingHeaderFixture
      fixtureName="Desktop"
      defaultTitle="Bulletin Board"
      defaultSubtitle="Important announcements"
      defaultLoadingSubtitle="Loading messages…"
      useHorizontalTitleLayout
      showSubtitle
      withTitleIcon
    />
  ),
  'Animated Loading (Desktop Short Title)': (
    <AnimatedLoadingHeaderFixture
      fixtureName="Desktop Short Title"
      defaultTitle="BB"
      defaultSubtitle="Important announcements"
      defaultLoadingSubtitle="Syncing messages and metadata from host..."
      useHorizontalTitleLayout
      showSubtitle
      withTitleIcon
    />
  ),
};
