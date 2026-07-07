import { Icon, Pressable, Text } from '@tloncorp/ui';
import { View, YStack } from 'tamagui';

import { useIsWindowNarrow } from '../utils';
import { ListItem } from './ListItem';
import { ScreenHeader } from './ScreenHeader';
import { SettingsContentScrollView } from './SettingsContentScrollView';

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
  const isWindowNarrow = useIsWindowNarrow();

  return (
    <View flex={1} backgroundColor="$background">
      <ScreenHeader
        borderBottom
        backAction={isWindowNarrow ? onBackPressed : undefined}
        title="Bot settings"
      />
      <SettingsContentScrollView
        paddingHorizontal="$l"
        paddingTop="$l"
        safeAreaBottomOffset={24}
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
      </SettingsContentScrollView>
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
