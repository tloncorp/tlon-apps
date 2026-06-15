import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { lensRunMatchesChannel } from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { Pressable } from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';

import type { RootStackParamList } from '../../navigation/types';
import {
  ScreenHeader,
  ScrollView,
  SizableText,
  View,
  XStack,
  YStack,
} from '../../ui';
import {
  TONE_COLORS,
  formatWallTime,
  runMeta,
  runPreview,
  statusLabel,
  statusTone,
} from '../../ui/components/Channel/ContextLens/format';
import {
  type ContextLens,
  lensFromRunPayload,
} from '../../ui/components/Channel/ContextLens/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ContextLensRuns'>;

type RunRow = { botShip: string; lens: ContextLens };

export function ContextLensRunsScreen(props: Props) {
  const channelId = props.route.params?.channelId;
  const recentRunsQuery = store.useRecentContextLensRuns();

  const rows: RunRow[] = useMemo(
    () =>
      (recentRunsQuery.data ?? []).flatMap((row) => {
        if (channelId && !lensRunMatchesChannel(row, channelId)) {
          return [];
        }
        const lens = lensFromRunPayload(row.payload);
        return lens ? [{ botShip: row.botShip, lens }] : [];
      }),
    [recentRunsQuery.data, channelId]
  );

  const openRun = useCallback(
    (row: RunRow) => {
      props.navigation.push('ContextLensRun', {
        botShip: row.botShip,
        lensId: row.lens.lensId,
        channelId,
      });
    },
    [props.navigation, channelId]
  );

  return (
    <YStack flex={1} backgroundColor="$background">
      <ScreenHeader
        title={channelId ? 'Bot runs in this channel' : 'Bot runs'}
        backAction={props.navigation.goBack}
        borderBottom
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <YStack gap="$xs" padding="$l" paddingBottom="$2xl">
          {rows.map((row) => {
            const tone = TONE_COLORS[statusTone(row.lens.status)];
            return (
              <Pressable
                key={`${row.botShip}/${row.lens.lensId}`}
                onPress={() => openRun(row)}
                cursor="pointer"
                gap="$2xs"
                minWidth={0}
                borderWidth={1}
                borderColor="$border"
                borderLeftWidth={2}
                borderLeftColor={tone}
                borderRadius="$s"
                paddingHorizontal="$s"
                paddingVertical="$xs"
                backgroundColor="$background"
              >
                <XStack
                  alignItems="center"
                  justifyContent="space-between"
                  gap="$s"
                >
                  <XStack alignItems="center" gap="$xs" flex={1} minWidth={0}>
                    <View
                      width={7}
                      height={7}
                      borderRadius={999}
                      backgroundColor={tone}
                    />
                    <SizableText
                      size="$s"
                      color="$primaryText"
                      flex={1}
                      minWidth={0}
                      numberOfLines={1}
                    >
                      {statusLabel(row.lens.status)}
                    </SizableText>
                  </XStack>
                  <SizableText size="$s" color="$tertiaryText" flexShrink={0}>
                    {formatWallTime(row.lens.updatedAt)}
                  </SizableText>
                </XStack>
                <SizableText size="$s" color="$secondaryText" numberOfLines={2}>
                  {runPreview(row.lens)}
                </SizableText>
                <SizableText size="$s" color="$tertiaryText">
                  {runMeta(row.lens)}
                </SizableText>
              </Pressable>
            );
          })}
          {!rows.length ? (
            <YStack
              alignItems="center"
              justifyContent="center"
              minHeight={180}
              gap="$m"
              borderWidth={1}
              borderColor="$border"
              borderRadius="$m"
              backgroundColor="$secondaryBackground"
              padding="$m"
            >
              <SizableText size="$m" color="$secondaryText" textAlign="center">
                {recentRunsQuery.isLoading
                  ? 'Loading bot runs'
                  : 'No bot runs yet'}
              </SizableText>
              <SizableText size="$s" color="$tertiaryText" textAlign="center">
                Run records sync from your ship and are retained for about 30
                days.
              </SizableText>
            </YStack>
          ) : null}
        </YStack>
      </ScrollView>
    </YStack>
  );
}
