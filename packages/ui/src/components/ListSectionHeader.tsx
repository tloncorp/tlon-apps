import { Platform } from 'react-native';
import { View, styled } from 'tamagui';

import { SizableText } from '../core';

export const ListSectionHeader = ({ children }: { children: string }) => {
  return (
    <ListSectionHeaderContainer>
      <Text>{children}</Text>
    </ListSectionHeaderContainer>
  );
};

const ListSectionHeaderContainer = styled(View, {
  paddingHorizontal: '$l',
  paddingVertical: '$m',
});

const Text = styled(SizableText, {
  size: '$s',
  color: '$secondaryText',
  lineHeight: Platform.OS === 'ios' ? 0 : undefined,
});
