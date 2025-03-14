import { Pressable } from '@tloncorp/ui';
import * as Application from 'expo-application';
import { PropsWithChildren, useEffect, useState } from 'react';
import { Alert } from 'react-native';

const KONAMI_CLICKS = 5;
const KONAMI_TIME_WINDOW = 2000;

export function DebugInfo(props: PropsWithChildren<{ debugMessage: string }>) {
  const [clicks, setClicks] = useState<number[]>([]);
  const handlePress = () => {
    const now = Date.now();
    const newClicks = [...clicks, now];
    setClicks(newClicks);

    if (newClicks.length >= KONAMI_CLICKS) {
      const timeWindow = now - newClicks[newClicks.length - KONAMI_CLICKS];
      if (timeWindow <= KONAMI_TIME_WINDOW) {
        Alert.alert('Build Info', props.debugMessage);
        setClicks([]);
      }
    }
  };

  useEffect(() => {
    if (clicks.length > KONAMI_CLICKS) {
      setClicks(clicks.slice(1));
    }
  }, [clicks]);
  return <Pressable onPress={handlePress}>{props.children}</Pressable>;
}
