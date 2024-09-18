import { QueryClientProvider, queryClient } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, XStack, YStack, isWeb } from 'tamagui';

import {
  AppDataContextProvider,
  useContacts,
  useCurrentUserId,
} from '../contexts';
import { triggerHaptic } from '../utils';
import { ActionSheet } from './ActionSheet';
import { CreateGroupWidget } from './AddChats';
import { Button } from './Button';
import { TextButton } from './Buttons';
import { ContactBook } from './ContactBook';
import { Icon } from './Icon';

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
    setTimeout(() => {
      setCurrentScreen('Root');
      setScreenKey((key) => key + 1);
    }, 300);
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
        <TransitionWrapper key={'Root'} isActive={currentScreen === 'Root'}>
          <RootScreen
            goToScreen={goToScreen}
            goToDM={onGoToDm}
            goToFindGroups={navigateToFindGroups}
          />
        </TransitionWrapper>
      ),
      CreateGroup: (
        <TransitionWrapper
          key={'CreateGroup'}
          isActive={currentScreen === 'CreateGroup'}
        >
          <CreateGroupScreen invitees={groupInvitees} goToScreen={goToScreen} />
        </TransitionWrapper>
      ),
      InviteUsers: (
        <TransitionWrapper
          key={'InviteUsers'}
          isActive={currentScreen === 'InviteUsers'}
        >
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
    <ActionSheet
      disableDrag={screenScrolling}
      moveOnKeyboardChange
      open={open}
      onOpenChange={dismiss}
      snapPoints={['90%']}
    >
      <QueryClientProvider client={queryClient}>
        <AppDataContextProvider contacts={contacts ?? null}>
          <ActionContext.Provider
            value={{
              dismiss,
              onCreatedGroup,
              onScrollChange: setScreenScrolling,
              screenKey,
              contacts,
            }}
          >
            <ActionSheet.Content flex={1}>
              {Object.values(screens)}
            </ActionSheet.Content>
          </ActionContext.Provider>
        </AppDataContextProvider>
      </QueryClientProvider>
    </ActionSheet>
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
    <ActionSheet.ContentBlock
      flex={1}
      paddingBottom={withoutSafe ? undefined : insets.bottom}
      paddingHorizontal={isWeb ? '$2xl' : '$xl'}
    >
      {children}
    </ActionSheet.ContentBlock>
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
      <YStack flex={1} gap="$xl">
        <ActionSheet.ActionTitle textAlign="center">
          New Message
        </ActionSheet.ActionTitle>
        <View flex={1} padding="$xl">
          <ContactBook
            searchable
            searchPlaceholder="Username or ID"
            onSelect={onSelect}
            onScrollChange={onScrollChange}
            key={screenKey}
            quickActions={
              <ActionSheet.ActionGroup paddingVertical="$xl" padding="unset">
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
            }
          />
        </View>
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
          <ActionSheet.ActionTitle textAlign="center">
            Select Members
          </ActionSheet.ActionTitle>
          <TextButton
            onPress={() => {
              setInvitees([]);
              goToScreen('CreateGroup');
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
