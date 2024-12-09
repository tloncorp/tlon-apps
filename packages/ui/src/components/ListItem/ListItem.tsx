import { utils } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { ComponentProps, ReactElement, useMemo } from 'react';
import {
  getVariableValue,
  styled,
  useTheme,
  withStaticProperties,
} from 'tamagui';
import { Stack, View, XStack, YStack } from 'tamagui';

import { numberWithMax } from '../../utils';
import {
  ChannelAvatar,
  ContactAvatar,
  GroupAvatar,
  ImageAvatar,
  SystemIconAvatar,
} from '../Avatar';
import ContactName from '../ContactName';
import { Icon, IconType } from '../Icon';
import { Text } from '../TextV2';

export interface BaseListItemProps<T> {
  model: T;
  StartIcon?: ReactElement | null;
  EndIcon?: ReactElement | null;
  EndContent?: ReactElement | null;
  onPress?: (model: T) => void;
  onLongPress?: (model: T) => void;
  unreadCount?: number;
  isFocused?: boolean;
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
  backgroundColor: '$transparent',
});

const ListItemIconContainer = styled(View, {
  name: 'ListItemIconContainer',
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

const ListItemImageIcon = ImageAvatar;

const ListItemMainContent = styled(YStack, {
  name: 'ListItemMainContent',
  flex: 1,
  justifyContent: 'space-around',
  height: '$4xl',
});

const ListItemTitle = styled(Text, {
  name: 'ListItemTitle',
  color: '$primaryText',
  numberOfLines: 1,
  size: '$label/l',
  paddingBottom: 1,
  variants: {
    dimmed: {
      true: {
        color: '$tertiaryText',
      },
    },
  },
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
  },
  {
    staticConfig: {
      componentName: 'ListItemSubtitleWithIcon',
    },
  }
);

const ListItemSubtitleIcon = styled(Icon, {
  name: 'ListItemSubtitleIcon',
  color: '$tertiaryText',
  size: '$s',
});

const ListItemSubtitle = styled(Text, {
  name: 'ListItemSubtitle',
  numberOfLines: 1,
  size: '$label/m',
  color: '$tertiaryText',
});

export const ListItemTimeText = styled(Text, {
  name: 'ListItemTimeText',
  numberOfLines: 1,
  color: '$tertiaryText',
  size: '$label/m',
  paddingBottom: '$xs',
});

const ListItemTime = ListItemTimeText.styleable<{
  time?: Date | number | null;
}>(
  ({ time, ...props }, ref) => {
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
  },
  {
    staticConfig: {
      componentName: 'ListItemTime',
    },
  }
);

const ListItemCount = ({
  muted,
  count,
  ...rest
}: { muted?: boolean; count: number } & ComponentProps<typeof Stack>) => {
  const foregroundColor = getVariableValue(useTheme().secondaryText);
  const backgroundColor = getVariableValue(useTheme().secondaryBackground);
  return (
    <Stack
      paddingHorizontal={'$m'}
      backgroundColor={count < 1 ? undefined : backgroundColor}
      borderRadius="$l"
      {...rest}
    >
      <ListItemCountNumber hidden={count < 1}>
        {muted && (
          <Icon type="Muted" customSize={[12, 12]} color={foregroundColor} />
        )}
        <Text size="$label/m" color={foregroundColor}>
          {numberWithMax(count, 99)}
        </Text>
      </ListItemCountNumber>
    </Stack>
  );
};

const ListItemCountNumber = styled(XStack, {
  name: 'ListItemCountNumber',
  gap: '$s',
  alignItems: 'center',
  paddingVertical: '$s',
  variants: {
    hidden: {
      true: {
        opacity: 0,
      },
    },
  },
});

ListItemCount.displayName = 'ListItemCount';

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
      {post.hidden ? '(This post has been hidden)' : post.textContent ?? ''}
    </ListItemSubtitle>
  );
};

ListItemPostPreview.displayName = 'ListItemPostPreview';

const Dragger = () => {
  return (
    <YStack alignItems="center" justifyContent="center">
      <Icon type="Dragger" width="$2xl" height="$2xl" />
    </YStack>
  );
};

Dragger.displayName = 'Dragger';

const ListItemEndContent = styled(YStack, {
  name: 'ListItemEndContent',
  paddingTop: '$xs',
  gap: '$2xs',
  justifyContent: 'center',
  alignItems: 'flex-end',
});

export type ListItem = typeof ListItemFrame;

export const ListItem = withStaticProperties(ListItemFrame, {
  GroupIcon: ListItemGroupIcon,
  ChannelIcon: ListItemChannelIcon,
  ContactIcon: ListItemContactIcon,
  SystemIcon: ListItemSystemIcon,
  ImageIcon: ListItemImageIcon,
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
