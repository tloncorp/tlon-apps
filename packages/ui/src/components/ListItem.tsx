import { utils } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import {
  ComponentProps,
  PropsWithChildren,
  ReactElement,
  useMemo,
} from 'react';
import { ColorProp, styled, withStaticProperties } from 'tamagui';

import { Image, SizableText, Stack, Text, View, XStack, YStack } from '../core';
import { Avatar } from './Avatar';
import { Icon, IconType } from './Icon';

export interface BaseListItemProps<T> {
  model: T;
  StartIcon?: ReactElement | null;
  EndIcon?: ReactElement | null;
  onPress?: (model: T) => void;
  onLongPress?: (model: T) => void;
  highlighted?: boolean;
  unreadCount?: number;
}

export type ListItemProps<T> = BaseListItemProps<T> &
  Omit<ComponentProps<typeof ListItemFrame>, keyof BaseListItemProps<T>>;

export const ListItemFrame = styled(XStack, {
  name: 'ListItemFrame',
  padding: '$l',
  borderRadius: '$xl',
  flexDirection: 'row',
  flexShrink: 1,
  gap: '$l',
  justifyContent: 'space-between',
  alignItems: 'stretch',
  backgroundColor: '$background',
  variants: {
    pressable: {
      true: {
        pressStyle: {
          backgroundColor: '$secondaryBackground',
        },
      },
    },
  } as const,
  defaultVariants: {
    pressable: true,
  },
});

function ListItemIcon({
  imageUrl,
  icon,
  contactId,
  contact,
  backgroundColor,
  fallbackText,
}: {
  imageUrl?: string;
  icon?: IconType;
  contactId?: string | null;
  contact?: db.Contact | null;
  backgroundColor?: ColorProp;
  /**
   * Text to display when there's no image set. Should be a single character.
   */
  fallbackText?: string;
}) {
  if (imageUrl) {
    return (
      <ListItemImageIcon
        imageUrl={imageUrl}
        backgroundColor={backgroundColor}
      />
    );
  } else if (icon) {
    return <ListItemTypeIcon icon={icon} backgroundColor={backgroundColor} />;
  } else if (contactId) {
    return (
      <ListItemAvatarIcon
        contactId={contactId}
        contact={contact ?? undefined}
        backgroundColor={backgroundColor}
      />
    );
  } else {
    return (
      <ListItemTextIcon
        backgroundColor={backgroundColor}
        fallbackText={fallbackText ?? ''}
      />
    );
  }
}

const ListItemImageIcon = ({
  imageUrl,
  backgroundColor,
}: {
  imageUrl: string;
  backgroundColor?: ColorProp;
}) => {
  return (
    <ListItemIconContainer backgroundColor={backgroundColor}>
      <Image
        width={'100%'}
        height={'100%'}
        source={{
          uri: imageUrl,
        }}
      />
    </ListItemIconContainer>
  );
};

const ListItemTextIcon = ({
  fallbackText,
  backgroundColor,
}: {
  fallbackText: string;
  backgroundColor?: ColorProp;
}) => {
  return (
    <ListItemIconContainer backgroundColor={backgroundColor}>
      <View flex={1} alignItems="center" justifyContent="center">
        <Text fontSize={16} color="$primaryText">
          {fallbackText.slice(0, 1).toUpperCase()}
        </Text>
      </View>
    </ListItemIconContainer>
  );
};

const ListItemAvatarIcon = ({
  contactId,
  contact,
  backgroundColor,
}: {
  contactId: string;
  contact?: db.Contact | null;
  backgroundColor?: ColorProp;
}) => {
  return (
    <ListItemIconContainer backgroundColor={backgroundColor}>
      <Avatar
        width="$4xl"
        height="$4xl"
        contactId={contactId}
        contact={contact}
      />
    </ListItemIconContainer>
  );
};

const ListItemTypeIcon = ({
  icon,
  backgroundColor,
}: {
  icon?: IconType;
  backgroundColor?: ColorProp;
}) => {
  return (
    <ListItemIconContainer backgroundColor={backgroundColor ?? 'transparent'}>
      <Icon type={icon || 'Channel'} width="$4xl" height="$4xl" />
    </ListItemIconContainer>
  );
};

