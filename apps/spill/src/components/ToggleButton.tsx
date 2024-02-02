import {createStyledContext, styled, withStaticProperties} from 'tamagui';
import {SizableText, XStack} from '@ochre';

const ToggleButtonContext = createStyledContext<{
  active: boolean;
}>({
  active: false,
});

const ToggleButtonFrame = styled(XStack, {
  context: ToggleButtonContext,
  justifyContent: 'space-between',
  padding: '$s',
  paddingHorizontal: '$l',
  gap: '$s',
  borderRadius: '$m',
  borderColor: '$border',
  alignItems: 'center',
  borderWidth: 1,
  variants: {
    active: {
      true: {
        borderColor: '$green',
        backgroundColor: '$green',
      },
    },
  } as const,
});

const ToggleButtonText = styled(SizableText, {
  context: ToggleButtonContext,
  variants: {
    active: {
      true: {
        color: '$background',
      },
    },
  } as const,
});

export const ToggleButton = withStaticProperties(ToggleButtonFrame, {
  Props: ToggleButtonContext,
  Text: ToggleButtonText,
});
