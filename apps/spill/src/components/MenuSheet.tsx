import {Sheet, SizableText} from '@ochre';
import React from 'react';
import {SheetProps, YStack, createStyledContext, styled} from 'tamagui';

export type MenuSheetSettings = {
  title?: string;
  subtitle?: string;
  buttonGroups?: {
    external?: boolean;
    destructive?: boolean;
    items: MenuSheetButtonSettings[];
  }[];
};

export type MenuSheetButtonSettings = {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  onLongPress?: () => void;
};

export function MenuSheet({
  menu,
  ...props
}: SheetProps & {menu: MenuSheetSettings}) {
  return (
    <Sheet {...props}>
      <Sheet.Overlay />
      <Sheet.Frame>
        <Sheet.Handle />
        <Header>
          {menu.title && <HeaderTitle>{menu.title}</HeaderTitle>}
          {menu.subtitle && <HeaderSubtitle>{menu.subtitle}</HeaderSubtitle>}
        </Header>
        {menu.buttonGroups && (
          <YStack padding={'$l'} gap="$l">
            {menu.buttonGroups?.map(group => {
              return (
                <ButtonGroup
                  external={group.external}
                  destructive={group.destructive}>
                  {withSeparator(
                    <Separator />,
                    group.items.map((item, index) => {
                      return (
                        <Button
                          key={index}
                          onPress={item.onPress}
                          onLongPress={item.onLongPress}>
                          <ButtonTitle>{item.title}</ButtonTitle>
                          {item.subtitle && (
                            <ButtonSubtitle>{item.subtitle}</ButtonSubtitle>
                          )}
                        </Button>
                      );
                    }),
                  )}
                </ButtonGroup>
              );
            })}
          </YStack>
        )}
      </Sheet.Frame>
    </Sheet>
  );
}

//TODO: Not sure how performant this is.
const withSeparator = <T extends any[]>(
  separator: React.ReactElement,
  elements: T,
) => {
  const result: React.ReactNode[] = [];
  elements.forEach((element, index) => {
    result.push(element);
    if (index < elements.length - 1) {
      result.push(React.cloneElement(separator, {key: `s-${index}`}));
    }
  });
  return result;
};

const Header = styled(YStack, {
  paddingHorizontal: '$l',
});

const HeaderTitle = styled(SizableText, {});

const HeaderSubtitle = styled(SizableText, {
  color: '$tertiaryText',
});

const ButtonContext = createStyledContext({
  external: false,
  destructive: false,
});

const Separator = styled(YStack, {
  context: ButtonContext,
  borderBottomWidth: 1,
  borderBottomColor: '$border',
});

const ButtonGroup = styled(YStack, {
  context: ButtonContext,
  borderColor: '$border',
  borderWidth: 1,
  borderRadius: '$l',
  overflow: 'hidden',
  variants: {
    external: {
      true: {
        borderColor: '$externalActionBorder',
      },
    },
    destructive: {
      true: {
        borderColor: '$destructiveActionBorder',
      },
    },
  } as const,
});

const Button = styled(YStack, {
  context: ButtonContext,
  justifyContent: 'center',
  paddingHorizontal: '$l',
  paddingVertical: '$m',
  borderColor: '$border',
  minHeight: '$xl',
  pressStyle: {
    backgroundColor: '$secondaryBackground',
  },
  variants: {
    external: {
      true: {
        pressStyle: {
          backgroundColor: '$externalActionBorder',
        },
      },
    },
    destructive: {
      true: {
        pressStyle: {
          backgroundColor: '$destructiveActionBorder',
        },
      },
    },
  } as const,
});

const ButtonTitle = styled(SizableText, {
  context: ButtonContext,
  variants: {
    external: {
      true: {
        color: '$externalAction',
      },
    },
    destructive: {
      true: {
        color: '$destructiveAction',
      },
    },
  },
});

const ButtonSubtitle = styled(SizableText, {
  size: '$s',
  color: '$tertiaryText',
});
