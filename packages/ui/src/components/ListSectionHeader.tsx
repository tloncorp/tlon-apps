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
  paddingVertical: '$xl',
});

const Text = styled(SizableText, {
  size: '$s',
  color: '$secondaryText',
  lineHeight: 0,
});
