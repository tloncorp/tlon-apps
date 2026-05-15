import { createContext, useContext } from 'react';
import Animated, { useAnimatedRef } from 'react-native-reanimated';

import {
  ManageChannelsScrollContainerProps,
  ManageChannelsScrollRef,
} from './ManageChannelsScrollContainer.types';

const ScrollRefContext = createContext<ManageChannelsScrollRef>(undefined);

export function ManageChannelsScrollContainer({
  children,
  paddingBottom,
}: ManageChannelsScrollContainerProps) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  return (
    <ScrollRefContext.Provider value={scrollRef}>
      <Animated.ScrollView
        ref={scrollRef}
        style={{ zIndex: 1, elevation: 1, width: '100%' }}
        contentContainerStyle={{
          alignItems: 'center',
          paddingBottom,
          minHeight: '100%',
        }}
      >
        {children}
      </Animated.ScrollView>
    </ScrollRefContext.Provider>
  );
}

export function useManageChannelsScrollRef(): ManageChannelsScrollRef {
  return useContext(ScrollRefContext);
}
