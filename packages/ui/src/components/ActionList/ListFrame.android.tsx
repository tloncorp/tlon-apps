import { YStack, styled } from 'tamagui';

const ListFrame = styled(YStack, {
  overflow: 'hidden',
  backgroundColor: '$secondaryBackground',
  shadowColor: '$black',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 3.84,
  elevation: 5,
});

export default ListFrame;
