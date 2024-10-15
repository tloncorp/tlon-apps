import { NativeStackScreenProps } from '@react-navigation/native-stack';
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
import { useMemo } from 'react';
import { useCallback } from 'react';
import { Platform, Switch } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { NOTIFY_PROVIDER, NOTIFY_SERVICE } from '../../constants';
import { toggleDebug, uploadLogs, useDebugStore } from '../../lib/debug';
import { getEasUpdateDisplay } from '../../lib/platformHelpers';
import { RootStackParamList } from '../../navigation/types';

const BUILD_VERSION = `${Platform.OS === 'ios' ? 'iOS' : 'Android'} ${Application.nativeBuildVersion}`;

type Props = NativeStackScreenProps<RootStackParamList, 'AppInfo'>;

export function AppInfoScreen(props: Props) {
  const { data: appInfo } = store.useAppInfo();
  const { enabled, logs, logsUrl } = useDebugStore();
  const easUpdateDisplay = useMemo(() => getEasUpdateDisplay(Updates), []);

  const onPressPreviewFeatures = useCallback(() => {
    props.navigation.navigate('FeatureFlags');
  }, [props.navigation]);

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
              onValueChange={toggleDebug}
            ></Switch>
          </XStack>

          {enabled && logs.length > 0 && (
            <Stack>
              <Button
                onPress={() => {
                  uploadLogs();
                }}
              >
                <Text>Upload logs ({logs.length})</Text>
              </Button>
              <Text>{logsUrl}</Text>
            </Stack>
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
