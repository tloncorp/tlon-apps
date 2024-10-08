import { ComponentProps, useRef } from 'react';
import {
  SizableText,
  Stack,
  Sheet as TamaguiSheet,
  XStack,
  YStack,
  createSheet,
  styled,
  useSheet,
  withStaticProperties,
} from 'tamagui';

const Overlay = styled(YStack, {
  name: 'SheetOverlay',
  enterStyle: { opacity: 0 },
  exitStyle: { opacity: 0 },
  backgroundColor: '$shadow',
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
  borderTopLeftRadius: '$3.5xl',
  borderTopRightRadius: '$3.5xl',
  backgroundColor: '$background',
  zIndex: '$modalSheet',
});

const HandleIndicator = styled(YStack, {
  name: 'HandleIndicator',
  backgroundColor: '$border',
  height: 4,
  width: '$3xl',
  borderRadius: 100,
});

const HandleFrame = Stack.styleable((props, ref) => {
  return (
    <Stack
      width={'100%'}
      alignItems="center"
      paddingVertical="$l"
      ref={ref}
      {...props}
    >
      <HandleIndicator />
    </Stack>
  );
});

HandleFrame.displayName = 'HandleFrame';

const Handle = styled(HandleFrame, {
  name: 'Handle',
});

// Something weird going on with typing here? This works when sheet components
// are styled YStacks, but when they're plain stacks it throws a type error.
const baseSheet = createSheet({
  Frame,
  Handle,
  Overlay,
});

/**
 * Identical to `Frame` except it only renders its children *after* the sheet is opened for the first time.
 */
function LazyFrame({
  children,
  ...props
}: ComponentProps<typeof baseSheet.Frame>) {
  const sheet = useSheet();
  const hasOpened = useHasOpened(sheet.open);
  return (
    <baseSheet.Frame {...props}>{hasOpened ? children : null}</baseSheet.Frame>
  );
}

export const Sheet = withStaticProperties(baseSheet, {
  LazyFrame,
});

function useHasOpened(isOpen: boolean) {
  const hasOpenedRef = useRef(isOpen);
  if (isOpen) {
    hasOpenedRef.current = true;
  }
  return hasOpenedRef.current;
}

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
  pressStyle: { backgroundColor: '$secondaryBackground' },
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
  ScrollView: TamaguiSheet.ScrollView,
});
