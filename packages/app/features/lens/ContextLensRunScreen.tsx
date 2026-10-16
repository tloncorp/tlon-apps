import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';
import { useEffect, useMemo, useState } from 'react';

import type { RootStackParamList } from '../../navigation/types';
import { useFloatingHeaderHeight } from '../../navigation/useFloatingHeaderHeight';
import {
  ScreenHeader,
  ScreenScrollView,
  SizableText,
  XStack,
  YStack,
} from '../../ui';
import { CopyRawPayloadButton } from '../../ui/components/Channel/ContextLens/CopyRawPayloadButton';
import { RunInspector } from '../../ui/components/Channel/ContextLens/RunInspector';
import { RunSummary } from '../../ui/components/Channel/ContextLens/RunSummary';
import { lensFromRunPayload } from '../../ui/components/Channel/ContextLens/types';
import { useLensMessageNavigation } from './useLensMessageNavigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ContextLensRun'>;

export function ContextLensRunScreen(props: Props) {
  const { botShip, lensId } = props.route.params;

  const [resolving, setResolving] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setResolving(true);
    // db-first; scries the owner ship's %steward agent on a local miss
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
  // The copy row sits above the scroll view, so it clears the floating header
  // itself. Only the lens branch mounts the scroll view that makes the header
  // float; the empty state leaves it opaque, with content already beneath it.
  const headerClearance = useFloatingHeaderHeight(lens != null);

  const handlePressMessage = useLensMessageNavigation(botShip);

  return (
    <YStack flex={1} backgroundColor="$background">
      <ScreenHeader
        title="Bot run"
        backAction={props.navigation.goBack}
        borderBottom
        placement="navigation"
      />
      {/* Outside the `lens` branch on purpose: the stored envelope is worth
          copying precisely when `lensFromRunPayload` rejects it and the
          inspector below cannot render. */}
      {runQuery.data?.payload != null ? (
        <XStack
          justifyContent="flex-end"
          marginTop={headerClearance}
          paddingHorizontal="$l"
          paddingTop="$l"
        >
          <CopyRawPayloadButton payload={runQuery.data.payload} />
        </XStack>
      ) : null}
      {lens ? (
        <ScreenScrollView showsVerticalScrollIndicator={false}>
          <YStack gap="$m" padding="$l" paddingBottom="$2xl">
            <RunSummary
              lens={lens}
              onRetry={() => store.retryLensRun({ botShip, lensId })}
            />
            <RunInspector lens={lens} onPressMessage={handlePressMessage} />
          </YStack>
        </ScreenScrollView>
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
