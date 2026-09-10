import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useMemo } from 'react';

import { AppDataContextProvider, useCalm } from '../../contexts/appDataContext';
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
