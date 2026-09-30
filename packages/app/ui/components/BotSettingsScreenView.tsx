import { ConfirmDialog, triggerHaptic } from '@tloncorp/ui';
import { useMemo, useState } from 'react';

import type { McpProviderRow } from '../../lib/mcpProviders';
import { McpProviderLogo } from './McpProviderLogo';
import {
  type SettingsRowModel,
  type SettingsSectionModel,
  SettingsListScreenView,
} from './SettingsList';

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
  // The provider outlives the dialog's open state, so its name stays in the
  // title while the dialog animates closed.
  const [disconnectTarget, setDisconnectTarget] =
    useState<McpProviderRow | null>(null);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);

  const sections = useMemo<SettingsSectionModel[]>(() => {
    const disabled = !available || !!busyProviderId;
    const providerRow = (provider: McpProviderRow): SettingsRowModel => {
      const isConnected = provider.status === 'connected';
      const busy = busyProviderId === provider.id;
      return {
        key: provider.id,
        title: provider.displayName,
        value: busy
          ? isConnected
            ? 'Disconnecting…'
            : 'Connecting…'
          : isConnected
            ? 'Active'
            : undefined,
        leading: {
          kind: 'element',
          render: ({ compact }) => (
            <McpProviderLogo
              compact={compact}
              displayName={provider.displayName}
              logoUrl={provider.logoUrl}
              providerId={provider.id}
            />
          ),
        },
        disabled,
        // Connecting signs in on the provider's site; disconnecting asks first.
        accessory: isConnected ? 'none' : 'external',
        onPress: () => {
          triggerHaptic('baseButtonClick');
          if (isConnected) {
            setDisconnectTarget(provider);
            setDisconnectDialogOpen(true);
          } else {
            onConnectProvider(provider.id);
          }
        },
      };
    };

    const connected = providers.filter((p) => p.status === 'connected');
    const others = providers.filter((p) => p.status !== 'connected');
    const result: SettingsSectionModel[] = [
      ...(connected.length > 0
        ? [
            {
              key: 'connected',
              title: 'Connected',
              rows: connected.map(providerRow),
            },
          ]
        : []),
      ...(others.length > 0
        ? [
            {
              key: 'available',
              title: 'Available',
              rows: others.map(providerRow),
            },
          ]
        : []),
    ];
    if (showUnavailableNotice && result.length > 0) {
      result[0] = {
        ...result[0],
        footer: 'OAuth setup is unavailable for this ship.',
      };
    }
    return result;
  }, [
    available,
    busyProviderId,
    onConnectProvider,
    providers,
    showUnavailableNotice,
  ]);

  return (
    <SettingsListScreenView
      title="Connect MCP"
      sections={sections}
      onBackPressed={onBackPressed}
      loading={initialLoading}
      loadingSubtitle={refreshing && !initialLoading ? 'Refreshing' : null}
      rightActions={[
        {
          id: 'refresh-providers',
          icon: 'Refresh',
          label: 'Refresh providers',
          onPress: onRefresh,
        },
      ]}
    >
      {disconnectTarget ? (
        <ConfirmDialog
          cancelText="Cancel"
          confirmText="Disconnect"
          description={`${disconnectTarget.displayName} will no longer be available to your bot.`}
          destructive
          onConfirm={() => onDisconnectProvider(disconnectTarget.id)}
          onOpenChange={setDisconnectDialogOpen}
          open={disconnectDialogOpen}
          title={`Disconnect ${disconnectTarget.displayName}?`}
        />
      ) : null}
    </SettingsListScreenView>
  );
}
