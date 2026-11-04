import type {
  VaultField,
  VaultLogin,
  VaultLoginDetail,
} from '@tloncorp/api/client/browserVaultManagement';
import { ConfirmDialog } from '@tloncorp/ui';
import { useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { ActionSheet } from '../../../ui/components/ActionSheet';
import {
  SettingsListScreenView,
  SettingsList,
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
          'Your Tlonbot will use your vault logins when using the shared browser. Your approval is required each time it uses one.',
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
  const { height } = useWindowDimensions();
  const title = vaultSite(login);
  const sections = useMemo<SettingsSectionModel[]>(
    () => [
      ...(loading || error
        ? [
            {
              key: 'status',
              rows: error
                ? [
                    { key: 'error', title: error },
                    {
                      key: 'retry',
                      title: 'Try again',
                      action: true,
                      onPress: onRetry,
                    },
                  ]
                : [{ key: 'loading', title: 'Loading login…' }],
            },
          ]
        : (detail?.fields ?? []).map((field) => ({
            key: field.name,
            title: vaultFieldLabel(field),
            rows: [{ key: field.name, title: vaultFieldValue(field) }],
          }))),
      {
        key: 'remove',
        footer: removeError,
        rows: [
          {
            key: 'remove',
            title: removing ? 'Removing…' : 'Remove login',
            destructive: true,
            action: true,
            disabled: removing || loading || !!error,
            onPress: () => setConfirm(true),
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
        snapPoints={[75]}
        snapPointsMode="percent"
        enableContentPanningGesture={false}
        dialogScrollEnabled={false}
        dialogContentProps={{
          height: height * 0.75,
          maxWidth: SETTINGS_LIST_COLUMN_WIDTH,
        }}
        closeButton
        title="Secure Vault"
      >
        <ActionSheet.SimpleHeader title={title} subtitle="Secure Vault" />
        <SettingsList
          surface="sheet"
          sections={sections}
          maxWidth={SETTINGS_LIST_COLUMN_WIDTH}
        />
      </ActionSheet>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Remove this login?"
        description={`This bot will no longer have this saved login for ${title}. This won’t sign out existing browser sessions.`}
        confirmText="Remove login"
        destructive
        onConfirm={onRemove}
      />
    </>
  );
}
