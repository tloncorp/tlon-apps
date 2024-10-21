import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDebugStore } from '@tloncorp/shared';
import { getCurrentUserId } from '@tloncorp/shared/dist/api';
import * as store from '@tloncorp/shared/dist/store';
import {
  AppSetting,
  Button,
  ListItem,
  ScreenHeader,
  SizableText,
  Stack,
  Text,
  View,
  XStack,
  YStack,
} from '@tloncorp/ui';
import { preSig } from '@urbit/aura';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { useEffect, useMemo, useState } from 'react';
import { useCallback } from 'react';
import { Alert, Platform, Switch } from 'react-native';
import { getEmailClients, openComposer } from 'react-native-email-link';
import { ScrollView } from 'react-native-gesture-handler';

import { NOTIFY_PROVIDER, NOTIFY_SERVICE } from '../../constants';
import { toggleDebug } from '../../lib/debug';
import { getEasUpdateDisplay } from '../../lib/platformHelpers';
import { RootStackParamList } from '../../navigation/types';

const BUILD_VERSION = `${Platform.OS === 'ios' ? 'iOS' : 'Android'} ${Application.nativeBuildVersion}`;

type Props = NativeStackScreenProps<RootStackParamList, 'AppInfo'>;

function makeDebugEmail(appInfo: any, platformInfo: any) {
  return `
----------------------------------------------
Insert description of problem here.
----------------------------------------------

Tlon ID: ${getCurrentUserId()}

Platform Information:
${JSON.stringify(platformInfo)}

App Information:
${JSON.stringify(appInfo)}
`;
}

export function AppInfoScreen(props: Props) {
  const { data: appInfo } = store.useAppInfo();
  const { enabled, logs, logId, uploadLogs } = useDebugStore();
  const easUpdateDisplay = useMemo(() => getEasUpdateDisplay(Updates), []);
  const [hasClients, setHasClients] = useState(true);

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

  const onPressPreviewFeatures = useCallback(() => {
    props.navigation.navigate('FeatureFlags');
  }, [props.navigation]);

  const toggleDebugFlag = useCallback((enabled: boolean) => {
    toggleDebug(enabled);
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
  }, []);

  const onUploadLogs = useCallback(async () => {
    const id = uploadLogs();

    const { platform, appInfo } = useDebugStore.getState();
    const platformInfo = await platform?.getDebugInfo();

    if (!hasClients) {
      return;
    }

    openComposer({
      to: 'support@tlon.io',
      subject: `${getCurrentUserId()} uploaded logs ${id}`,
      body: makeDebugEmail(appInfo, platformInfo),
    });
  }, [hasClients]);

  return (
    <View flex={1}>
      <ScreenHeader
        title="App info"
        backAction={() => props.navigation.goBack()}
      />
      <ScrollView>
        <YStack marginTop="$xl" marginHorizontal="$2xl" gap="$s">
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

          <Stack marginTop="$xl">
            <ListItem onPress={onPressPreviewFeatures}>
              <ListItem.SystemIcon icon="Bang" rounded />
              <ListItem.MainContent>
                <ListItem.Title>Feature previews</ListItem.Title>
              </ListItem.MainContent>
              <ListItem.SystemIcon
                icon="ChevronRight"
                backgroundColor={'transparent'}
                position="relative"
                left="$m"
              />
            </ListItem>
          </Stack>
        </YStack>
      </ScrollView>
    </View>
  );
}
