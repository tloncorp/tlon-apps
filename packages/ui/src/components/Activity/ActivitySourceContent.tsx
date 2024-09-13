import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import { useMemo } from 'react';
import { ScrollView, styled } from 'tamagui';

import { useContactName } from '../ContactNameV2';
import { PostReference } from '../ContentReference';
import { GalleryPost } from '../GalleryPost';
import { Icon } from '../Icon';
import { createContentRenderer } from '../PostContent';
import {
  BlockData,
  InlineData,
  prependInline,
  usePostContent,
} from '../PostContent/contentUtils';
import { Text } from '../TextV2';

type ActivitySourceContentProps = {
  summary: logic.SourceActivityEvents;
  pressHandler?: () => void;
};

export function ActivitySourceContent({
  summary,
  pressHandler,
}: ActivitySourceContentProps) {
  const isReply = !!summary.newest.parentId;
  const isChatPost =
    summary.newest.channel?.type !== 'gallery' &&
    summary.newest.channel?.type !== 'notebook';
  return isReply || isChatPost ? (
    <ChatContentRenderer summary={summary} pressHandler={pressHandler} />
  ) : (
    <NotebookOrGalleryContentRenderer
      summary={summary}
      pressHandler={pressHandler}
    />
  );
}

function ChatContentRenderer({ summary }: ActivitySourceContentProps) {
  const post = useMemo(() => getPost(summary.newest), [summary.newest]);
  const postAuthorName = useContactName(post.authorId);
  const content = usePostContent(post);
  // We want to display the author name inline if possible, so we inject it into
  // the content.
  const enrichedContent: BlockData[] = useMemo(() => {
    const authorNameInline: InlineData = {
      type: 'text',
      text: postAuthorName + ': ',
    };
    return prependInline(content, authorNameInline);
  }, [content, postAuthorName]);
  return (
    <>
      <ActivityContentRenderer content={enrichedContent} />
      {summary.all.length > 1 ? (
        <Text size="$label/m" color="$tertiaryText" trimmed={false}>
          +{summary.all.length - 1} more
        </Text>
      ) : null}
    </>
  );
}

function NotebookOrGalleryContentRenderer({
  summary,
  pressHandler,
}: ActivitySourceContentProps) {
  const posts = useUniqueSummaryPosts(summary);
  const isNote = summary.newest.channel?.type === 'notebook';

  return (
    <ScrollView
      marginVertical="$m"
      horizontal
      height={128}
      contentContainerStyle={{ gap: '$m' }}
      alwaysBounceHorizontal={false}
      showsHorizontalScrollIndicator={false}
    >
      {posts.map((post) =>
        isNote ? (
          <PostReference
            key={post.id}
            channelId={post.channelId}
            post={post}
            contentSize="$s"
            aspectRatio={1.5}
            onPress={pressHandler}
          />
        ) : (
          <GalleryPost key={post.id} post={post} onPress={pressHandler} />
        )
      )}
    </ScrollView>
  );
}

function useUniqueSummaryPosts(summary: logic.SourceActivityEvents) {
  return useMemo(() => {
    const seen = new Set();
    return summary.all?.flatMap((event) => {
      if (event.postId && !seen.has(event.postId)) {
        seen.add(event.postId);
        return [getPost(event)];
      }
      return [];
    });
  }, [summary.all]);
}

const ActivityContentRenderer = createContentRenderer({
  blockSettings: {
    blockWrapper: {
      padding: 0,
    },
    lineText: {
      size: '$label/m',
      trimmed: false,
    },
    image: {
      flex: 1,
      alignSelf: 'flex-start',
      marginVertical: '$xs',
      borderRadius: '$xs',
      imageProps: {
        width: '$4xl',
        height: '$4xl',
        aspectRatio: 'unset',
      },
    },
    bigEmoji: {
      marginVertical: '$s',
    },
  },
  blockRenderers: {
    reference: () => {
      return <PlaceholderIcon type="ArrowRef" />;
    },
    code: () => {
      return <PlaceholderIcon type="CodeBlock" />;
    },
    video: () => {
      return <PlaceholderIcon type="Play" />;
    },
  },
});

const PlaceholderIcon = styled(Icon, {
  backgroundColor: '$secondaryBackground',
  borderRadius: '$xs',
  customSize: [24, 12],
  marginVertical: '$xs',
});

function getPost(event: db.ActivityEvent): db.Post {
  let post: db.Post;
  if (event.post) {
    post = event.post;
  } else {
    // %activity gives us partials so...square peg, round hole
    post = db.assemblePostFromActivityEvent(event);
  }

  return post;
}
