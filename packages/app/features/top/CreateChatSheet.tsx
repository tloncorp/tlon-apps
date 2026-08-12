import * as store from '@tloncorp/shared';
import { AnalyticsEvent, createDevLogger, trackEvent } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  cloneElement,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, YStack } from 'tamagui';

import useGroupSearch from '../../hooks/useGroupSearch';
import {
  AGENT_ONBOARDING_FORCE_LOCK,
  AGENT_SHIP_OVERRIDE,
} from '../../lib/envVars';
import { useRootNavigation } from '../../navigation/utils';
import {
  Action,
  ActionSheet,
  Button,
  ContactBook,
  GroupPreviewAction,
  GroupPreviewPane,
  ListItem,
  LoadingSpinner,
  Text,
  TextInput,
  capitalize,
  useIsWindowNarrow,
} from '../../ui';

type ChatType = 'dm' | 'group' | 'agent' | 'joinGroup';
type Step = 'initial' | 'selectType' | `create${Capitalize<ChatType>}`;

export type CreateChatParams =
  | { type: 'dm'; contactId: string }
  | { type: 'group'; contactIds: string[] }
  | { type: 'agent' };

export type CreateChatSheetMethods = {
  open: () => void;
  close: () => void;
};

const logger = createDevLogger('CreateChatSheet', true);

/**
 * Two ways to start a conversation: a DM, or a group. What "group" means
 * depends on whether the account has a resident agent — with one, the group
 * is created with the agent in it and the agent opens the conversation
 * (it posts its setup picker into the empty channel); without one, it's a
 * plain group chat with invitees.
 */
function createTypeActions(
  onSelectType: (type: ChatType) => void,
  hasAgent: boolean,
  groupFlavorKnown: boolean
): Action[] {
  return [
    {
      title: CHAT_TYPE_CONFIG.dm.actionTitle,
      description: CHAT_TYPE_CONFIG.dm.actionDescription,
      action: () => onSelectType('dm'),
      startIcon: <ListItem.SystemIcon icon="Send" />,
    },
    hasAgent
      ? {
          title: CHAT_TYPE_CONFIG.agent.actionTitle,
          description: CHAT_TYPE_CONFIG.agent.actionDescription,
          action: () => onSelectType('agent'),
          startIcon: <ListItem.SystemIcon icon="SmushStar" />,
        }
      : {
          title: CHAT_TYPE_CONFIG.group.actionTitle,
          description: CHAT_TYPE_CONFIG.group.actionDescription,
          action: () => onSelectType('group'),
          startIcon: <ListItem.SystemIcon icon="Channel" />,
          // Until the stored flags hydrate, which flavor this row should be
          // is unknown — and the agent flavor creates a group on first tap.
          // A tap in that window must not silently pick the wrong one.
          disabled: !groupFlavorKnown,
        },
  ];
}

const CHAT_TYPE_CONFIG = {
  dm: {
    title: 'New chat',
    subtitle: 'Select a contact to chat with',
    actionTitle: 'New direct message',
    actionDescription: 'Create a new chat with one other person',
  },
  group: {
    title: 'New group',
    subtitle: 'Select contacts to invite',
    actionTitle: 'New group',
    actionDescription: 'Start a group chat with invitees',
  },
  // The agent flow has no form of its own — the group is created on the
  // spot — so it only needs the action row.
  agent: {
    actionTitle: 'New group',
    actionDescription:
      'Start a group with your agent — it sets itself up around what you want',
  },
  joinGroup: {
    title: 'Join a group',
    subtitle: 'Join a group chat with a code (reference)',
    actionTitle: 'Join a group with a code (reference)',
    actionDescription: 'Join with a code (reference)',
  },
} as const;

interface CreateChatFormContentProps {
  chatType: 'dm' | 'group';
  isCreating: boolean;
  onSelectDmContact: (contactId: string) => void;
  onSelectedChange: (contactIds: string[]) => void;
  onCreateGroup: () => void;
  onScrollChange?: (scrolling: boolean) => void;
}

