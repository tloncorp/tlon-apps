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
import { useCallback } from 'react';
import { KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
}: {
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const theme = useTheme();

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      disableDrag={true}
      animation="quick"
      modal
    >
      <Sheet.Overlay />
      <Sheet.Frame>
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
  return (
    <ScreenWrapper>
      <View marginHorizontal="$m">
        <XStack marginBottom="$m" justifyContent="flex-start">
          <Icon type="ChevronLeft" onPress={() => props.navigation.pop()} />
        </XStack>
        <GroupPreviewPane
          group={props.route.params.group}
          onActionComplete={() => {}}
        />
      </View>
    </ScreenWrapper>
  );
}

function CreateGroupScreen(
  props: NativeStackScreenProps<StackParamList, 'CreateGroup'>
) {
  return (
    <ScreenWrapper>
      <CreateGroupWidget
        currentUserId={props.route.params.currentUserId}
        goBack={() => props.navigation.pop()}
      />
    </ScreenWrapper>
  );
}
