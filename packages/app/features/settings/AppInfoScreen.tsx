import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { preSig } from '@tloncorp/api/lib/urbit';
import { useDebugStore } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as Application from 'expo-application';
import { useEffect, useState } from 'react';
import { useCallback } from 'react';
import { Alert, Platform, ScrollView, Switch } from 'react-native';
import { getEmailClients, openComposer } from 'react-native-email-link';

import { NOTIFY_PROVIDER, NOTIFY_SERVICE } from '../../constants';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import {
  DEV_ACTION_RUN_BACKGROUND_SYNC,
  getDevAction,
} from '../../lib/devActions';
import { RootStackParamList } from '../../navigation/types';
import {
  AppSetting,
  Button,
  ScreenHeader,
  SizableText,
  Text,
  View,
  XStack,
  YStack,
  useIsWindowNarrow,
} from '../../ui';

const BUILD_VERSION = `${Platform.OS === 'ios' ? 'iOS' : 'Android'} ${Application.nativeBuildVersion}`;

type Props = NativeStackScreenProps<RootStackParamList, 'AppInfo'>;

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

  const [bgSyncStatus, setBgSyncStatus] = useState<
    'idle' | 'running' | 'done' | 'error'
  >('idle');
  const runBackgroundSync = __DEV__
    ? getDevAction(DEV_ACTION_RUN_BACKGROUND_SYNC)
    : undefined;
  const onRunBackgroundSync = useCallback(async () => {
    if (!runBackgroundSync || bgSyncStatus === 'running') return;
    setBgSyncStatus('running');
    try {
      await runBackgroundSync();
      setBgSyncStatus('done');
      setTimeout(() => setBgSyncStatus('idle'), 2500);
    } catch (err) {
      console.warn('[bg-sync-debug] trigger failed', err);
      setBgSyncStatus('error');
    }
  }, [runBackgroundSync, bgSyncStatus]);

  const onUploadLogs = useCallback(async () => {
    const id = uploadLogs();

    const { platform, appInfo } = useDebugStore.getState();
    const platformInfo = await platform?.getDebugInfo();

    if (!hasClients) {
      return;
    }

    openComposer({
      to: 'support@tlon.io',
      subject: `${currentUserId} uploaded logs ${id}`,
      body: makeDebugEmail(appInfo, platformInfo, currentUserId),
    });
  }, [uploadLogs, hasClients, currentUserId]);

  const isWindowNarrow = useIsWindowNarrow();

  return (
    <View flex={1} backgroundColor="$background">
      <ScreenHeader
        title="App info"
        borderBottom
        backAction={
          isWindowNarrow ? () => props.navigation.goBack() : undefined
        }
      />
      <ScrollView
        contentContainerStyle={{
          width: '100%',
          maxWidth: 600,
          marginHorizontal: 'auto',
        }}
      >
        <YStack
          marginTop="$xl"
          marginHorizontal="$2xl"
          gap="$s"
          paddingBottom="$3xl"
        >
          <AppSetting title="Build version" value={BUILD_VERSION} copyable />
          <AppSetting
            title="Notify provider"
            value={preSig(NOTIFY_PROVIDER)}
            copyable
          />
          <AppSetting title="Notify service" value={NOTIFY_SERVICE} copyable />
          {appInfo ? (
            <>
              <AppSetting
                title="Desk version"
                value={appInfo.groupsVersion}
                copyable
              />
              <AppSetting
                title="Desk source"
                value={appInfo.groupsSyncNode}
                copyable
              />
              <AppSetting
                title="Desk hash"
                value={appInfo.groupsHash.split('.').pop() ?? 'n/a'}
                copyable
              />
            </>
          ) : (
            <View>
              <SizableText color="$negativeActionText">
                Cannot load app info settings
              </SizableText>
            </View>
          )}
          <AppSetting
            title="Permitted Scheduler ID"
            value={permittedSchedulerId ?? 'Not found'}
            copyable
          />

          <XStack
            key="debug-toggle"
            justifyContent="space-between"
            alignItems="center"
            padding="$l"
          >
            <SizableText flexShrink={1}>Enable Developer Logs</SizableText>
            <Switch
              style={{ flexShrink: 0 }}
              value={enabled}
              onValueChange={toggleDebugFlag}
            ></Switch>
          </XStack>

          {enabled && logs.length > 0 && (
            <View>
              <Button
                preset="outline"
                onPress={onUploadLogs}
                label={`Upload logs (${logs.length})`}
              />
            </View>
          )}
          {enabled && logId && !hasClients && (
            <YStack padding="$l">
              <Text>Please email support@tlon.io with this log ID:</Text>
              <Text>{logId}</Text>
            </YStack>
          )}

          {runBackgroundSync ? (
            <View>
              <Button
                preset="outline"
                onPress={onRunBackgroundSync}
                disabled={bgSyncStatus === 'running'}
                label={
                  bgSyncStatus === 'running'
                    ? 'Running background sync…'
                    : bgSyncStatus === 'done'
                      ? 'Background sync done'
                      : bgSyncStatus === 'error'
                        ? 'Background sync failed'
                        : 'Run background sync'
                }
              />
            </View>
          ) : null}
        </YStack>
      </ScrollView>
    </View>
  );
}
