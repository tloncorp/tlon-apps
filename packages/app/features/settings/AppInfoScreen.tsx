import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDebugStore } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { preSig } from '@urbit/aura';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { useEffect, useMemo, useState } from 'react';
import { useCallback } from 'react';
import { Alert, Platform, ScrollView, Switch } from 'react-native';
import { getEmailClients, openComposer } from 'react-native-email-link';

import { NOTIFY_PROVIDER, NOTIFY_SERVICE } from '../../constants';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { getEasUpdateDisplay } from '../../lib/platformHelpers';
import { RootStackParamList } from '../../navigation/types';
import {
  AppSetting,
  Button,
  ScreenHeader,
  SizableText,
  Stack,
  Text,
  View,
  XStack,
  YStack,
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
  const easUpdateDisplay = useMemo(() => getEasUpdateDisplay(Updates), []);
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
      to: 'support@tlon.io',
      subject: `${currentUserId} uploaded logs ${id}`,
      body: makeDebugEmail(appInfo, platformInfo, currentUserId),
    });
  }, [uploadLogs, hasClients, currentUserId]);

  return (
    <View flex={1} backgroundColor="$background">
      <ScreenHeader
        title="App info"
        backAction={() => props.navigation.goBack()}
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
          <AppSetting title="OTA Update" value={easUpdateDisplay} copyable />
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
            <Stack>
              <Button onPress={onUploadLogs}>
                <Text>Upload logs ({logs.length})</Text>
              </Button>
            </Stack>
          )}
          {enabled && logId && !hasClients && (
            <YStack padding="$l">
              <Text>Please email support@tlon.io with this log ID:</Text>
              <Text>{logId}</Text>
            </YStack>
          )}
        </YStack>
      </ScrollView>
    </View>
  );
}
