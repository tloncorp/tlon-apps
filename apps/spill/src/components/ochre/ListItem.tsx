import React, {ComponentProps, PropsWithChildren, ReactElement} from 'react';
import {styled, withStaticProperties} from 'tamagui';
import {useFormattedTime} from '@utils/format';
import {Image} from './core/Image';
import {SizableText, Stack, XStack, YStack} from './core/tamagui';

interface BaseListItemProps<T> {
  model: T;
  StartIcon?: ReactElement | null;
  EndIcon?: ReactElement | null;
  onPress?: (model: T) => void;
  onLongPress?: (model: T) => void;
  highlighted?: boolean;
}

export type ListItemProps<T> = BaseListItemProps<T> &
  Omit<ComponentProps<typeof ListItemFrame>, keyof BaseListItemProps<T>>;

export const ListItemFrame = styled(XStack, {
  name: 'ListItemFrame',
  padding: '$m',
  borderRadius: '$m',
  flexDirection: 'row',
  gap: '$m',
  justifyContent: 'space-between',
  variants: {
    pressable: {
      true: {
        pressStyle: {
          backgroundColor: '$secondaryBackground',
        },
      },
    },
    highlighted: {
      true: {
        backgroundColor: '$anchorHighlight',
      },
    },
  } as const,
  defaultVariants: {
    pressable: true,
  },
});

function ListItemImage({
  imageUrl,
  backgroundColor,
  ...props
}: PropsWithChildren<{
  imageUrl?: string;
  backgroundColor?: string;
}>) {
  return imageUrl ? (
    <Image
      width={48}
      height={48}
      borderRadius="$s"
      //@ts-ignore This is an arbitrary, user-set color
      backgroundColor={backgroundColor ?? '$secondaryBackground'}
      {...props}
      source={{
        uri: imageUrl,
      }}
    />
  ) : (
    <Stack width={48} height={48} />
  );
}

const ListItemMainContent = styled(YStack, {
  flex: 1,
  justifyContent: 'center',
});

const ListItemTitle = styled(SizableText, {
  numberOfLines: 1,
});

const ListItemSubtitle = styled(SizableText, {
  numberOfLines: 1,
  color: '$tertiaryText',
});

const ListItemTimeText = styled(SizableText, {
  numberOfLines: 1,
  color: '$tertiaryText',
});

const ListItemTime = ListItemTimeText.styleable<{time?: number | null}>(
  ({time, ...props}, ref) => {
    const timeString = useFormattedTime(time);
    if (!time) {
      return null;
    }
    return (
      <ListItemTimeText {...props} ref={ref}>
        {timeString}
      </ListItemTimeText>
    );
  },
);

const ListItemComponent = ({
  StartIcon,
  EndIcon,
  children,
  ...props
}: {
  StartIcon?: ReactElement | null;
  EndIcon?: ReactElement | null;
  highlighted?: boolean;
} & ComponentProps<typeof ListItemFrame>) => {
  return (
    <ListItemFrame {...props}>
      {StartIcon ?? null}
      {children}
      {EndIcon ?? null}
    </ListItemFrame>
  );
};

export type ListItem = typeof ListItemComponent;

export const ListItem = withStaticProperties(ListItemComponent, {
  Image: ListItemImage,
  MainContent: ListItemMainContent,
  Title: ListItemTitle,
  Subtitle: ListItemSubtitle,
  Time: ListItemTime,
});