interface JoinGroupByIdPaneProps {
  open: boolean;
  close: () => void;
}

const JoinGroupByIdPane = ({ open, close }: JoinGroupByIdPaneProps) => {
  const [groupCode, setGroupCode] = useState('');
  const { isCodeValid, state, actions } = useGroupSearch(groupCode);

  const { resetSearch } = actions;

  // the sheet stays mounted after first open, so clear stale search results
  // when it closes
  useEffect(() => {
    if (!open) {
      setGroupCode('');
      resetSearch();
    }
  }, [open, resetSearch]);

  const handleActionComplete = useCallback(
    (action: GroupPreviewAction, group: db.Group) => {
      actions.handleGroupAction(action, group);
      setGroupCode('');
      close();
    },
    [close, actions]
  );

  return (
    <YStack gap="$m">
      {state.isSearching && isCodeValid ? (
        <View
          flex={1}
          justifyContent="center"
          borderColor="$border"
          borderWidth={1}
          borderRadius="$l"
        >
          {state.group && !state.isLoading && !state.isError ? (
            <GroupPreviewPane
              group={state.group}
              onActionComplete={handleActionComplete}
            />
          ) : state.isLoading ? (
            <View
              flex={1}
              justifyContent="center"
              alignItems="center"
              padding="$l"
            >
              <LoadingSpinner />
            </View>
          ) : state.isError ? (
            <View
              flex={1}
              justifyContent="center"
              alignItems="center"
              padding="$l"
            >
              <Text>Group not found</Text>
            </View>
          ) : (
            <View
              flex={1}
              justifyContent="center"
              alignItems="center"
              padding="$l"
            >
              <Text>Group not found</Text>
            </View>
          )}
        </View>
      ) : (
        <TextInput
          accent={
            groupCode ? (isCodeValid ? 'positive' : 'negative') : undefined
          }
          placeholder="Enter group code"
          onChangeText={setGroupCode}
          value={groupCode}
          spellCheck={false}
          autoCorrect={false}
          autoCapitalize="none"
          rightControls={
            <TextInput.InnerButton
              label={groupCode !== '' ? 'Go' : 'Close'}
              onPress={groupCode && isCodeValid ? actions.startSearch : close}
            />
          }
        />
      )}
    </YStack>
  );
};

const JoinGroupFormContent = ({
  open,
  close,
}: {
  open: boolean;
  close: () => void;
}) => {
  const { title, subtitle } = CHAT_TYPE_CONFIG.joinGroup;
  const { bottom } = useSafeAreaInsets();

  return (
    <YStack flex={1} gap="$l" paddingBottom={bottom}>
      <ActionSheet.SimpleHeader title={title} subtitle={subtitle} />
      <ActionSheet.ContentBlock>
        <JoinGroupByIdPane open={open} close={close} />
      </ActionSheet.ContentBlock>
    </YStack>
  );
};

const CreateChatFormContent = ({
  chatType,
  isCreating,
  onSelectDmContact,
  onSelectedChange,
  onCreateGroup,
  onScrollChange,
}: CreateChatFormContentProps) => {
  const { title, subtitle } = CHAT_TYPE_CONFIG[chatType];
  const { bottom } = useSafeAreaInsets();
  const isWindowNarrow = useIsWindowNarrow();
  const isGroup = chatType === 'group';
  const disabledIds = store.useGroupsNegotiationClashes({ enabled: isGroup });

  return (
    <YStack flex={1} gap="$l" paddingBottom={bottom}>
      <ActionSheet.SimpleHeader title={title} subtitle={subtitle} />
      <YStack flex={1} gap="$l" $sm={{ paddingHorizontal: '$xl' }}>
        <ContactBook
          searchable
          multiSelect={chatType === 'group'}
          searchPlaceholder="Filter by nickname or id"
          autoFocus={!isWindowNarrow}
          onSelect={onSelectDmContact}
          onSelectedChange={onSelectedChange}
          onScrollChange={(scrolling) => {
            onScrollChange?.(scrolling);
          }}
          maxHeight={isWindowNarrow ? undefined : 500}
          disabledIds={isGroup ? disabledIds : undefined}
          disabledReason="App version mismatch"
        />
        {chatType === 'group' && (
          <Button
            preset="primary"
            marginTop="$l"
            onPress={onCreateGroup}
            loading={isCreating}
            label={isCreating ? '' : 'Create group'}
            centered
          />
        )}
      </YStack>
    </YStack>
  );
};

