import { View, styled } from 'tamagui';

export const BlockquoteSideBorder = styled(View, {
  name: 'BlockquoteSideBorder',
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 2,
  borderRadius: 1,
  left: -2,
  backgroundColor: '$border',
});
