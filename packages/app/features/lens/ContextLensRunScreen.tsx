import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useA2UINavigation } from '../../hooks/useA2UINavigation';
import type { RootStackParamList } from '../../navigation/types';
import { ScreenHeader, ScrollView, SizableText, YStack } from '../../ui';
import {
  type LensMessageTarget,
  RunInspector,
} from '../../ui/components/Channel/ContextLens/RunInspector';
import { RunSummary } from '../../ui/components/Channel/ContextLens/RunSummary';
import { lensFromRunPayload } from '../../ui/components/Channel/ContextLens/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ContextLensRun'>;

export function ContextLensRunScreen(props: Props) {
  const { botShip, lensId } = props.route.params;

  const [resolving, setResolving] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setResolving(true);
    // db-first; scries the owner ship's %context-lens agent on a local miss
    // and caches the result, which re-renders the query below
    store.ensureContextLensRun({ botShip, lensId }).finally(() => {
      if (!cancelled) {
        setResolving(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [botShip, lensId]);

  const runQuery = store.useContextLensRun({ botShip, lensId });
  const lens = useMemo(
    () => (runQuery.data ? lensFromRunPayload(runQuery.data.payload) : null),
    [runQuery.data]
  );
  const loading = runQuery.isLoading || (resolving && !lens);

  const navigateFromA2UI = useA2UINavigation();
  const handlePressMessage = useCallback(
    (target: LensMessageTarget) => {
      // Lens conversation ids are recorded from the bot's perspective: group
      // channels are nests (contain '/'), but DMs name the counterparty ship
      // — which on the owner's client is themselves. DM messages live in the
      // client's DM channel with the bot, whose id is the bot ship.
      const channelId = target.channelId?.includes('/')
        ? target.channelId
        : botShip;
      if (!channelId) {
        return;
      }
      navigateFromA2UI({
        type: 'message',
        channelId,
        postId: target.postId,
        authorId: target.authorId,
      });
    },
    [navigateFromA2UI, botShip]
  );

  return (
    <YStack flex={1} backgroundColor="$background">
      <ScreenHeader
        title="Bot run"
        backAction={props.navigation.goBack}
        borderBottom
      />
      {lens ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <YStack gap="$m" padding="$l" paddingBottom="$2xl">
            <RunSummary lens={lens} />
            <RunInspector lens={lens} onPressMessage={handlePressMessage} />
          </YStack>
        </ScrollView>
      ) : (
        <YStack
          alignItems="center"
          justifyContent="center"
          minHeight={180}
          gap="$m"
          margin="$l"
          borderWidth={1}
          borderColor="$border"
          borderRadius="$m"
          backgroundColor="$secondaryBackground"
          padding="$m"
        >
          <SizableText size="$m" color="$secondaryText" textAlign="center">
            {loading
              ? 'Looking for Lens metadata'
              : 'No Lens metadata for this run'}
          </SizableText>
          {!loading ? (
            <SizableText size="$s" color="$tertiaryText" textAlign="center">
              Run records sync from your ship and are retained for about 30
              days. This run is no longer available.
            </SizableText>
          ) : null}
        </YStack>
      )}
    </YStack>
  );
}