export const CreateChatSheet = forwardRef(function CreateChatSheet(
  {
    defaultOpen,
    trigger,
  }: {
    defaultOpen?: boolean;
    trigger?: React.ReactNode;
  },
  ref: React.Ref<CreateChatSheetMethods>
) {
  const { isCreatingChat, createChatError, createChat } = useCreateChat();

  useEffect(() => {
    if (createChatError) {
      Alert.alert('Error creating chat', createChatError);
      logger.trackError('Error creating chat', new Error(createChatError));
    }
  }, [createChatError]);

  const [step, setStep] = useState<Step>(
    defaultOpen ? 'selectType' : 'initial'
  );
  const isWindowNarrow = useIsWindowNarrow();

  const open = useCallback(() => {
    if (step === 'initial') {
      trackEvent(AnalyticsEvent.CreateMenuOpened);
      setStep('selectType');
    }
  }, [step]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setStep('initial');
        setSelectedContactIds([]);
      } else if (step === 'initial') {
        setStep('selectType');
      }
    },
    [step]
  );

  // A ref, not the `isCreatingChat` state: state updates land on the next
  // render, so two taps inside one frame both pass a state check. The agent
  // row creates its group on the first tap with nothing to confirm, so a
  // double tap made two groups and navigated between them.
  const creatingRef = useRef(false);
  const handleSubmit = useCallback(
    async (params: CreateChatParams) => {
      if (creatingRef.current || isCreatingChat) {
        return;
      }
      creatingRef.current = true;
      try {
        const didCreate = await createChat(params);
        if (didCreate) {
          setStep('initial');
          setSelectedContactIds([]);
        }
      } finally {
        creatingRef.current = false;
      }
    },
    [createChat, isCreatingChat]
  );

  const handleTypeSelected = useCallback(
    (type: ChatType) => {
      trackEvent(AnalyticsEvent.CreateOptionSelected, {
        option: type,
      });
      if (type === 'agent') {
        // Nothing to configure: the group is created on the spot and the
        // agent takes it from there, in the channel.
        handleSubmit({ type: 'agent' });
      } else {
        setStep(`create${capitalize(type)}` as Step);
      }
    },
    [handleSubmit]
  );

  useImperativeHandle(
    ref,
    () => ({
      open,
      close: () => {
        setStep('initial');
        setSelectedContactIds([]);
      },
    }),
    [open]
  );

  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  const handleSelectDmContact = useCallback(
    (contactId: string) => {
      handleSubmit({ type: 'dm', contactId });
    },
    [handleSubmit]
  );

  const handlePressCreateGroup = useCallback(async () => {
    handleSubmit({
      type: 'group',
      contactIds: selectedContactIds,
    });
  }, [handleSubmit, selectedContactIds]);

  const chatType = step === 'createDm' ? ('dm' as const) : ('group' as const);

  const triggerWithOnPress = useMemo(() => {
    if (!trigger || !isValidElement(trigger)) return null;
    return cloneElement(trigger, {
      onPress: open,
      'data-testid': 'CreateChatSheetTrigger',
    } as Partial<{ onPress: () => void; 'data-testid': string }>);
  }, [open, trigger]);

  return !isWindowNarrow ? (
    <>
      {triggerWithOnPress}
      <ActionSheet
        open={step === 'selectType'}
        onOpenChange={handleOpenChange}
        mode="dialog"
        closeButton
        dialogContentProps={{ width: 380 }}
      >
        <ActionSheet.SimpleHeader title="Start a conversation" />
        <ActionSheet.Content>
          <TypeSelectionContent
            onSelectType={handleTypeSelected}
            isCreating={isCreatingChat}
          />
        </ActionSheet.Content>
      </ActionSheet>
      <ActionSheet
        open={step === 'createJoinGroup'}
        onOpenChange={handleOpenChange}
        mode="dialog"
        closeButton
        dialogContentProps={{ width: 600 }}
      >
        <View flex={1}>
          <JoinGroupFormContent
            open={step === 'createJoinGroup'}
            close={() => setStep('initial')}
          />
        </View>
      </ActionSheet>
      <ActionSheet
        open={step === 'createDm' || step === 'createGroup'}
        onOpenChange={handleOpenChange}
        mode="dialog"
        closeButton
        dialogContentProps={{ height: 'auto', maxHeight: 1200, width: 600 }}
      >
        <View flex={1} padding="$m">
          <CreateChatFormContent
            chatType={chatType}
            isCreating={isCreatingChat}
            onSelectDmContact={handleSelectDmContact}
            onSelectedChange={setSelectedContactIds}
            onCreateGroup={handlePressCreateGroup}
          />
        </View>
      </ActionSheet>
    </>
  ) : (
    <>
      <CreateChatTypeSheet
        open={step === 'selectType'}
        onOpenChange={handleOpenChange}
        onSelectType={handleTypeSelected}
        isCreating={isCreatingChat}
      />
      <CreateChatInviteSheet
        open={step === 'createDm' || step === 'createGroup'}
        onOpenChange={handleOpenChange}
        onSubmit={handleSubmit}
        chatType={step === 'createDm' ? 'dm' : 'group'}
        isCreating={isCreatingChat}
      />
      <JoinGroupSheet
        open={step === 'createJoinGroup'}
        onOpenChange={handleOpenChange}
      />
    </>
  );
});

