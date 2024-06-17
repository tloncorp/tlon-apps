import { utils } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import {
  ComponentProps,
  PropsWithChildren,
  ReactElement,
  useMemo,
} from 'react';
import { ColorProp, SizeTokens, styled, withStaticProperties } from 'tamagui';

import { Image, SizableText, Stack, Text, View, XStack, YStack } from '../core';
import { Avatar, AvatarSize } from './Avatar';
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
  rounded,
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
  rounded?: boolean;
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
    return (
      <ListItemTypeIcon
        icon={icon}
        backgroundColor={backgroundColor}
        rounded={rounded}
      />
    );
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
        contentFit="cover"
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
  rounded,
}: {
  fallbackText: string;
  backgroundColor?: ColorProp;
  rounded?: boolean;
}) => {
  return (
    <ListItemIconContainer backgroundColor={backgroundColor} rounded={rounded}>
      <View flex={1} alignItems="center" justifyContent="center">
        <Text fontSize={16} color="$primaryText">
          {fallbackText.slice(0, 1).toUpperCase()}
        </Text>
      </View>
    </ListItemIconContainer>
  );
};

const ListItemAvatarIcon = ({
  backgroundColor,
  contact,
  contactId,
  rounded = false,
  size = '$4xl',
  ...props
}: {
  backgroundColor?: ColorProp;
  contact?: db.Contact | null;
  contactId: string;
  rounded?: boolean;
  size?: AvatarSize;
} & ComponentProps<typeof ListItemIconContainer>) => {
  return (
    <ListItemIconContainer {...props} backgroundColor={backgroundColor}>
      <Avatar
        rounded={rounded}
        size={size}
        contactId={contactId}
        contact={contact}
      />
    </ListItemIconContainer>
  );
};

const ListItemTypeIcon = ({
  icon,
  backgroundColor,
  rounded,
}: {
  icon?: IconType;
  backgroundColor?: ColorProp;
  rounded?: boolean;
}) => {
  return (
    <ListItemIconContainer
      backgroundColor={backgroundColor ?? 'transparent'}
      rounded={rounded}
    >
      <Icon type={icon || 'Channel'} width="$4xl" height="$4xl" />
    </ListItemIconContainer>
  );
};

const ListItemIconContainer = ({
  backgroundColor = '$secondaryBackground',
  rounded,
  width = '$4xl',
  height = '$4xl',
  children,
}: PropsWithChildren<{
  backgroundColor?: ColorProp;
  width?: SizeTokens;
  height?: SizeTokens;
  rounded?: boolean;
}>) => {
  return (
    <View
      width={width}
      height={height}
      borderRadius={rounded ? '$2xl' : '$s'}
      overflow="hidden"
      flex={0}
      // @ts-expect-error user-supplied color
      backgroundColor={backgroundColor}
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
  lineHeight: '$xs',
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
  return (
    <ListItemTimeText {...props} ref={ref}>
      {formattedTime ?? ''}
    </ListItemTimeText>
  );
});

const ListItemCount = ({ children, ...rest }: React.PropsWithChildren<any>) => {
  return (
    <Stack
      paddingHorizontal={'$m'}
      borderRadius="$l"
      backgroundColor="$secondaryBackground"
      {...rest}
    >
      <SizableText size="$s" color="$secondaryText" textAlign="center">
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
  paddingTop: '$xs',
  gap: '$2xs',
  justifyContent: 'center',
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
