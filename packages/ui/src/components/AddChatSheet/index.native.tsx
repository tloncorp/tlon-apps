// import {
//   NativeStackScreenProps,
//   createNativeStackNavigator,
// } from '@react-navigation/native-stack';
import {
  StackScreenProps,
  createStackNavigator,
} from '@react-navigation/stack';
import { createShortCodeFromTitle } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, getTokenValue } from 'tamagui';

import { AddChatProvider, useAddChatHandlers } from '../../contexts';
import {
  SizableText,
  View,
  XStack,
  YStack,
  ZStack,
  useTheme,
} from '../../core';
import { Button } from '../Button';
import { GroupListItem } from '../GroupListItem';
import { GroupPreviewPane } from '../GroupPreviewSheet';
import { Icon } from '../Icon';
import { Sheet } from '../Sheet';
import { ContactSelector } from '../ShipSelector';

const Stack = createStackNavigator();
type StackParamList = {
  Home: undefined;
  Root: {
    currentUserId: string;
  };
  CreateGroup: {
    currentUserId: string;
  };
  JoinGroup: {
    currentUserId: string;
  };
};

export function AddChatSheet({
  currentUserId,
  open,
  onOpenChange,
  goToChannel,
  goToDm,
}: {
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goToDm: (participants: string[]) => void;
  goToChannel: ({ channel }: { channel: db.Channel }) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const dismiss = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <AddChatProvider
      handlers={{ onStartDm: goToDm, onCreatedGroup: goToChannel, dismiss }}
    >
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
                cardStyle: { backgroundColor: theme.background.val },
              }}
            >
              <Stack.Screen
                name="Root"
                initialParams={{ currentUserId, dismiss }}
                // these ComponentType<any> casts are needed to stop web type compilation
                // from complaining, not sure why
                component={RootPane as React.ComponentType<any>}
              />
              <Stack.Screen
                name="CreateGroup"
                initialParams={{ currentUserId, dismiss }}
                component={CreateGroupPane as React.ComponentType<any>}
              />
              <Stack.Screen
                name="JoinGroup"
                initialParams={{ currentUserId, dismiss }}
                component={JoinGroupPane as React.ComponentType<any>}
              />
            </Stack.Navigator>
          </KeyboardAvoidingView>
        </Sheet.Frame>
      </Sheet>
    </AddChatProvider>
  );
}

function RootPane(props: StackScreenProps<StackParamList, 'Root'>) {
  const handlers = useAddChatHandlers();
  const [dmParticipants, setDmParticipants] = useState<string[]>([]);
  return (
    <ZStack flex={1}>
      <YStack flex={1} gap="$2xl">
        <XStack
          justifyContent="center"
          onPress={() =>
            props.navigation.push('JoinGroup', {
              currentUserId: props.route.params.currentUserId,
            })
          }
        >
          <HeroInput />
        </XStack>
        <ContactSelector multiSelect onSelectedChange={setDmParticipants} />
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

type JoinGroupPaneState = {
  loading: boolean;
  error: string | null;
  selectedHost: string | null;
  hostGroups: db.Group[];
  selectedGroup: db.Group | null;
};

function JoinGroupPane(props: StackScreenProps<StackParamList, 'JoinGroup'>) {
  const { dismiss } = useAddChatHandlers();
  const [state, setState] = useState<JoinGroupPaneState>({
    loading: false,
    error: null,
    selectedHost: null,
    hostGroups: [],
    selectedGroup: null,
  });

  const onSelectHost = async (contactId: string) => {
    setState({
      loading: true,
      error: null,
      selectedHost: contactId,
      hostGroups: [],
      selectedGroup: null,
    });

    try {
      const groups = await store.getGroupsHostedBy(contactId);
      setState((prev) => ({ ...prev, loading: false, hostGroups: groups }));
    } catch (e) {
      setState((prev) => ({ ...prev, loading: false, error: e.message }));
    }
  };

  const onSelectGroup = (group: db.Group) => {
    setState((prev) => ({ ...prev, selectedGroup: group }));
  };

  return (
    <YStack flex={1} gap="$2xl">
      {state.selectedHost === null && (
        <ContactSelector onSelect={onSelectHost} />
      )}

      {state.selectedHost !== null && state.selectedGroup === null && (
        <View>
          <XStack>
            <Icon
              type="ChevronLeft"
              onPress={() => setState({ ...state, selectedHost: null })}
            />
            <SizableText>
              Groups for {state.selectedHost}{' '}
              {state.loading ? 'loading...' : ''}
            </SizableText>
          </XStack>
          {!state.loading && !state.error && (
            <ScrollView>
              {state.hostGroups.map((group) => (
                <GroupListItem
                  key={group.id}
                  model={group}
                  onPress={() => onSelectGroup(group)}
                />
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {state.selectedGroup !== null && (
        <GroupPreviewPane
          group={state.selectedGroup}
          onActionComplete={dismiss}
        />
      )}
    </YStack>
  );
}

function CreateGroupPane(
  props: StackScreenProps<StackParamList, 'CreateGroup'>
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
        Find a group host placeholder
      </SizableText>
    </View>
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
