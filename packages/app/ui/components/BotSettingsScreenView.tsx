import {
  ConfirmDialog,
  Icon,
  LoadingSpinner,
  Pressable,
  SectionListHeader,
  Text,
  triggerHaptic,
} from '@tloncorp/ui';
import { useState } from 'react';
import { Platform } from 'react-native';
import { View, XStack, YStack } from 'tamagui';

import type { McpProviderRow } from '../../lib/mcpProviders';
import { useIsWindowNarrow } from '../utils';
import { ListItem } from './ListItem';
import { McpProviderLogo } from './McpProviderLogo';
import { ScreenHeader } from './ScreenHeader';
import { SettingsContentScrollView } from './SettingsContentScrollView';

interface BotSettingsScreenViewProps {
  available: boolean;
  busyProviderId: string | null;
  initialLoading: boolean;
  onBackPressed: () => void;
  onConnectProvider: (providerId: string) => void;
  onDisconnectProvider: (providerId: string) => void;
  onRefresh: () => void;
  providers: McpProviderRow[];
  refreshing: boolean;
  showUnavailableNotice: boolean;
}

export function BotSettingsScreenView({
  available,
  busyProviderId,
  initialLoading,
  onBackPressed,
  onConnectProvider,
  onDisconnectProvider,
  onRefresh,
  providers,
  refreshing,
  showUnavailableNotice,
}: BotSettingsScreenViewProps) {
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
        backAction={
          Platform.OS !== 'web' || isWindowNarrow ? onBackPressed : undefined
        }
        loadingSubtitle={refreshing && !initialLoading ? 'Refreshing' : null}
        rightActions={[
          {
            id: 'refresh-providers',
            icon: 'Refresh',
            label: 'Refresh providers',
            onPress: onRefresh,
          },
        ]}
        title="Connect MCP"
        placement="navigation"
      />
      {initialLoading ? (
        <YStack flex={1} alignItems="center" justifyContent="center">
          <LoadingSpinner />
        </YStack>
      ) : (
        <SettingsContentScrollView
          paddingHorizontal="$l"
          paddingTop="$l"
          safeAreaBottomOffset={24}
        >
          <YStack gap="$m">
            {showUnavailableNotice ? (
              <NoticeBanner message="OAuth setup is unavailable for this ship." />
            ) : null}
            <YStack gap="$l">
              {activeProviders.length > 0 ? (
                <ProviderSection
                  disabled={!available || !!busyProviderId}
                  loadingProviderId={busyProviderId}
                  onConnect={onConnectProvider}
                  onDisconnect={onDisconnectProvider}
                  providers={activeProviders}
                  title="Connected"
                />
              ) : null}
              {availableProviders.length > 0 ? (
                <ProviderSection
                  disabled={!available || !!busyProviderId}
                  loadingProviderId={busyProviderId}
                  onConnect={onConnectProvider}
                  onDisconnect={onDisconnectProvider}
                  providers={availableProviders}
                  title="Available"
                />
              ) : null}
            </YStack>
          </YStack>
        </SettingsContentScrollView>
      )}
    </View>
  );
}

function NoticeBanner({ message }: { message: string }) {
  return (
    <View
      backgroundColor="$negativeBackground"
      borderColor="$negativeBorder"
      borderRadius="$l"
      borderWidth={1}
      padding="$l"
    >
      <Text color="$negativeActionText" size="$label/m">
        {message}
      </Text>
    </View>
  );
}

function ProviderSection({
  disabled,
  loadingProviderId,
  onConnect,
  onDisconnect,
  providers,
  title,
}: {
  disabled: boolean;
  loadingProviderId: string | null;
  onConnect: (providerId: string) => void;
  onDisconnect: (providerId: string) => void;
  providers: McpProviderRow[];
  title: string;
}) {
  return (
    <YStack>
      <SectionListHeader>
        <SectionListHeader.Text>{title}</SectionListHeader.Text>
      </SectionListHeader>
      <YStack gap="$xs">
        {providers.map((provider) => (
          <ProviderListItem
            key={provider.id}
            disabled={disabled}
            loading={loadingProviderId === provider.id}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
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
  onDisconnect,
  provider,
}: {
  disabled: boolean;
  loading: boolean;
  onConnect: (providerId: string) => void;
  onDisconnect: (providerId: string) => void;
  provider: McpProviderRow;
}) {
  const isConnected = provider.status === 'connected';
  const canConnect = !disabled && !isConnected;
  const canShowDisconnectDialog = !disabled && isConnected;
  const isPressable = canConnect || canShowDisconnectDialog;
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const handlePress = canConnect
    ? () => {
        triggerHaptic('baseButtonClick');
        onConnect(provider.id);
      }
    : canShowDisconnectDialog
      ? () => {
          triggerHaptic('baseButtonClick');
          setShowDisconnectDialog(true);
        }
      : undefined;

  return (
    <>
      <Pressable
        borderRadius="$l"
        onPress={handlePress}
        pressStyle={
          isPressable ? { backgroundColor: '$secondaryBackground' } : undefined
        }
      >
        <ListItem
          alignItems="center"
          backgroundColor="$transparent"
          borderRadius="$l"
          gap="$l"
          padding="$l"
        >
          <McpProviderLogo
            displayName={provider.displayName}
            logoUrl={provider.logoUrl}
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
      </Pressable>
      {isConnected ? (
        <ConfirmDialog
          cancelText="Cancel"
          confirmText="Disconnect"
          description={`${provider.displayName} will no longer be available to your bot.`}
          destructive
          onConfirm={() => onDisconnect(provider.id)}
          onOpenChange={setShowDisconnectDialog}
          open={showDisconnectDialog}
          title={`Disconnect ${provider.displayName}?`}
        />
      ) : null}
    </>
  );
}