const ListItemIconContainer = ({
  backgroundColor,
  children,
}: PropsWithChildren<{
  backgroundColor: ColorProp;
}>) => {
  return (
    <View
      width="$4xl"
      height="$4xl"
      borderRadius="$s"
      overflow="hidden"
      flex={0}
      // @ts-expect-error
      backgroundColor={backgroundColor ?? '$secondaryBackground'}
    >
      {children}
    </View>
  );
};

const ListItemMainContent = styled(YStack, {
  flex: 1,
  justifyContent: 'space-evenly',
  height: '$4xl',
});

const ListItemTitle = styled(SizableText, {
  alignItems: 'baseline',
  color: '$primaryText',
  numberOfLines: 1,

  // TODO: is there an easy way to do something like this?
  // $native: {
  //   numberOfLines: 1,
  // },

  // $web: {
  //   whiteSpace: "nowrap",
  //   overflow: "hidden",
  //   textOverflow: "ellipsis",
  // },
});

function ListItemTitleAttribute({ children }: PropsWithChildren) {
  return (
    <Stack
      paddingHorizontal="$s"
      backgroundColor="$positiveBackground"
      borderRadius="$xl"
      paddingTop={2}
      paddingBottom={1}
      borderWidth={1}
      borderColor="$positiveBorder"
    >
      <SizableText fontSize="$s" lineHeight={0} color="$secondaryText">
        {children}
      </SizableText>
    </Stack>
  );
}

const ListItemSubtitle = styled(SizableText, {
  numberOfLines: 1,
  size: '$s',
  color: '$secondaryText',
});

const ListItemTimeText = styled(SizableText, {
  numberOfLines: 1,
  color: '$secondaryText',
  size: '$s',
  // Tiny tweak to try to align with the baseline of the title
  position: 'relative',
  top: 1,
});

const ListItemTime = ListItemTimeText.styleable<{
  time?: Date | number | null;
}>(({ time, ...props }, ref) => {
  const formattedTime = useMemo(() => {
    if (!time) {
      return null;
    }
    const date = new Date(time);
    const meta = utils.makePrettyDayAndDateAndTime(date);
    if (meta.diff > 7) {
      return utils.makeShortDate(new Date(time));
    } else if (meta.diff > 0) {
      return meta.day;
    } else {
      return meta.time;
    }
  }, [time]);
  return <ListItemTimeText {...props}>{formattedTime ?? ''}</ListItemTimeText>;
});

const ListItemCount = ({ children }: PropsWithChildren) => {
  return (
    <Stack
      padding="$2xs"
      paddingHorizontal={'$m'}
      backgroundColor="$secondaryBackground"
      borderRadius="$l"
      // Tiny tweak to try to align with the baseline of the title
      position="relative"
      top={-2}
    >
      <SizableText
        size="$s"
        lineHeight={0}
        color="$secondaryText"
        textAlign="center"
      >
        {children}
      </SizableText>
    </Stack>
  );
};

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

const Dragger = () => {
  return (
    <YStack alignItems="center" justifyContent="center">
      <Icon type="Dragger" width="$2xl" height="$2xl" />
    </YStack>
  );
};

const ListItemEndContent = styled(YStack, {
  flex: 0,
  gap: '$s',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
});

export type ListItem = typeof ListItemComponent;

export const ListItem = withStaticProperties(ListItemComponent, {
  Icon: ListItemIcon,
  ImageIcon: ListItemImageIcon,
  AvatarIcon: ListItemAvatarIcon,
  SystemIcon: ListItemTypeIcon,
  TextIcon: ListItemTextIcon,
  Dragger,
  Count: ListItemCount,
  MainContent: ListItemMainContent,
  Title: ListItemTitle,
  TitleAttribute: ListItemTitleAttribute,
  Subtitle: ListItemSubtitle,
  EndContent: ListItemEndContent,
  Time: ListItemTime,
});
