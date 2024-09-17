import { QueryClientProvider, queryClient } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import {
  ActionSheet,
  AppDataContextProvider,
  Button,
  ContactBook,
  CreateGroupWidget,
  Icon,
  Sheet,
  Text,
  TextButton,
  View,
  XStack,
  YStack,
  isWeb,
  triggerHaptic,
  useContacts,
  useCurrentUserId,
} from '@tloncorp/ui';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Dimensions, KeyboardAvoidingView, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
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

type CurrentScreenKey = 'Root' | 'CreateGroup' | 'InviteUsers';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface TransitionWrapperProps {
  children: React.ReactNode;
  isActive: boolean;
}

// This component is used to animate the transition between screens
// in a way that mimics React Navigation's stack navigator.
// It could probably use some tweaking.
// We could also probably extract it out into its own file.
const TransitionWrapper: React.FC<TransitionWrapperProps> = ({
  children,
  isActive,
}) => {
  const animatedStyles = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX: withTiming(isActive ? 0 : SCREEN_WIDTH, {
            duration: 300,
            easing: Easing.out(Easing.cubic),
          }),
        },
      ],
      opacity: withTiming(isActive ? 1 : 0, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      }),
    };
  }, [isActive]);

  return (
    <Animated.View style={[styles.screen, animatedStyles]}>
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
  },
});

export function AddGroupSheet({
  open,
  onOpenChange,
  onCreatedGroup,
  onGoToDm,
  navigateToFindGroups,
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
  onGoToDm: (userId: string) => void;
  navigateToFindGroups: () => void;
}) {
  const [screenScrolling, setScreenScrolling] = useState(false);
  const [screenKey, setScreenKey] = useState<number>(0);
  const [currentScreen, setCurrentScreen] = useState<CurrentScreenKey>('Root');
  const [groupInvitees, setGroupInvitees] = useState<string[]>([]);
  const contacts = useContacts();

  const dismiss = useCallback(() => {
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

  const goToScreen = useCallback(
    (screen: CurrentScreenKey) => {
      setCurrentScreen(screen);
    },
    [setCurrentScreen]
  );

  const screens: Record<CurrentScreenKey, React.ReactElement> = useMemo(
    () => ({
      Root: (
        <TransitionWrapper isActive={currentScreen === 'Root'}>
          <RootScreen
            goToScreen={goToScreen}
            goToDM={onGoToDm}
            goToFindGroups={navigateToFindGroups}
          />
        </TransitionWrapper>
      ),
      CreateGroup: (
        <TransitionWrapper isActive={currentScreen === 'CreateGroup'}>
          <CreateGroupScreen invitees={groupInvitees} goToScreen={goToScreen} />
        </TransitionWrapper>
      ),
      InviteUsers: (
        <TransitionWrapper isActive={currentScreen === 'InviteUsers'}>
          <InviteUsersScreen
            invitees={groupInvitees}
            setInvitees={setGroupInvitees}
            goToScreen={goToScreen}
          />
        </TransitionWrapper>
      ),
    }),
    [goToScreen, onGoToDm, groupInvitees, currentScreen, navigateToFindGroups]
  );

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
              <ActionContext.Provider
                value={{
                  dismiss,
                  onCreatedGroup,
                  onScrollChange: setScreenScrolling,
                  screenKey,
                  contacts,
                }}
              >
                {Object.values(screens)}
              </ActionContext.Provider>
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
      paddingHorizontal={isWeb ? '$2xl' : '$xl'}
    >
      {children}
    </View>
  );
}

function RootScreen({
  goToScreen,
  goToDM,
  goToFindGroups,
}: {
  goToScreen: (screen: CurrentScreenKey) => void;
  goToDM: (userId: string) => void;
  goToFindGroups: () => void;
}) {
  const { onScrollChange, screenKey } = useContext(ActionContext);
  const onSelect = useCallback(
    (contactId: string) => {
      goToDM(contactId);
    },
    [goToDM]
  );

  return (
    <ScreenWrapper withoutSafe>
      <YStack flex={1} gap="$2xl">
        <ActionSheet.ActionGroup>
          <ActionSheet.Action
            action={{
              title: 'New Group',
              description: 'Create a new group from scratch',
              endIcon: 'ChevronRight',
              action: () => goToScreen('InviteUsers'),
            }}
          />
          <ActionSheet.Action
            action={{
              title: 'Join a group by username',
              description: 'Find a group to join',
              endIcon: 'ChevronRight',
              action: () => goToFindGroups(),
            }}
          />
        </ActionSheet.ActionGroup>
        <XStack justifyContent="center">
          <Text fontWeight="bold">New Message</Text>
        </XStack>
        <ContactBook
          searchable
          searchPlaceholder="Username or ID"
          onSelect={onSelect}
          onScrollChange={onScrollChange}
          key={screenKey}
        />
      </YStack>
    </ScreenWrapper>
  );
}

function CreateGroupScreen({
  invitees,
  goToScreen,
}: {
  invitees: string[];
  goToScreen: (screen: CurrentScreenKey) => void;
}) {
  const { onCreatedGroup, dismiss } = useContext(ActionContext);
  const handleCreate = useCallback(
    (args: { group: db.Group; channel: db.Channel }) => {
      onCreatedGroup(args);

      dismiss();
    },
    [dismiss, onCreatedGroup]
  );

  return (
    <ScreenWrapper>
      <CreateGroupWidget
        goBack={() => goToScreen('InviteUsers')}
        onCreatedGroup={handleCreate}
        invitees={invitees}
      />
    </ScreenWrapper>
  );
}

function InviteUsersScreen({
  invitees,
  setInvitees,
  goToScreen,
}: {
  invitees: string[];
  setInvitees: (invitees: string[]) => void;
  goToScreen: (screen: CurrentScreenKey) => void;
}) {
  const { contacts } = useContext(ActionContext);
  const currentUserId = useCurrentUserId();
  const { onScrollChange, screenKey } = useContext(ActionContext);

  return (
    <ScreenWrapper>
      <AppDataContextProvider
        contacts={contacts ?? null}
        currentUserId={currentUserId}
      >
        <XStack
          justifyContent="space-between"
          alignItems="center"
          marginBottom="$l"
          gap="$l"
        >
          <Button borderWidth={0}>
            <Icon type="ChevronLeft" onPress={() => goToScreen('Root')} />
          </Button>
          <Text fontWeight="bold" fontSize="$l">
            Select Members
          </Text>
          <TextButton
            onPress={() => {
              setInvitees([]);
              goToScreen('Root');
            }}
          >
            Skip
          </TextButton>
        </XStack>
        <ContactBook
          multiSelect
          searchable
          searchPlaceholder="Filter by nickname, @p"
          onSelectedChange={setInvitees}
          onScrollChange={onScrollChange}
          key={screenKey}
        />
        <Button
          hero
          onPress={() => {
            goToScreen('CreateGroup');
          }}
          disabled={invitees.length === 0}
        >
          <Button.Text>
            {invitees.length === 0
              ? 'Invite'
              : `Invite ${invitees.length} and continue`}
          </Button.Text>
        </Button>
      </AppDataContextProvider>
    </ScreenWrapper>
  );
}
