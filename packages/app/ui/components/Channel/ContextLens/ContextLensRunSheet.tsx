import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useEffect, useMemo, useState } from 'react';
import { SizableText, YStack } from 'tamagui';

import { ActionSheet } from '../../ActionSheet';
import { ContactAvatar } from '../../Avatar';
import { ContactName } from '../../ContactNameV2';
import { ListItem } from '../../ListItem';
import { RunSummary } from './RunSummary';
import { getContextLensStamp } from './lensPost';
import { lensFromRunPayload } from './types';

export function ContextLensRunSheet({
  post,
  open,
  onOpenChange,
  onExpand,
}: {
  post: db.Post;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExpand?: (params: { botShip: string; lensId: string }) => void;
}) {
  const stamp = useMemo(() => getContextLensStamp(post), [post]);
  const botShip = stamp?.botShip ?? null;
  const lensId = stamp?.lensId ?? null;

  const [resolving, setResolving] = useState(false);
  useEffect(() => {
    if (!open || !botShip || !lensId) {
      return;
    }
    let cancelled = false;
    setResolving(true);
    store
      .ensureContextLensRun({ botShip, lensId })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) {
          setResolving(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, botShip, lensId]);

  const runQuery = store.useContextLensRun({
    botShip: botShip ?? '',
    lensId: lensId ?? '',
  });
  const lens = useMemo(
    () => (runQuery.data ? lensFromRunPayload(runQuery.data.payload) : null),
    [runQuery.data]
  );
  const loading = runQuery.isLoading || (resolving && !lens);

  return (
    <ActionSheet open={open} onOpenChange={onOpenChange} modal>
      <ActionSheet.Header>
        {botShip ? <ContactAvatar contactId={botShip} /> : null}
        <ActionSheet.ActionContent>
          <ListItem.Title>Bot run</ListItem.Title>
          {botShip ? (
            <ListItem.Subtitle>
              <ContactName contactId={botShip} />
            </ListItem.Subtitle>
          ) : null}
        </ActionSheet.ActionContent>
      </ActionSheet.Header>
      <ActionSheet.Content>
        <ActionSheet.ContentBlock paddingTop={0} paddingBottom={0}>
          {lens ? (
            <RunSummary lens={lens} />
          ) : (
            <YStack
              gap="$s"
              padding="$l"
              minHeight={120}
              alignItems="center"
              justifyContent="center"
            >
              <SizableText size="$l" color="$secondaryText">
                {loading ? 'Loading bot run…' : 'Bot run unavailable'}
              </SizableText>
              {!loading ? (
                <SizableText size="$s" color="$tertiaryText" textAlign="center">
                  This run may have expired from the bot ship’s retention
                  window.
                </SizableText>
              ) : null}
            </YStack>
          )}
        </ActionSheet.ContentBlock>
        {lens && botShip && lensId && onExpand ? (
          <ActionSheet.ActionGroup accent="neutral">
            <ActionSheet.Action
              action={{
                title: 'Expand',
                description: 'View the full run inspector',
                endIcon: 'ChevronRight',
                action: () => {
                  onOpenChange(false);
                  onExpand({ botShip, lensId });
                },
              }}
            />
          </ActionSheet.ActionGroup>
        ) : null}
      </ActionSheet.Content>
    </ActionSheet>
  );
}
