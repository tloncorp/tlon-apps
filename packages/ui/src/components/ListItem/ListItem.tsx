import { utils } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import { ComponentProps, ReactElement, useMemo } from 'react';
import { styled, withStaticProperties } from 'tamagui';

import { SizableText, Stack, View, XStack, YStack } from '../../core';
import { numberWithMax } from '../../utils';
import {
  ChannelAvatar,
  ContactAvatar,
  GroupAvatar,
  SystemIconAvatar,
} from '../Avatar';
import ContactName from '../ContactName';
import { Icon, IconType } from '../Icon';

export interface BaseListItemProps<T> {
  model: T;
  StartIcon?: ReactElement | null;
  EndIcon?: ReactElement | null;
  EndContent?: ReactElement | null;
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

const ListItemIconContainer = styled(View, {
  backgroundColor: '$secondaryBackground',
  width: '$4xl',
  height: '$4xl',
  borderRadius: '$s',
  overflow: 'hidden',
  flex: 0,
  variants: {
    rounded: {
      true: {
        borderRadius: '$2xl',
      },
    },
  } as const,
});

export type ListItemIconContainerProps = ComponentProps<
  typeof ListItemIconContainer
>;

const ListItemGroupIcon = GroupAvatar;

const ListItemChannelIcon = ChannelAvatar;

const ListItemContactIcon = ContactAvatar;

const ListItemSystemIcon = SystemIconAvatar;

const ListItemMainContent = styled(YStack, {
  flex: 1,
  justifyContent: 'space-evenly',
  height: '$4xl',
});

const ListItemTitle = styled(SizableText, {
  color: '$primaryText',
  numberOfLines: 1,
});

const ListItemSubtitleWithIcon = XStack.styleable<{ icon?: IconType }>(
  (props, ref) => {
    return (
      <XStack gap="$xs" alignItems="center" {...props} ref={ref}>
        {props.icon && (
          <Icon type={props.icon} color={'$tertiaryText'} size="$s" />
        )}
        <ListItemSubtitle>{props.children}</ListItemSubtitle>
      </XStack>
    );
  }
);

const ListItemSubtitleIcon = styled(Icon, {
  color: '$tertiaryText',
  size: '$s',
});

const ListItemSubtitle = styled(SizableText, {
  numberOfLines: 1,
  size: '$s',
  color: '$tertiaryText',
});

export const ListItemTimeText = styled(SizableText, {
  numberOfLines: 1,
  color: '$tertiaryText',
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

const ListItemCount = ({
  muted,
  count,
  ...rest
}: { muted?: boolean; count: number } & ComponentProps<typeof Stack>) => {
  return (
    <Stack
      paddingHorizontal={'$m'}
      backgroundColor={
        count < 1 ? undefined : muted ? undefined : '$secondaryBackground'
      }
      borderRadius="$l"
      {...rest}
    >
      {muted ? (
        <Icon type="Mute" customSize={[18, 18]} color="$tertiaryText" />
      ) : (
        <SizableText
          size="$s"
          textAlign="center"
          color="$secondaryText"
          opacity={muted || count < 1 ? 0 : 1}
        >
          {numberWithMax(count, 99)}
        </SizableText>
      )}
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

export const ListItemPostPreview = ({
  post,
  showAuthor = true,
}: {
  post: db.Post;
  showAuthor?: boolean;
}) => {
  return (
    <ListItemSubtitle>
      {showAuthor ? (
        <>
          <ContactName
            userId={post.authorId}
            showNickname
            color={'$tertiaryText'}
            size={'$s'}
          />
          {': '}
        </>
      ) : null}
      {post.textContent ?? ''}
    </ListItemSubtitle>
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
  GroupIcon: ListItemGroupIcon,
  ChannelIcon: ListItemChannelIcon,
  ContactIcon: ListItemContactIcon,
  SystemIcon: ListItemSystemIcon,
  Dragger,
  Count: ListItemCount,
  MainContent: ListItemMainContent,
  Title: ListItemTitle,
  Subtitle: ListItemSubtitle,
  SubtitleWithIcon: ListItemSubtitleWithIcon,
  SubtitleIcon: ListItemSubtitleIcon,
  PostPreview: ListItemPostPreview,
  EndContent: ListItemEndContent,
  Time: ListItemTime,
});
