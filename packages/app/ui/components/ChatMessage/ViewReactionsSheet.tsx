import * as db from '@tloncorp/shared/db';
import { useMemo } from 'react';

import { AppDataContextProvider, useCalm, useStore } from '../../contexts';
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
  const store = useStore();
  const { data: contacts } = store.useContacts();
  const calmSettings = useCalm();

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
      hasScrollableContent
      modal
    >
      {/* Since the modaled sheet gets pulled above the contacts provider, we inject a manual one here */}
      <AppDataContextProvider contacts={contacts} calmSettings={calmSettings}>
        <ActionSheet.SimpleHeader
          title="Reactions"
          subtitle={`${reactionCount} ${reactionCount === 1 ? 'person' : 'people'} reacted`}
        />

        <ViewReactionsPane post={post} />
      </AppDataContextProvider>
    </ActionSheet>
  );
}
