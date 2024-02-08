import React from 'react';
import {
  StackProps,
  TamaguiElement,
  createSheet,
  styled,
  withStaticProperties,
} from 'tamagui';
import {YStack, SizableText, XStack, Stack} from './core';

const Overlay = styled(YStack, {
  name: 'SheetOverlay',
  animation: 'quick',
  enterStyle: {opacity: 0},
  exitStyle: {opacity: 0},
  backgroundColor: '$backgroundOverlay',
  fullscreen: true,
  position: 'absolute',
  zIndex: 100_000 - 1,
  pointerEvents: 'auto',
  variants: {
    open: {
      true: {
        opacity: 1,
        pointerEvents: 'auto',
      },
      false: {
        opacity: 0,
        pointerEvents: 'none',
      },
    },
  } as const,
});

const Frame = styled(YStack, {
  name: 'SheetFrame',
  borderTopLeftRadius: '$l',
  borderTopRightRadius: '$l',
  backgroundColor: '$background',
});

const HandleIndicator = styled(YStack, {
  name: 'HandleIndicator',
  backgroundColor: '$border',
  height: 5,
  width: 32,
  borderRadius: 100,
});

const HandleBase = React.forwardRef<TamaguiElement>(function (
  props: StackProps,
  ref,
) {
  return (
    <Stack width={'100%'} alignItems="center" padding="$m" ref={ref} {...props}>
      <HandleIndicator />
    </Stack>
  );
});

HandleBase.displayName = 'HandleBase';

const Handle = styled(HandleBase, {
  name: 'StyledHandle',
});

// Something weird going on with typing here? This works when sheet components
// are styled YStacks, but when they're plain stacks it throws a type error.
export const Sheet = createSheet({
  Frame,
  Handle,
  Overlay,
});

const HeaderFrame = styled(XStack, {});

const HeaderTitleFrame = styled(XStack, {
  padding: '$xs',
  alignItems: 'center',
  justifyContent: 'center',
  flexGrow: 0,
});

const HeaderTitleText = styled(SizableText, {});

const HeaderControls = styled(XStack, {
  flexBasis: 0,
  padding: '$s',
  alignItems: 'center',
  flexGrow: 1,
});

const HeaderLeftControls = styled(HeaderControls, {
  justifyContent: 'flex-start',
});

const HeaderRightControls = styled(HeaderControls, {
  justifyContent: 'flex-end',
});

const HeaderButton = styled(XStack, {
  padding: '$s',
  pressStyle: {backgroundColor: '$secondaryBackground'},
  paddingHorizontal: '$s',
  borderRadius: '$l',
});

const HeaderButtonText = styled(SizableText, {
  color: '$secondaryText',
});

export const SheetHeader = withStaticProperties(HeaderFrame, {
  Title: HeaderTitleFrame,
  TitleText: HeaderTitleText,
  LeftControls: HeaderLeftControls,
  RightControls: HeaderRightControls,
  Button: HeaderButton,
  ButtonText: HeaderButtonText,
});
