import { ScrollView } from 'tamagui';

import {
  ManageChannelsScrollContainerProps,
  ManageChannelsScrollRef,
} from './ManageChannelsScrollContainer.types';

export function ManageChannelsScrollContainer({
  children,
  paddingBottom,
}: ManageChannelsScrollContainerProps) {
  return (
    <ScrollView
      style={{ zIndex: 1, elevation: 1, width: '100%' }}
      contentContainerStyle={{
        alignItems: 'center',
        paddingBottom,
        minHeight: '100%',
      }}
    >
      {children}
    </ScrollView>
  );
}

export function useManageChannelsScrollRef(): ManageChannelsScrollRef {
  return undefined;
}
