import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { preSig } from '@tloncorp/api/lib/urbit';
import { useDebugStore } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useMemo, useState } from 'react';
import { useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { getEmailClients, openComposer } from 'react-native-email-link';

import {
  NOTIFY_PROVIDER,
  NOTIFY_SERVICE,
  SUPPORT_EMAIL,
} from '../../constants';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { downloadDb } from '../../lib/downloadDb';
import { RootStackParamList } from '../../navigation/types';
import { triggerHaptic } from '../../ui';
import {
  type SettingsRowModel,
  type SettingsSectionModel,
  SettingsListScreenView,
} from '../../ui/components/SettingsList';

const BUILD_VERSION = `${Platform.OS === 'ios' ? 'iOS' : 'Android'} ${Application.nativeBuildVersion}`;

type Props = NativeStackScreenProps<RootStackParamList, 'AppInfo'>;

/** A value you can copy with a tap, or from the long-press menu. */
function copyableRow(
  key: string,
  title: string,
  value: string
): SettingsRowModel {
  const copy = async () => {
    await Clipboard.setStringAsync(value);
    triggerHaptic('success');
  };
  return {
    key,
    title,
    value,
    accessory: 'none',
    onPress: copy,
    contextActions: [{ key: 'copy', title: 'Copy', onPress: copy }],
  };
}

function makeDebugEmail(
  appInfo: any,
  platformInfo: any,
  currentUserId: string
) {
  return `
----------------------------------------------
Insert description of problem here.
----------------------------------------------

Tlon ID: ${currentUserId}

Platform Information:
${JSON.stringify(platformInfo)}

App Information:
${JSON.stringify(appInfo)}
`;
}

export function AppInfoScreen(props: Props) {
  const appInfo = db.appInfo.useValue();
  const permittedSchedulerId = db.debugPermittedSchedulerId.useValue();
  const {
    enabled,
    logs,
    logId,
    uploadLogs,
    toggle: setDebugEnabled,
  } = useDebugStore();
  const [hasClients, setHasClients] = useState(true);
  const currentUserId = useCurrentUserId();

  useEffect(() => {
    async function checkClients() {
      try {
        const clients = await getEmailClients();
        setHasClients(clients.length > 0);
      } catch (e) {
        setHasClients(false);
      }
    }

    checkClients();
  }, []);

  const toggleDebugFlag = useCallback(
    (enabled: boolean) => {
      setDebugEnabled(enabled);
      if (!enabled) {
        return;
      }

      Alert.alert(
        'Debug mode enabled',
        'Debug mode is now enabled. You may experience some degraded performance, because logs will be captured as you use the app. To get the best capture, you should kill the app and open it again.',
        [
          {
            text: 'OK',
          },
        ]
      );
    },
    [setDebugEnabled]
  );

  const onUploadLogs = useCallback(async () => {
    const id = uploadLogs();

    const { platform, appInfo } = useDebugStore.getState();
    const platformInfo = await platform?.getDebugInfo();

    if (!hasClients) {
      return;
    }

    openComposer({
      to: SUPPORT_EMAIL,
      subject: `${currentUserId} uploaded logs ${id}`,
      body: makeDebugEmail(appInfo, platformInfo, currentUserId),
    });
  }, [uploadLogs, hasClients, currentUserId]);

  const sections = useMemo<SettingsSectionModel[]>(() => {
    const infoRows = [
      copyableRow('build-version', 'Build version', BUILD_VERSION),
      copyableRow(
        'notify-provider',
        'Notify provider',
        preSig(NOTIFY_PROVIDER)
      ),
      copyableRow('notify-service', 'Notify service', NOTIFY_SERVICE),
      ...(appInfo
        ? [
            copyableRow('desk-version', 'Desk version', appInfo.groupsVersion),
            copyableRow('desk-source', 'Desk source', appInfo.groupsSyncNode),
            copyableRow(
              'desk-hash',
              'Desk hash',
              appInfo.groupsHash.split('.').pop() ?? 'n/a'
            ),
          ]
        : []),
      copyableRow(
        'scheduler-id',
        'Permitted Scheduler ID',
        permittedSchedulerId ?? 'Not found'
      ),
    ];

    const logRows: SettingsRowModel[] = [
      {
        key: 'developer-logs',
        title: 'Enable Developer Logs',
        toggle: { value: enabled, onValueChange: toggleDebugFlag },
      },
      ...(enabled && logs.length > 0
        ? [
            {
              key: 'upload-logs',
              title: `Upload logs (${logs.length})`,
              action: true,
              onPress: onUploadLogs,
            },
          ]
        : []),
    ];

    return [
      {
        key: 'info',
        footer: appInfo ? undefined : 'Cannot load app info settings',
        rows: infoRows,
      },
      {
        key: 'logs',
        footer:
          enabled && logId && !hasClients
            ? `Please email ${SUPPORT_EMAIL} with this log ID: ${logId}`
            : undefined,
        rows: logRows,
      },
      ...(Platform.OS !== 'web'
        ? [
            {
              key: 'database',
              rows: [
                {
                  key: 'export-db',
                  title: 'Export DB',
                  action: true,
                  onPress: downloadDb,
                },
              ],
            },
          ]
        : []),
    ];
  }, [
    appInfo,
    enabled,
    hasClients,
    logId,
    logs.length,
    onUploadLogs,
    permittedSchedulerId,
    toggleDebugFlag,
  ]);

  return (
    <SettingsListScreenView
      title="App info"
      sections={sections}
      onBackPressed={() => props.navigation.goBack()}
    />
  );
}
