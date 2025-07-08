import * as store from '@tloncorp/shared';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  ComponentProps,
  cloneElement,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { Alert, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Popover, View, YStack } from 'tamagui';

import useGroupSearch from '../../hooks/useGroupSearch';
import { useRootNavigation } from '../../navigation/utils';
import {
  Action,
  ActionSheet,
  Button,
  ContactBook,
  GroupPreviewAction,
  GroupPreviewPane,
  LoadingSpinner,
  Pressable,
  SimpleActionSheet,
  Text,
  TextInput,
  capitalize,
  useIsWindowNarrow,
} from '../../ui';

type ChatType = 'dm' | 'group' | 'joinGroup';
type Step = 'initial' | 'selectType' | `create${Capitalize<ChatType>}`;

export type CreateChatParams =
  | { type: 'dm'; contactId: string }
  | { type: 'group'; contactIds: string[] };

export type CreateChatSheetMethods = {
  open: () => void;
  close: () => void;
};

const logger = createDevLogger('CreateChatSheet', true);

function createTypeActions(onSelectType: (type: ChatType) => void): Action[] {
  return [
    {
      title: CHAT_TYPE_CONFIG.dm.actionTitle,
      description: CHAT_TYPE_CONFIG.dm.actionDescription,
      action: () => onSelectType('dm'),
    },
    {
      title: CHAT_TYPE_CONFIG.group.actionTitle,
      description: CHAT_TYPE_CONFIG.group.actionDescription,
      action: () => onSelectType('group'),
    },
    {
      title: CHAT_TYPE_CONFIG.joinGroup.actionTitle,
      description: CHAT_TYPE_CONFIG.joinGroup.actionDescription,
      action: () => onSelectType('joinGroup'),
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
    actionDescription: 'Create a customizable group chat',
  },
  joinGroup: {
    title: 'Join a group',
    subtitle: 'Join a group chat with a code (reference)',
    actionTitle: 'Join a group',
    actionDescription: 'Join with a code (reference)',
  },
} as const;

interface ActionButtonsProps {
  actions: Action[];
  buttonProps?: ComponentProps<typeof Button>;
  containerProps?: ComponentProps<typeof YStack>;
}

interface CreateChatFormContentProps {
  chatType: ChatType;
  isCreating: boolean;
  onSelectDmContact: (contactId: string) => void;
  onSelectedChange: (contactIds: string[]) => void;
  onCreateGroup: () => void;
  onScrollChange?: (scrolling: boolean) => void;
}

const ActionButtons = ({
  actions,
  containerProps,
  buttonProps,
}: ActionButtonsProps) => (
  <YStack gap="$s" {...containerProps}>
    {actions.map((action, i) => (
      <Button
        key={i}
        onPress={action.action}
        width="100%"
        justifyContent="flex-start"
        {...buttonProps}
      >
        <YStack>
          <Button.Text size="$s">{action.title}</Button.Text>
          {action.description && (
            <Button.Text color="$secondaryText" size="$s">
              {action.description}
            </Button.Text>
          )}
        </YStack>
      </Button>
    ))}
  </YStack>
);

interface JoinGroupByIdPaneProps {
  close: () => void;
}

const JoinGroupByIdPane = ({ close }: JoinGroupByIdPaneProps) => {
  const [groupCode, setGroupCode] = useState('');
  const { isCodeValid, state, actions } = useGroupSearch(groupCode);

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
  chatType,
  close,
}: {
  chatType: ChatType;
  close: () => void;
}) => {
  const { title, subtitle } = CHAT_TYPE_CONFIG[chatType];
  const isWindowNarrow = useIsWindowNarrow();

  return (
    <YStack flex={1} width={isWindowNarrow ? '100%' : 400} gap="$l">
      <ActionSheet.SimpleHeader title={title} subtitle={subtitle} />
      <ActionSheet.ContentBlock>
        <JoinGroupByIdPane close={close} />
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

  return (
    <YStack flex={1} gap="$l" paddingBottom={bottom}>
      <ActionSheet.SimpleHeader title={title} subtitle={subtitle} />
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
        height={400}
      />
      {chatType === 'group' && (
        <Button marginTop="$l" hero onPress={onCreateGroup}>
          {!isCreating ? (
            <Button.Text>Create group</Button.Text>
          ) : (
            <View width={30} paddingHorizontal="$2xl">
              <LoadingSpinner color="$background" />
            </View>
          )}
        </Button>
      )}
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

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setStep('initial');
      } else if (step === 'initial') {
        setStep('selectType');
      }
    },
    [step]
  );

  const handleTypeSelected = useCallback((type: ChatType) => {
    setStep(`create${capitalize(type)}` as Step);
  }, []);

  const handleSubmit = useCallback(
    async (params: CreateChatParams) => {
      if (isCreatingChat) {
        return;
      }
      const didCreate = await createChat(params);
      if (didCreate) {
        setStep('initial');
      }
    },
    [createChat, isCreatingChat]
  );

  useImperativeHandle(
    ref,
    () => ({
      open: () => setStep((step) => (step === 'initial' ? 'selectType' : step)),
      close: () => setStep('initial'),
    }),
    []
  );

  const isWindowNarrow = useIsWindowNarrow();
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  const handleSelectDmContact = useCallback(
    (contactId: string) => {
      handleSubmit({ type: 'dm', contactId });
    },
    [handleSubmit]
  );

  const handlePressCreateGroup = useCallback(async () => {
    handleSubmit({ type: 'group', contactIds: selectedContactIds });
  }, [handleSubmit, selectedContactIds]);

  const insets = useSafeAreaInsets();

  const chatType =
    step === 'createDm' ? 'dm' : step === 'createGroup' ? 'group' : 'joinGroup';
  const actions = useMemo(
    () => createTypeActions(handleTypeSelected),
    [handleTypeSelected]
  );

  return !isWindowNarrow ? (
    <Popover
      open={step !== 'initial'}
      onOpenChange={handleOpenChange}
      placement="top-end"
      allowFlip
      offset={-12}
    >
      <Popover.Trigger
        role="button"
        data-testid="CreateChatSheetTrigger"
        asChild
      >
        {trigger}
      </Popover.Trigger>
      <Popover.Content
        elevate
        zIndex={1000000}
        position="relative"
        borderColor="$border"
        borderWidth={1}
        padding="$m"
      >
        {step === 'selectType' ? (
          <ActionButtons
            actions={actions}
            buttonProps={{ paddingBottom: insets.bottom }}
          />
        ) : step === 'createJoinGroup' ? (
          <JoinGroupFormContent
            chatType={chatType}
            close={() => setStep('initial')}
          />
        ) : (
          <ActionSheet
            open={step === 'createDm' || step === 'createGroup'}
            onOpenChange={() => setStep('initial')}
            mode="dialog"
            closeButton
            dialogContentProps={{ height: '80%', maxHeight: 1200, width: 600 }}
          >
            <ActionSheet.MainContent
              paddingHorizontal="$3xl"
              paddingBottom="$3xl"
              flex={1}
            >
              <View flex={1}>
                <CreateChatFormContent
                  chatType={chatType}
                  isCreating={isCreatingChat}
                  onSelectDmContact={handleSelectDmContact}
                  onSelectedChange={setSelectedContactIds}
                  onCreateGroup={handlePressCreateGroup}
                />
              </View>
            </ActionSheet.MainContent>
          </ActionSheet>
        )}
      </Popover.Content>
    </Popover>
  ) : (
    <>
      <CreateChatTypeSheet
        open={step === 'selectType'}
        onOpenChange={handleOpenChange}
        onSelectType={handleTypeSelected}
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

export function CreateChatTypeSheet({
  open,
  onOpenChange,
  onSelectType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectType: (type: 'dm' | 'group') => void;
}) {
  const actions = useMemo(
    () => createTypeActions(onSelectType),
    [onSelectType]
  );
  return (
    <SimpleActionSheet
      open={open}
      onOpenChange={onOpenChange}
      actions={actions}
    />
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

  const handleSelectDmContact = useCallback(
    (contactId: string) => {
      onSubmit({ type: 'dm', contactId });
    },
    [onSubmit]
  );

  const handlePressCreateGroup = useCallback(async () => {
    onSubmit({ type: 'group', contactIds: selectedContactIds });
    setSelectedContactIds([]);
  }, [onSubmit, selectedContactIds]);

  return (
    <ActionSheet
      disableDrag={screenScrolling}
      moveOnKeyboardChange
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={[90]}
      snapPointsMode="percent"
    >
      <YStack flex={1} paddingHorizontal="$2xl">
        <CreateChatFormContent
          chatType={chatType}
          isCreating={isCreating}
          onSelectDmContact={handleSelectDmContact}
          onSelectedChange={setSelectedContactIds}
          onCreateGroup={handlePressCreateGroup}
          onScrollChange={setScreenScrolling}
        />
      </YStack>
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
        <JoinGroupFormContent
          chatType="joinGroup"
          close={() => onOpenChange(false)}
        />
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
