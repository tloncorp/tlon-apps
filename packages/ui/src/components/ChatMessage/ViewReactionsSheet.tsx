import * as db from '@tloncorp/shared/dist/db';
import { useMemo } from 'react';

import { ActionSheet } from '../ActionSheet';
import { ViewReactionsPane } from './ViewReactionsPane';

export function ViewReactionsSheet({
  post,
  open,
  onOpenChange,
}: {
  post: db.Post;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const reactionCount = useMemo(
    () => post.reactions?.length ?? 0,
    [post.reactions]
  );

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPointsMode="percent"
      snapPoints={[60]}
    >
      <ActionSheet.SimpleHeader
        title="Reactions"
        // subtitle={`${reactionCount} people reacted`}
      />
      <ActionSheet.ContentBlock>
        <ViewReactionsPane post={post} />
      </ActionSheet.ContentBlock>
    </ActionSheet>
  );
}
