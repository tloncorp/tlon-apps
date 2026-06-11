import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';
import { useEffect, useMemo, useState } from 'react';

import type { RootStackParamList } from '../../navigation/types';
import { ScreenHeader, ScrollView, SizableText, YStack } from '../../ui';
import { RunInspector } from '../../ui/components/Channel/ContextLens/RunInspector';
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
            <RunInspector lens={lens} />
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
