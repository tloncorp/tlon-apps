import type {
  VaultField,
  VaultLogin,
  VaultLoginDetail,
} from '@tloncorp/api/client/browserVaultManagement';
import { ActionSheetContext, ConfirmDialog, Icon } from '@tloncorp/ui';
import { useContext, useMemo, useState } from 'react';

import {
  ActionSheet,
  type ActionGroup,
} from '../../../ui/components/ActionSheet';
import { ExpoUIActionContent } from '../../../ui/components/ExpoUISheet';
import {
  SettingsListScreenView,
  SETTINGS_LIST_COLUMN_WIDTH,
  type SettingsSectionModel,
} from '../../../ui/components/SettingsList';

export const vaultSite = (login: VaultLogin) => new URL(login.origins[0]).host;
const fieldNames: Record<string, string> = {
  username: 'Username',
  email: 'Email',
  phone: 'Phone number',
  password: 'Password',
};
export const vaultFieldLabel = (field: VaultField) =>
  field.label || fieldNames[field.name] || field.name;
export const vaultFieldValue = (field: VaultLoginDetail['fields'][number]) =>
  !field.hasValue
    ? 'Not stored'
    : field.sensitive || field.type === 'password'
      ? '••••••••'
      : (field.value ?? 'Not stored');

export function SecureVaultView({
  logins = [],
  loading = false,
  error,
  onRefresh,
  onSelect,
  onBack,
  children,
}: {
  logins?: VaultLogin[];
  loading?: boolean;
  error?: string;
  onRefresh: () => void;
  onSelect: (login: VaultLogin) => void;
  onBack: () => void;
  children?: React.ReactNode;
}) {
  const sections = useMemo<SettingsSectionModel[]>(
    () => [
      {
        key: 'logins',
        title: 'Saved logins',
        footer:
          'These logins are shared across your bots. Your approval is required each time a bot uses one.',
        rows: error
          ? [
              { key: 'error', title: error },
              {
                key: 'retry',
                title: 'Try again',
                action: true,
                onPress: onRefresh,
                testID: 'VaultRetry',
              },
            ]
          : logins.length
            ? logins.map((login) => ({
                key: login.key,
                title: vaultSite(login),
                subtitle: login.fields.map(vaultFieldLabel).join(' · '),
                leading: { kind: 'icon' as const, icon: 'Lock' as const },
                onPress: () => onSelect(login),
                testID: `VaultLogin-${login.key}`,
              }))
            : [
                {
                  key: 'empty',
                  title: 'No saved logins',
                  subtitle:
                    'When your bot needs you to sign in, save your login from the Secure Vault card.',
                },
              ],
      },
      ...(!error
        ? [
            {
              key: 'refresh',
              rows: [
                {
                  key: 'refresh',
                  title: 'Refresh',
                  action: true,
                  onPress: onRefresh,
                  testID: 'VaultRefresh',
                },
              ],
            },
          ]
        : []),
    ],
    [error, logins, onRefresh, onSelect]
  );
  return (
    <SettingsListScreenView
      title="Secure Vault"
      headerTestID="SecureVaultScreen"
      showsBackOnWideWindows
      sections={sections}
      loading={loading}
      onBackPressed={onBack}
      maxWidth={SETTINGS_LIST_COLUMN_WIDTH}
    >
      {children}
    </SettingsListScreenView>
  );
}

function LoginSheetContent({
  title,
  groups,
}: {
  title: string;
  groups: ActionGroup[];
}) {
  const { nativePresentation } = useContext(ActionSheetContext);
  const icon = <Icon type="Lock" size="$xl" />;
  if (nativePresentation)
    return (
      <ExpoUIActionContent
        title={title}
        subtitle="Secure Vault"
        icon={icon}
        actionGroups={groups}
      />
    );
  return (
    <>
      <ActionSheet.SimpleHeader
        title={title}
        subtitle="Secure Vault"
        icon={icon}
      />
      <ActionSheet.Content>
        <ActionSheet.SimpleActionGroupList actionGroups={groups} />
      </ActionSheet.Content>
    </>
  );
}

export function VaultLoginSheet({
  login,
  detail,
  loading,
  error,
  removing = false,
  removeError,
  onRetry,
  onClose,
  onRemove,
}: {
  login: VaultLogin;
  detail?: VaultLoginDetail;
  loading: boolean;
  error?: string;
  removing?: boolean;
  removeError?: string;
  onRetry: () => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const title = vaultSite(login);
  const groups = useMemo<ActionGroup[]>(
    () => [
      {
        accent: 'neutral',
        actions: loading
          ? [{ title: 'Loading login…', disabled: true }]
          : error
            ? [{ title: error }, { title: 'Try again', action: onRetry }]
            : (detail?.fields ?? []).map((field) => ({
                title: vaultFieldLabel(field),
                description: vaultFieldValue(field),
              })),
      },
      ...(detail && !error
        ? [
            {
              accent: 'neutral' as const,
              actions: detail.origins.map((site) => ({
                title: 'Site',
                description: site,
              })),
            },
          ]
        : []),
      ...(removeError
        ? [{ accent: 'neutral' as const, actions: [{ title: removeError }] }]
        : []),
      {
        accent: 'negative',
        actions: [
          {
            title: removing ? 'Removing…' : 'Remove login',
            description: 'Removes this login for all your bots.',
            disabled: removing || loading || !!error,
            action: () => setConfirm(true),
            testID: 'VaultRemove',
          },
        ],
      },
    ],
    [loading, error, detail, removeError, removing, onRetry]
  );
  return (
    <>
      <ActionSheet
        open
        onOpenChange={(open: boolean) => {
          if (!open && !removing) onClose();
        }}
        nativeExpoUI
        closeButton
        title="Secure Vault"
      >
        <LoginSheetContent title={title} groups={groups} />
      </ActionSheet>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Remove this login?"
        description={`Your bots will no longer have this saved login for ${title}. This won’t sign out existing browser sessions.`}
        confirmText="Remove login"
        destructive
        onConfirm={onRemove}
      />
    </>
  );
}
