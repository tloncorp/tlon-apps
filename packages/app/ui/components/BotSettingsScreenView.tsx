import { Button, LoadingSpinner, Text } from '@tloncorp/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, XStack, YStack } from 'tamagui';

import { useIsWindowNarrow } from '../utils';
import { ListItem } from './ListItem';
import { ScreenHeader } from './ScreenHeader';

export type BotSettingsProviderStatus =
  | 'connected'
  | 'expired'
  | 'not-connected';

export interface BotSettingsProviderRow {
  displayName: string;
  grantSummary: string;
  id: string;
  scopesSummary: string;
  status: BotSettingsProviderStatus;
  upstreamSummary: string;
}

export interface BotSettingsCompletionNotice {
  message: string;
  tone: 'success' | 'error';
}

interface BotSettingsScreenViewProps {
  available: boolean;
  completionNotice: BotSettingsCompletionNotice | null;
  error: string | null;
  initialLoading: boolean;
  onBackPressed: () => void;
  onConnectProvider: (providerId: string) => void;
  onRefresh: () => void;
  providers: BotSettingsProviderRow[];
  refreshing: boolean;
  startingProviderId: string | null;
}

export function BotSettingsScreenView({
  available,
  completionNotice,
  error,
  initialLoading,
  onBackPressed,
  onConnectProvider,
  onRefresh,
  providers,
  refreshing,
  startingProviderId,
}: BotSettingsScreenViewProps) {
  const insets = useSafeAreaInsets();
  const isWindowNarrow = useIsWindowNarrow();

  return (
    <View flex={1} backgroundColor="$background">
      <ScreenHeader
        borderBottom
        backAction={isWindowNarrow ? onBackPressed : undefined}
        loadingSubtitle={refreshing && !initialLoading ? 'Refreshing' : null}
        rightControls={
          <ScreenHeader.IconButton type="Refresh" onPress={onRefresh} />
        }
        title="Bot settings"
      />
      {initialLoading ? (
        <YStack flex={1} alignItems="center" justifyContent="center">
          <LoadingSpinner />
        </YStack>
      ) : (
        <ScrollView
          style={{
            flex: 1,
            width: '100%',
            maxWidth: 680,
            marginHorizontal: 'auto',
          }}
          contentContainerStyle={{
            gap: '$m',
            paddingTop: '$l',
            paddingHorizontal: '$l',
            paddingBottom: insets.bottom + 24,
          }}
        >
          {completionNotice ? (
            <NoticeBanner
              message={completionNotice.message}
              tone={completionNotice.tone}
            />
          ) : null}
          {error ? <NoticeBanner message={error} tone="error" /> : null}
          {!available && !error ? (
            <NoticeBanner
              message="OAuth setup is unavailable for this ship."
              tone="error"
            />
          ) : null}
          <YStack gap="$xs">
            {providers.map((provider) => (
              <ProviderListItem
                key={provider.id}
                disabled={!available || !!startingProviderId}
                loading={startingProviderId === provider.id}
                onConnect={onConnectProvider}
                provider={provider}
              />
            ))}
          </YStack>
        </ScrollView>
      )}
    </View>
  );
}

function NoticeBanner({
  message,
  tone,
}: {
  message: string;
  tone: 'success' | 'error';
}) {
  return (
    <View
      backgroundColor={
        tone === 'success' ? '$positiveBackground' : '$negativeBackground'
      }
      borderColor={tone === 'success' ? '$positiveBorder' : '$negativeBorder'}
      borderRadius="$l"
      borderWidth={1}
      padding="$l"
    >
      <Text
        color={
          tone === 'success' ? '$positiveActionText' : '$negativeActionText'
        }
        size="$label/m"
      >
        {message}
      </Text>
    </View>
  );
}

function ProviderListItem({
  disabled,
  loading,
  onConnect,
  provider,
}: {
  disabled: boolean;
  loading: boolean;
  onConnect: (providerId: string) => void;
  provider: BotSettingsProviderRow;
}) {
  const actionLabel =
    provider.status === 'not-connected' ? 'Connect' : 'Reconnect';
  const actionIcon =
    provider.status === 'not-connected' ? 'Link' : ('Refresh' as const);

  return (
    <ListItem
      alignItems="center"
      backgroundColor="$secondaryBackground"
      borderRadius="$l"
      gap="$m"
      padding="$m"
    >
      <ProviderInitial name={provider.displayName} />
      <ListItem.MainContent height="auto" minHeight="$5xl">
        <XStack alignItems="center" gap="$s">
          <ListItem.Title flex={1}>{provider.displayName}</ListItem.Title>
          <StatusPill status={provider.status} />
        </XStack>
        <ListItem.Subtitle numberOfLines={2}>
          {provider.upstreamSummary}
        </ListItem.Subtitle>
        <ListItem.Subtitle numberOfLines={2}>
          {provider.grantSummary || provider.scopesSummary}
        </ListItem.Subtitle>
      </ListItem.MainContent>
      <Button
        disabled={disabled}
        leadingIcon={actionIcon}
        loading={loading}
        onPress={() => onConnect(provider.id)}
        preset={provider.status === 'expired' ? 'primary' : 'secondary'}
        size="small"
        label={actionLabel}
      />
    </ListItem>
  );
}

function ProviderInitial({ name }: { name: string }) {
  return (
    <View
      alignItems="center"
      backgroundColor="$background"
      borderColor="$border"
      borderRadius="$s"
      borderWidth={1}
      height="$4xl"
      justifyContent="center"
      width="$4xl"
    >
      <Text color="$secondaryText" size="$label/l">
        {name.slice(0, 1)}
      </Text>
    </View>
  );
}

function StatusPill({ status }: { status: BotSettingsProviderStatus }) {
  const copy =
    status === 'connected'
      ? 'Connected'
      : status === 'expired'
        ? 'Expired'
        : 'Not connected';
  const backgroundColor =
    status === 'connected'
      ? '$positiveBackground'
      : status === 'expired'
        ? '$systemNoticeBackground'
        : '$background';
  const color =
    status === 'connected'
      ? '$positiveActionText'
      : status === 'expired'
        ? '$systemNoticeText'
        : '$tertiaryText';

  return (
    <XStack
      backgroundColor={backgroundColor}
      borderRadius="$l"
      paddingHorizontal="$m"
      paddingVertical="$xs"
    >
      <Text color={color} size="$label/s">
        {copy}
      </Text>
    </XStack>
  );
}
