import * as db from '@db';
import {
  Avatar,
  Image,
  ListItem,
  ListItemProps,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@ochre';
import React, {ComponentProps, useMemo} from 'react';
import {useFormattedTime} from '../utils/format';
import {useBoundHandler} from '../utils/useBoundHandler';
import BasePostContent from './PostContent';
import Toggleable from './Toggleable';

type ListItemComponentProps<T> = Omit<
  ComponentProps<typeof ListItem>,
  'onPress' | 'onLongPress'
> &
  ListItemProps<T>;

export const ChannelListItemComponent = ({
  model,
  onPress,
  onLongPress,
  ...props
}: ListItemComponentProps<db.Channel>) => {
  const handlePress = useBoundHandler(model, onPress);
  const handleLongPress = useBoundHandler(model, onLongPress);
  return (
    <ListItem onPress={handlePress} onLongPress={handleLongPress} {...props}>
      <ListItem.Image
        backgroundColor={model.group?.iconImageColor ?? '$secondaryBackground'}
        imageUrl={model.image ?? model.group?.iconImage}
      />
      <ListItem.MainContent>
        <ListItem.Title numberOfLines={1}>{model.title}</ListItem.Title>
        <ListItem.Subtitle>{model.latestPost?.text}</ListItem.Subtitle>
      </ListItem.MainContent>
      <ListItem.Time time={model.latestPost?.receivedAt} />
    </ListItem>
  );
};

export const ChannelListItem = React.memo(
  ChannelListItemComponent,
  (prevProps, nextProps) => {
    return prevProps.model.id === nextProps.model.id;
  },
);

export const GroupListItemComponent = ({
  model,
  onPress,
  onLongPress,
  ...props
}: ListItemComponentProps<db.Group>) => {
  const handlePress = useBoundHandler(model, onPress);
  const handleLongPress = useBoundHandler(model, onLongPress);
  return (
    <ListItem {...props} onPress={handlePress} onLongPress={handleLongPress}>
      <ListItem.Image
        backgroundColor={model.iconImageColor}
        imageUrl={model.iconImage}
      />
      <ListItem.MainContent>
        <ListItem.Title>{model.title}</ListItem.Title>
        <ListItem.Subtitle>{model.latestPost?.text}</ListItem.Subtitle>
      </ListItem.MainContent>
      <ListItem.Time time={model.latestPost?.receivedAt} />
    </ListItem>
  );
};

export const GroupListItem = React.memo(
  GroupListItemComponent,
  (prevProps, nextProps) => {
    return prevProps.model.id === nextProps.model.id;
  },
);

export function PostListItemComponent({
  model,
  onPress,
  onLongPress,
  showHeader = true,
  isHighlighted,
  ...props
}: ListItemComponentProps<db.Post> & {
  showHeader?: boolean;
  isHighlighted?: boolean;
}) {
  const contextLabel = useMemo(() => {
    return [
      model.group?.title ?? model.group?.id,
      model.channel?.title ?? model.channel?.id,
    ]
      .filter(i => !!i)
      .join(' / ');
  }, [model.channel, model.group]);
  const handlePress = useBoundHandler(model, onPress);
  const handleLongPress = useBoundHandler(model, onLongPress);
  // Tamagui considers an element to be pressable if onPress keys are set at
  // all, even if functions are undefined, so we make sure to only pass the
  // handlers if they are defined.
  const handlers = useMemo(() => {
    const result: Record<string, () => void> = {};
    if (handlePress) {
      result.onPress = handlePress;
    }
    if (handleLongPress) {
      result.onLongPress = handleLongPress;
    }
    return result;
  }, [handlePress, handleLongPress]);
  return (
    <ListItem
      backgroundColor={model.type === 'diary' ? '$yellow' : 'transparent'}
      flexDirection="column"
      {...handlers}
      highlighted={isHighlighted ?? false}
      {...props}>
      {showHeader && model.author && contextLabel && (
        <PostHeader
          author={model.author}
          contextLabel={contextLabel}
          time={model.receivedAt}
          replyCount={model.replyCount}
        />
      )}
      <PostContent
        content={model.content}
        title={model.metadata?.title}
        image={model.metadata?.image}
      />
    </ListItem>
  );
}

PostListItemComponent.displayName = 'PostListItemComponent';

function PostContent({
  content,
  title,
  image,
}: {
  content?: string;
  title?: string;
  image?: string;
}) {
  const parsedContent = useMemo(() => {
    return content ? JSON.parse(content) : null;
  }, [content]);

  return (
    <Toggleable target="showContent">
      {content !== null && (
        <XStack gap="$xs" flex={1}>
          <Stack width="$m" />
          <YStack flex={1}>
            {title ? <SizableText>{title}</SizableText> : null}
            {image && image !== '' && <Image source={{uri: image}} />}
            <BasePostContent story={parsedContent} />
          </YStack>
        </XStack>
      )}
    </Toggleable>
  );
}

export const PostListItem = React.memo(
  PostListItemComponent,
  (prevProps, nextProps) => {
    return prevProps.model.id === nextProps.model.id;
  },
);

PostListItem.displayName = 'PostListItem';

const PostHeader = React.memo(
  ({
    author,
    contextLabel,
    time,
    replyCount,
  }: {
    author: string;
    contextLabel: string;
    time?: number;
    replyCount?: number;
  }) => {
    return (
      <XStack justifyContent="flex-start" alignItems="center" gap="$xs">
        <Toggleable target="showAuthor">
          <PostAuthor author={author} />
        </Toggleable>
        <Toggleable target="showTime">
          <PostTime time={time} />
        </Toggleable>
        <Toggleable target="showChannel">
          <SizableText
            size="$s"
            flexShrink={1}
            textOverflow="ellipsis"
            numberOfLines={1}>
            {contextLabel}
          </SizableText>
        </Toggleable>
        {replyCount ? (
          <Toggleable target="showReplyCount">
            <SizableText size="$s" flexShrink={0} lineHeight="$s">
              {replyCount} {replyCount > 1 ? 'replies' : 'reply'}
            </SizableText>
          </Toggleable>
        ) : null}
      </XStack>
    );
  },
);

PostHeader.displayName = 'PostHeader';

function PostTime({time}: {time?: number}) {
  const formattedTime = useFormattedTime(time);
  return (
    <SizableText color="$tertiaryText" size="$s">
      {formattedTime}
    </SizableText>
  );
}

function PostAuthor({author}: {author: string}) {
  return (
    <XStack gap="$xs" alignItems="center" flexShrink={1}>
      {author && <Avatar id={author} size={'$m'} />}
      <SizableText numberOfLines={1} flexShrink={1}>
        {author}
      </SizableText>
    </XStack>
  );
}

PostAuthor.displayName = 'PostAuthor';
