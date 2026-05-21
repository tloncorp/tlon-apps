import { Icon, Pressable, Text } from '@tloncorp/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, YStack } from 'tamagui';

import { useIsWindowNarrow } from '../utils';
import { ListItem } from './ListItem';
import { ScreenHeader } from './ScreenHeader';

interface BotSettingsHomeScreenViewProps {
  onBackPressed: () => void;
  onConnectMcpPressed: () => void;
  onOtherSettingsPressed: () => void;
}

export function BotSettingsHomeScreenView({
  onBackPressed,
  onConnectMcpPressed,
  onOtherSettingsPressed,
}: BotSettingsHomeScreenViewProps) {
  const insets = useSafeAreaInsets();
  const isWindowNarrow = useIsWindowNarrow();

  return (
    <View flex={1} backgroundColor="$background">
      <ScreenHeader
        borderBottom
        backAction={isWindowNarrow ? onBackPressed : undefined}
        title="Bot settings"
      />
      <ScrollView
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 680,
          marginHorizontal: 'auto',
        }}
        contentContainerStyle={{
          gap: '$xs',
          paddingTop: '$l',
          paddingHorizontal: '$l',
          paddingBottom: insets.bottom + 24,
        }}
      >
        <YStack gap="$xs">
          <BotSettingsNavItem
            icon="Link"
            onPress={onConnectMcpPressed}
            title="Connect MCP"
          />
          <BotSettingsNavItem
            icon="Settings"
            onPress={onOtherSettingsPressed}
            title="External Services"
          />
        </YStack>
      </ScrollView>
    </View>
  );
}

function BotSettingsNavItem({
  icon,
  onPress,
  title,
}: {
  icon: 'Link' | 'Settings';
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable
      borderRadius="$l"
      onPress={onPress}
      pressStyle={{ backgroundColor: '$secondaryBackground' }}
    >
      <ListItem
        alignItems="center"
        backgroundColor="$transparent"
        borderRadius="$l"
        gap="$l"
        padding="$l"
      >
        <ListItem.SystemIcon icon={icon} rounded />
        <ListItem.MainContent height="auto" minHeight="$4xl">
          <Text color="$primaryText" size="$label/l">
            {title}
          </Text>
        </ListItem.MainContent>
        <Icon type="ChevronRight" color="$tertiaryText" size="$m" />
      </ListItem>
    </Pressable>
  );
}
