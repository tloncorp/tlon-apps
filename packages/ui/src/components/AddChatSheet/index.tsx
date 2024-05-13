import {
  NativeStackScreenProps,
  createNativeStackNavigator,
} from '@react-navigation/native-stack';
import {
  createDevLogger,
  createShortCodeFromTitle,
} from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTokenValue } from 'tamagui';

import { useAddChatHandlers } from '../../contexts';
import {
  SizableText,
  View,
  XStack,
  YStack,
  ZStack,
  useTheme,
} from '../../core';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { IconButton } from '../IconButton';
import { Input } from '../Input';
import { Sheet } from '../Sheet';
import { ShipSelector } from '../ShipSelector';

const logger = createDevLogger('AddChatSheet', true);

const Stack = createNativeStackNavigator();
type StackParamList = {
  Home: undefined;
  Root: {
    currentUserId: string;
  };
  CreateGroup: {
    currentUserId: string;
  };
};

export function AddChatSheet({
  currentUserId,
  open,
  onOpenChange,
}: {
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={[85]}
      modal
      disableDrag={true}
      animation="quick"
    >
      <Sheet.Overlay />
      <Sheet.Frame
        paddingTop="$s"
        paddingBottom={insets.bottom}
        paddingHorizontal="$2xl"
      >
        <Sheet.Handle marginBottom="$l" />
        <KeyboardAvoidingView style={{ flex: 1 }}>
          <Stack.Navigator
            initialRouteName="Root"
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.background.val },
            }}
          >
            <Stack.Screen
              name="Root"
              initialParams={{ currentUserId }}
              component={RootPane}
            />
            <Stack.Screen
              name="CreateGroup"
              initialParams={{ currentUserId }}
              component={CreateGroupPane}
            />
          </Stack.Navigator>
        </KeyboardAvoidingView>
      </Sheet.Frame>
    </Sheet>
  );
}

function RootPane(props: NativeStackScreenProps<StackParamList, 'Root'>) {
  const handlers = useAddChatHandlers();
  const [dmParticipants, setDmParticipants] = useState<string[]>([]);
  return (
    <ZStack flex={1}>
      <YStack flex={1} gap="$2xl">
        <XStack justifyContent="center">
          <HeroInput />
        </XStack>
        <ShipSelector onSelectedChange={setDmParticipants} />
        {dmParticipants.length > 0 ? (
          <XStack justifyContent="center">
            <StartDMButton
              participants={dmParticipants}
              onPress={() => handlers.onStartDm(dmParticipants)}
            />
          </XStack>
        ) : (
          <Button
            hero
            onPress={() =>
              props.navigation.push('CreateGroup', {
                currentUserId: props.route.params.currentUserId,
              })
            }
          >
            <Button.Text>Start a new group</Button.Text>
          </Button>
        )}
      </YStack>
    </ZStack>
  );
}

function CreateGroupPane(
  props: NativeStackScreenProps<StackParamList, 'CreateGroup'>
) {
  const handlers = useAddChatHandlers();
  const [loading, setLoading] = useState(false);
  const [groupName, setGroupName] = useState('');
  const theme = useTheme();

  const onCreateGroup = useCallback(async () => {
    const shortCode = createShortCodeFromTitle(groupName);
    if (groupName.length < 3 || shortCode.length < 3) {
      return;
    }

    setLoading(true);

    try {
      console.log(`//// Starting Create Group Flow ////`);
      const { group, channel } = await store.createGroup({
        currentUserId: props.route.params.currentUserId,
        title: groupName,
        shortCode,
      });
      handlers.onCreatedGroup({ group, channel });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [groupName, handlers, props.route.params.currentUserId]);

  return (
    <YStack flex={1} gap="$2xl">
      <XStack justifyContent="space-between" alignItems="center">
        <Icon type="ChevronLeft" onPress={() => props.navigation.pop()} />
        <SizableText fontWeight="500">Start a New Group</SizableText>
        <Icon type="ChevronRight" opacity={0} />
      </XStack>
      <SizableText size="$m">What is your group about?</SizableText>
      {/* TODO: make tamagui cohere */}
      <TextInput
        style={{
          borderRadius: getTokenValue('$l', 'radius'),
          borderWidth: 1,
          borderColor: theme.primaryText.val,
          padding: getTokenValue('$xl', 'space'),
          fontSize: 17,
        }}
        autoFocus
        autoComplete="off"
        spellCheck={false}
        maxLength={100}
        onChangeText={setGroupName}
        placeholder="Group name"
      />
      <Button hero disabled={groupName.length < 3} onPress={onCreateGroup}>
        <Button.Text>Create Group</Button.Text>
        {loading && (
          <Button.Icon>
            <Icon type="Bang" />
          </Button.Icon>
        )}
      </Button>
    </YStack>
  );
}

function HeroInput() {
  return (
    <View
      borderWidth={1}
      borderColor="$primaryText"
      padding="$xl"
      borderRadius="$l"
      flexGrow={1}
    >
      <SizableText fontSize="$l" fontWeight="500">
        Find a group host
      </SizableText>
    </View>
  );
}

function HeroButton() {
  return (
    <Button hero>
      <Button.Text>Start a new group</Button.Text>
    </Button>
  );
}

function StartDMButton({
  participants,
  onPress,
}: {
  participants: string[];
  onPress: () => void;
}) {
  return (
    <Button hero onPress={onPress}>
      <Button.Text>
        Start DM with {participants.length}{' '}
        {participants.length === 1 ? 'person' : 'people'}
      </Button.Text>
    </Button>
  );
}
