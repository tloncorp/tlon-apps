import {
  NavigationContainer,
  NavigationContainerRef,
  StackActions,
} from '@react-navigation/native';
import {
  NativeStackScreenProps,
  createNativeStackNavigator,
} from '@react-navigation/native-stack';
import { BRANCH_DOMAIN, BRANCH_KEY } from '@tloncorp/app/constants';
import { QueryClientProvider, queryClient } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import {
  AppDataContextProvider,
  Button,
  ContactBook,
  CreateGroupWidget,
  GroupPreviewPane,
  Icon,
  InviteUsersWidget,
  Sheet,
  View,
  ViewUserGroupsWidget,
  XStack,
  YStack,
  triggerHaptic,
  useContacts,
  useTheme,
} from '@tloncorp/ui/src';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  contacts?: db.Contact[] | null;
}
const ActionContext = createContext<AddGroupActions>({} as AddGroupActions);

type StackParamList = {
  Home: undefined;
  Root: undefined;
  CreateGroup: undefined;
  InviteUsers: {
    group: db.Group;
    onInviteComplete: () => void;
  };
  ViewContactGroups: {
    contactId: string;
  };
  ViewGroupPreview: {
    group: db.Group;
  };
};
const Stack = createNativeStackNavigator<StackParamList>();

export default function AddGroupSheet({
  open,
  onOpenChange,
  onCreatedGroup,
}: {
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
  const contacts = useContacts();

  const dismiss = useCallback(() => {
    if (navigationRef.current && navigationRef.current.canGoBack()) {
      navigationRef.current.dispatch(StackActions.popToTop());
    }
    onOpenChange(false);
    // used for resetting components nested within screens after
    // reopening
    setTimeout(() => setScreenKey((key) => key + 1), 300);
  }, [onOpenChange]);

  useEffect(() => {
    if (open) {
      triggerHaptic('sheetOpen');
    }
  }, [open]);

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
      <Sheet.LazyFrame>
        <QueryClientProvider client={queryClient}>
          <AppDataContextProvider contacts={contacts ?? null}>
            <Sheet.Handle marginBottom="$l" />
            <KeyboardAvoidingView style={{ flex: 1 }}>
              <NavigationContainer independent={true} ref={navigationRef}>
                <ActionContext.Provider
                  value={{
                    dismiss,
                    onCreatedGroup,
                    onScrollChange: setScreenScrolling,
                    screenKey,
                    contacts,
                  }}
                >
                  <Stack.Navigator
                    initialRouteName="Root"
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: theme.background.val },
                    }}
                  >
                    <Stack.Screen name="Root" component={RootScreen} />
                    <Stack.Screen
                      name="CreateGroup"
                      component={CreateGroupScreen}
                    />
                    <Stack.Screen
                      name="InviteUsers"
                      component={InviteUsersScreen}
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
          </AppDataContextProvider>
        </QueryClientProvider>
      </Sheet.LazyFrame>
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
  const { onScrollChange, screenKey, contacts } = useContext(ActionContext);
  const insets = useSafeAreaInsets();
  const onSelect = useCallback(
    (contactId: string) => {
      props.navigation.push('ViewContactGroups', {
        contactId,
      });
    },
    [props.navigation]
  );

  return (
    <ScreenWrapper withoutSafe>
      {/* Unclear why we have to render another contacts provider here, but the screen context shows up empty */}
      {/* on Android? */}
      {/* <ContactsProvider contacts={contacts ?? null}> */}
      <YStack flex={1} gap="$xl">
        <ContactBook
          searchable
          searchPlaceholder="Search for group host..."
          onSelect={onSelect}
          onScrollChange={onScrollChange}
          key={screenKey}
        />
        <View position="absolute" bottom={insets.bottom + 8}>
          <Button hero onPress={() => props.navigation.push('CreateGroup')}>
            <Button.Text width="100%">Start a new group</Button.Text>
          </Button>
        </View>
      </YStack>
      {/* </ContactsProvider> */}
    </ScreenWrapper>
  );
}

function ViewContactGroupsScreen(
  props: NativeStackScreenProps<StackParamList, 'ViewContactGroups'>
) {
  const { onScrollChange } = useContext(ActionContext);
  const onSelectGroup = useCallback(
    (group: db.Group) =>
      props.navigation.push('ViewGroupPreview', {
        group,
      }),
    [props.navigation]
  );

  return (
    <ScreenWrapper>
      <XStack justifyContent="flex-start">
        <Icon type="ChevronLeft" onPress={() => props.navigation.pop()} />
      </XStack>
      <ViewUserGroupsWidget
        userId={props.route.params.contactId}
        onSelectGroup={onSelectGroup}
        onScrollChange={onScrollChange}
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
      props.navigation.push('InviteUsers', {
        group: args.group,
        onInviteComplete: () => {
          dismiss();
          onCreatedGroup(args);
        },
      });
    },
    [dismiss, onCreatedGroup, props.navigation]
  );
  return (
    <ScreenWrapper>
      <CreateGroupWidget
        goBack={() => props.navigation.pop()}
        onCreatedGroup={handleCreate}
      />
    </ScreenWrapper>
  );
}

function InviteUsersScreen(
  props: NativeStackScreenProps<StackParamList, 'InviteUsers'>
) {
  const { contacts } = useContext(ActionContext);

  return (
    <ScreenWrapper>
      <AppDataContextProvider
        branchKey={BRANCH_KEY}
        branchDomain={BRANCH_DOMAIN}
        contacts={contacts ?? null}
      >
        <InviteUsersWidget
          group={props.route.params.group}
          onInviteComplete={props.route.params.onInviteComplete}
        />
      </AppDataContextProvider>
    </ScreenWrapper>
  );
}
