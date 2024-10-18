import * as db from '@tloncorp/shared/dist/db';
import { useMemo, useState } from 'react';

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
  const [isScrolling, setIsScrolling] = useState(false);
  const reactionCount = useMemo(
    () => post.reactions?.length ?? 0,
    [post.reactions]
  );

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPointsMode="percent"
      snapPoints={[70]}
      disableDrag={isScrolling}
    >
      <ActionSheet.SimpleHeader
        title="Reactions"
        subtitle={`${reactionCount} ${reactionCount === 1 ? 'person' : 'people'} reacted`}
      />

      <ViewReactionsPane post={post} setIsScrolling={setIsScrolling} />
    </ActionSheet>
  );
}
