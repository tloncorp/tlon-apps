import { utils } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import { ComponentProps, ReactElement, useMemo } from 'react';
import { styled, withStaticProperties } from 'tamagui';
import { SizableText, Stack, View, XStack, YStack } from 'tamagui';

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
  onPress?: (model: T) => void;
  onLongPress?: (model: T) => void;
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

const ListItemMainContent = styled(YStack, {
  name: 'ListItemMainContent',
  flex: 1,
  justifyContent: 'space-evenly',
  height: '$4xl',
});

const ListItemTitle = styled(SizableText, {
  name: 'ListItemTitle',
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

const ListItemSubtitle = styled(SizableText, {
  name: 'ListItemSubtitle',
  numberOfLines: 1,
  size: '$s',
  color: '$tertiaryText',
});

export const ListItemTimeText = styled(SizableText, {
  name: 'ListItemTimeText',
  numberOfLines: 1,
  color: '$tertiaryText',
  size: '$s',
  lineHeight: '$xs',
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
        <ListItemCountNumber hidden={!!(muted || count < 1)}>
          {numberWithMax(count, 99)}
        </ListItemCountNumber>
      )}
    </Stack>
  );
};

const ListItemCountNumber = styled(SizableText, {
  name: 'ListItemCountNumber',
  size: '$s',
  color: '$secondaryText',
  textAlign: 'center',
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
      {post.textContent ?? ''}
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
  flex: 0,
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