function TypeSelectionContent({
  onSelectType,
  isCreating,
}: {
  onSelectType: (type: ChatType) => void;
  isCreating?: boolean;
}) {
  const isWindowNarrow = useIsWindowNarrow();
  const {
    value: hostingBotEnabled,
    isLoading: hostingBotLoading,
    isError: hostingBotError,
  } = db.hostingBotEnabled.useStorageItem();
  // Until the stored bot flag hydrates, it reads as its default — and this
  // action creates a group on first tap, so a hosted account must not act on
  // the wrong flavor during that window. The row stays disabled until it has
  // loaded (see `groupFlavorKnown` below).
  const groupFlavorKnown = !hostingBotLoading && !hostingBotError;
  const hasAgent =
    groupFlavorKnown && ((hostingBotEnabled ?? false) || !!AGENT_SHIP_OVERRIDE);
  const actions = useMemo(
    () => createTypeActions(onSelectType, hasAgent, groupFlavorKnown),
    [onSelectType, hasAgent, groupFlavorKnown]
  );
  return (
    <>
      <ActionSheet.ActionGroup accent="neutral">
        {actions.map((action, index) => (
          <ActionSheet.Action
            key={index}
            action={action}
            testID={action.testID}
            paddingHorizontal={'$xl'}
          />
        ))}
      </ActionSheet.ActionGroup>
      {isCreating ? (
        <View paddingHorizontal="$2xl" paddingTop="$l" alignItems="center">
          <LoadingSpinner />
        </View>
      ) : null}
      <View
        paddingHorizontal="$2xl"
        paddingTop="$l"
        paddingBottom={isWindowNarrow ? undefined : '$l'}
        alignItems="center"
      >
        <Button
          fill="text"
          intent="secondary"
          size="small"
          onPress={() => onSelectType('joinGroup')}
          label={CHAT_TYPE_CONFIG.joinGroup.actionTitle}
        />
      </View>
    </>
  );
}

export function CreateChatTypeSheet({
  open,
  onOpenChange,
  onSelectType,
  isCreating,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectType: (type: ChatType) => void;
  isCreating?: boolean;
}) {
  return (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      <ActionSheet.SimpleHeader title="Start a conversation" />
      <ActionSheet.Content>
        <TypeSelectionContent
          onSelectType={onSelectType}
          isCreating={isCreating}
        />
      </ActionSheet.Content>
    </ActionSheet>
  );
}

