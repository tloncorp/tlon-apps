import * as db from '@tloncorp/shared/db';
import { Text } from '@tloncorp/ui';
import { ComponentProps } from 'react';

import {
  BlockReferenceContent,
  ChatReferenceContent,
  NoteReferenceContent,
} from './ContentReference';
import { WidgetPane } from './WidgetPane';

export function PinnedPostDisplay({
  post,
  ...rest
}: { post: db.Post } & ComponentProps<typeof WidgetPane>) {
  return (
    <WidgetPane backgroundColor="$orangeSoft" {...rest}>
      <WidgetPane.Title>Pinned Post</WidgetPane.Title>
      {post ? (
        <>
          {post?.type === 'block' ? (
            <BlockReferenceContent post={post} />
          ) : post?.type === 'note' ? (
            <NoteReferenceContent post={post} hideAuthor />
          ) : post ? (
            <ChatReferenceContent post={post} hideAuthor />
          ) : null}
        </>
      ) : (
        <Text>Post Not Found</Text>
      )}
    </WidgetPane>
  );
}
