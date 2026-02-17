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

function AnimatedLoadingHeaderFixture() {
  const [title] = useValue('Title', { defaultValue: 'Watercooler' });
  const [loadingSubtitle] = useValue('Loading Subtitle', {
    defaultValue: 'Loading 231 messages from host...',
  });
  const [holdForMs] = useValue('Replay Duration (ms)', { defaultValue: 1400 });
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
        loadingSubtitle={isLoading ? loadingSubtitle : null}
        useHorizontalTitleLayout={false}
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
  'Animated Loading': <AnimatedLoadingHeaderFixture />,
};