export function CreateChatInviteSheet({
  open,
  onOpenChange,
  onSubmit,
  chatType,
  isCreating,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (params: CreateChatParams) => void;
  chatType: 'dm' | 'group';
  isCreating: boolean;
}) {
  const [screenScrolling, setScreenScrolling] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [contentKey, setContentKey] = useState(0);

  // The sheet stays mounted across opens, so ContactBook's internal selection
  // and search state would otherwise leak into the next creation flow. Clear
  // our selection and remount the form whenever the sheet closes.
  useEffect(() => {
    if (!open) {
      setSelectedContactIds([]);
      setContentKey((key) => key + 1);
    }
  }, [open]);

  const handleSelectDmContact = useCallback(
    (contactId: string) => {
      onSubmit({ type: 'dm', contactId });
    },
    [onSubmit]
  );

  const handlePressCreateGroup = useCallback(async () => {
    onSubmit({
      type: 'group',
      contactIds: selectedContactIds,
    });
  }, [onSubmit, selectedContactIds]);

  // hack: ensure the nested ContactBook will scroll properly within the sheet
  // by disabling drag within the main content (drag handle only)
  const enableContentPanningGesture = useMemo(() => {
    return Platform.OS === 'android' ? false : undefined;
  }, []);

  return (
    <ActionSheet
      disableDrag={screenScrolling}
      moveOnKeyboardChange
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={[90]}
      snapPointsMode="percent"
      enableContentPanningGesture={enableContentPanningGesture}
      hasScrollableContent
    >
      <CreateChatFormContent
        key={contentKey}
        chatType={chatType}
        isCreating={isCreating}
        onSelectDmContact={handleSelectDmContact}
        onSelectedChange={setSelectedContactIds}
        onCreateGroup={handlePressCreateGroup}
        onScrollChange={setScreenScrolling}
      />
    </ActionSheet>
  );
}

export function JoinGroupSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { bottom } = useSafeAreaInsets();

  return (
    <ActionSheet moveOnKeyboardChange open={open} onOpenChange={onOpenChange}>
      <YStack flex={1} paddingBottom={bottom}>
        <JoinGroupFormContent open={open} close={() => onOpenChange(false)} />
      </YStack>
    </ActionSheet>
  );
}

function useCreateChat() {
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [createChatError, setCreateChatError] = useState<string | null>(null);
  const { navigateToGroup, navigateToChannel } = useRootNavigation();
  const createChat = useCallback(
    async (params: CreateChatParams) => {
      setIsCreatingChat(true);
      try {
        if (params.type === 'dm') {
          const channel = await store.upsertDmChannel({
            participants: [params.contactId],
          });
          navigateToChannel(channel);
        } else if (params.type === 'agent') {
          // The agent opens the conversation once it joins, so land the user
          // straight in the channel where that's about to happen.
          const { group, channelId } = await store.createAgentGroup({
            agentShipId: AGENT_SHIP_OVERRIDE || undefined,
          });
          if (AGENT_ONBOARDING_FORCE_LOCK) {
            // Dev only: stand in for the first-run flow, which is what
            // normally marks the guided group and needs a hosted home group.
            await db.agentOnboardingGroupId.setValue(group.id);
          }
          const channel = channelId
            ? await db.getChannel({ id: channelId })
            : null;
          if (channel) {
            navigateToChannel(channel);
          } else {
            navigateToGroup(group.id);
          }
        } else {
          const group = await store.createDefaultGroup({
            memberIds: params.contactIds,
          });
          navigateToGroup(group.id);
        }
        return true;
      } catch (e) {
        logger.trackError('createChat Failed', e);
        setCreateChatError(e.message);
        return false;
      } finally {
        setIsCreatingChat(false);
      }
    },
    [navigateToChannel, navigateToGroup]
  );

  return { isCreatingChat, createChatError, createChat };
}
