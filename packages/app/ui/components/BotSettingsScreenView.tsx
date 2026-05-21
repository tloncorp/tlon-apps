import { useState } from 'react';
import { ConfirmDialog, Icon, LoadingSpinner, Text } from '@tloncorp/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, XStack, YStack } from 'tamagui';

import { useIsWindowNarrow } from '../utils';
import { ListItem } from './ListItem';
import { McpProviderLogo } from './McpProviderLogo';
import { ScreenHeader } from './ScreenHeader';

export type BotSettingsProviderStatus =
  | 'connected'
  | 'expired'
  | 'not-connected';

export interface BotSettingsProviderRow {
  displayName: string;
  id: string;
  status: BotSettingsProviderStatus;
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
  const activeProviders = providers.filter(
    (provider) => provider.status === 'connected'
  );
  const availableProviders = providers.filter(
    (provider) => provider.status !== 'connected'
  );

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
          <YStack gap="$l">
            {activeProviders.length > 0 ? (
              <ProviderSection
                disabled={!available || !!startingProviderId}
                loadingProviderId={startingProviderId}
                onConnect={onConnectProvider}
                providers={activeProviders}
                title="Connected"
              />
            ) : null}
            {availableProviders.length > 0 ? (
              <ProviderSection
                disabled={!available || !!startingProviderId}
                loadingProviderId={startingProviderId}
                onConnect={onConnectProvider}
                providers={availableProviders}
                title="Available"
              />
            ) : null}
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

function ProviderSection({
  disabled,
  loadingProviderId,
  onConnect,
  providers,
  title,
}: {
  disabled: boolean;
  loadingProviderId: string | null;
  onConnect: (providerId: string) => void;
  providers: BotSettingsProviderRow[];
  title: string;
}) {
  return (
    <YStack gap="$xs">
      <Text color="$tertiaryText" size="$label/s">
        {title}
      </Text>
      <YStack gap="$xs">
        {providers.map((provider) => (
          <ProviderListItem
            key={provider.id}
            disabled={disabled}
            loading={loadingProviderId === provider.id}
            onConnect={onConnect}
            provider={provider}
          />
        ))}
      </YStack>
    </YStack>
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
  const isConnected = provider.status === 'connected';
  const canConnect = !disabled && !isConnected;
  const canShowDisconnectDialog = !disabled && isConnected;
  const isPressable = canConnect || canShowDisconnectDialog;
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  return (
    <>
      <ListItem
        alignItems="center"
        backgroundColor="$transparent"
        borderRadius="$l"
        gap="$l"
        onPress={
          canConnect
            ? () => onConnect(provider.id)
            : canShowDisconnectDialog
              ? () => setShowDisconnectDialog(true)
              : undefined
        }
        padding="$l"
        pressStyle={
          isPressable ? { backgroundColor: '$secondaryBackground' } : undefined
        }
      >
        <McpProviderLogo
          displayName={provider.displayName}
          providerId={provider.id}
        />
        <ListItem.MainContent height="auto" minHeight="$4xl">
          <XStack alignItems="center" gap="$s" flex={1}>
            <ListItem.Title>{provider.displayName}</ListItem.Title>
          </XStack>
        </ListItem.MainContent>
        {loading ? (
          <LoadingSpinner color="$tertiaryText" size="small" />
        ) : isConnected ? (
          <XStack
            backgroundColor="$positiveBackground"
            borderRadius="$l"
            paddingHorizontal="$m"
            paddingVertical="$xs"
          >
            <Text color="$positiveActionText" size="$label/m">
              Active
            </Text>
          </XStack>
        ) : (
          <Icon type="ChevronRight" color="$tertiaryText" size="$m" />
        )}
      </ListItem>
      {isConnected ? (
        <ConfirmDialog
          cancelText="Cancel"
          confirmText="Disconnect"
          description="Disconnect support is not available yet."
          destructive
          onConfirm={() => undefined}
          onOpenChange={setShowDisconnectDialog}
          open={showDisconnectDialog}
          title={`Disconnect ${provider.displayName}?`}
        />
      ) : null}
    </>
  );
}
