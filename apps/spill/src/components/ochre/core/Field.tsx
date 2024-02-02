import {styled, withStaticProperties} from 'tamagui';
import {SizableText, YStack} from './tamagui';

const FieldFrame = styled(YStack, {
  gap: '$s',
});

const FieldLabel = styled(SizableText, {
  color: '$secondaryText',
});

const FieldInput = styled(YStack, {});

export const Field = withStaticProperties(FieldFrame, {
  Label: FieldLabel,
  Input: FieldInput,
});
