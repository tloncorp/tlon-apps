import {
  NavigationContainer,
  NavigationContainerRef,
  StackActions,
} from '@react-navigation/native';
import {
  NativeStackScreenProps,
  createNativeStackNavigator,
} from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/dist/db';
import {
  Button,
  ContactBook,
  CreateGroupWidget,
  GroupPreviewPane,
  Icon,
  Sheet,
  View,
  ViewUserGroupsWidget,
  XStack,
  YStack,
  useTheme,
} from '@tloncorp/ui/src';
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AddGroupActions {
  dismiss: () => void;
  onCreatedGroup: ({
    group,
    channel,
  }: {
    group: db.Group;
    channel: db.Channel;
  }) => void;
  onScrollChange: (scrolling: boolean) => void;
  screenKey?: number;
}
const ActionContext = createContext<AddGroupActions>({} as AddGroupActions);

type StackParamList = {
  Home: undefined;
  Root: {
    currentUserId: string;
  };
  CreateGroup: {
    currentUserId: string;
  };
  ViewContactGroups: {
    currentUserId: string;
    contactId: string;
  };
  ViewGroupPreview: {
    currentUserId: string;
    group: db.Group;
  };
};
const Stack = createNativeStackNavigator<StackParamList>();

export default function AddGroupSheet({
  currentUserId,
  open,
  onOpenChange,
  onCreatedGroup,
}: {
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatedGroup: ({
    group,
    channel,
  }: {
    group: db.Group;
    channel: db.Channel;
  }) => void;
}) {
  const [screenScrolling, setScreenScrolling] = useState(false);
  const theme = useTheme();
  const navigationRef = useRef<NavigationContainerRef<StackParamList>>(null);
  const [screenKey, setScreenKey] = useState<number>(0);

  const dismiss = useCallback(() => {
    console.log('dismiss');
    if (navigationRef.current && navigationRef.current.canGoBack()) {
      console.log(`trying to pop to top`);
      navigationRef.current.dispatch(StackActions.popToTop());
    }
    onOpenChange(false);
    setTimeout(() => setScreenKey((key) => key + 1), 300);
  }, [onOpenChange]);

  return (
    <Sheet
      open={open}
      onOpenChange={dismiss}
      disableDrag={screenScrolling}
      dismissOnSnapToBottom
      animation="quick"
      modal
    >
      <Sheet.Overlay />
      <Sheet.Frame>
        <Sheet.Handle marginBottom="$l" />
        <KeyboardAvoidingView style={{ flex: 1 }}>
          <NavigationContainer independent={true} ref={navigationRef}>
            <ActionContext.Provider
              value={{
                dismiss,
                onCreatedGroup,
                onScrollChange: setScreenScrolling,
                screenKey,
              }}
            >
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
                  component={RootScreen}
                />
                <Stack.Screen
                  name="CreateGroup"
                  initialParams={{ currentUserId }}
                  component={CreateGroupScreen}
                />
                <Stack.Screen
                  name="ViewContactGroups"
                  component={ViewContactGroupsScreen}
                />
                <Stack.Screen
                  name="ViewGroupPreview"
                  component={ViewGroupPreviewScreen}
                />
              </Stack.Navigator>
            </ActionContext.Provider>
          </NavigationContainer>
        </KeyboardAvoidingView>
      </Sheet.Frame>
    </Sheet>
  );
}

function ScreenWrapper({
  children,
  withoutSafe,
}: {
  children: React.ReactNode;
  withoutSafe?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      flex={1}
      paddingBottom={withoutSafe ? undefined : insets.bottom}
      paddingHorizontal="$xl"
    >
      {children}
    </View>
  );
}

function RootScreen(props: NativeStackScreenProps<StackParamList, 'Root'>) {
  const { onScrollChange, screenKey } = useContext(ActionContext);
  const insets = useSafeAreaInsets();
  const onSelect = useCallback(
    (contactId: string) => {
      props.navigation.push('ViewContactGroups', {
        contactId,
        currentUserId: props.route.params.currentUserId,
      });
    },
    [props.navigation, props.route.params.currentUserId]
  );

  return (
    <ScreenWrapper withoutSafe>
      <YStack flex={1} gap="$xl">
        <ContactBook
          searchable
          searchPlaceholder="Search for group host..."
          onSelect={onSelect}
          onScrollChange={onScrollChange}
          key={screenKey}
        />
        <View position="absolute" bottom={insets.bottom + 8}>
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
        </View>
      </YStack>
    </ScreenWrapper>
  );
}

function ViewContactGroupsScreen(
  props: NativeStackScreenProps<StackParamList, 'ViewContactGroups'>
) {
  const onSelectGroup = useCallback(
    (group: db.Group) =>
      props.navigation.push('ViewGroupPreview', {
        group,
        currentUserId: props.route.params.currentUserId,
      }),
    [props.navigation, props.route.params.currentUserId]
  );

  return (
    <ScreenWrapper>
      <XStack justifyContent="flex-start">
        <Icon type="ChevronLeft" onPress={() => props.navigation.pop()} />
      </XStack>
      <ViewUserGroupsWidget
        userId={props.route.params.contactId}
        onSelectGroup={onSelectGroup}
      />
    </ScreenWrapper>
  );
}

function ViewGroupPreviewScreen(
  props: NativeStackScreenProps<StackParamList, 'ViewGroupPreview'>
) {
  const { dismiss } = useContext(ActionContext);
  return (
    <ScreenWrapper>
      <View marginHorizontal="$m">
        <XStack marginBottom="$m" justifyContent="flex-start">
          <Icon type="ChevronLeft" onPress={() => props.navigation.pop()} />
        </XStack>
        <GroupPreviewPane
          group={props.route.params.group}
          onActionComplete={dismiss}
        />
      </View>
    </ScreenWrapper>
  );
}

function CreateGroupScreen(
  props: NativeStackScreenProps<StackParamList, 'CreateGroup'>
) {
  const { onCreatedGroup, dismiss } = useContext(ActionContext);
  const handleCreate = useCallback(
    (args: { group: db.Group; channel: db.Channel }) => {
      dismiss();
      onCreatedGroup(args);
    },
    [dismiss, onCreatedGroup]
  );
  return (
    <ScreenWrapper>
      <CreateGroupWidget
        currentUserId={props.route.params.currentUserId}
        goBack={() => props.navigation.pop()}
        onCreatedGroup={handleCreate}
      />
    </ScreenWrapper>
  );
}
