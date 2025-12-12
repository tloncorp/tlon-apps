import * as store from '@tloncorp/shared';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  cloneElement,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, YStack } from 'tamagui';

import useGroupSearch from '../../hooks/useGroupSearch';
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
import { GroupTitleInputSheet } from '../groups/GroupTitleInputSheet';
import {
  GroupType,
  GroupTypeSelectionSheet,
} from '../groups/GroupTypeSelectionSheet';

type ChatType = 'dm' | 'group' | 'joinGroup';
type Step =
  | 'initial'
  | 'selectType'
  | 'selectGroupType'
  | 'setGroupTitle'
  | `create${Capitalize<ChatType>}`;

export type CreateChatParams =
  | { type: 'dm'; contactId: string }
  | {
      type: 'group';
      contactIds: string[];
      templateId?: store.GroupTemplateId;
      title?: string;
    };

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
      startIcon: <ListItem.SystemIcon icon="Send" />,
    },
    {
      title: CHAT_TYPE_CONFIG.group.actionTitle,
      description: CHAT_TYPE_CONFIG.group.actionDescription,
      action: () => onSelectType('group'),
      startIcon: <ListItem.SystemIcon icon="Channel" />,
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
    actionTitle: 'Join a group with a code (reference)',
    actionDescription: 'Join with a code (reference)',
  },
} as const;

interface CreateChatFormContentProps {
  chatType: ChatType;
  isCreating: boolean;
  onSelectDmContact: (contactId: string) => void;
  onSelectedChange: (contactIds: string[]) => void;
  onCreateGroup: () => void;
  onScrollChange?: (scrolling: boolean) => void;
}

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
  const { bottom } = useSafeAreaInsets();

  return (
    <YStack flex={1} gap="$l" paddingBottom={bottom}>
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
          maxHeight={500}
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
  const [selectedTemplateId, setSelectedTemplateId] = useState<
    store.GroupTemplateId | undefined
  >(undefined);
  const [groupTitle, setGroupTitle] = useState<string | undefined>(undefined);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setStep('initial');
        setSelectedTemplateId(undefined);
        setGroupTitle(undefined);
        setSelectedContactIds([]);
      } else if (step === 'initial') {
        setStep('selectType');
      }
    },
    [step]
  );

  const handleTypeSelected = useCallback((type: ChatType) => {
    if (type === 'group') {
      // Navigate to group type selection instead of directly to member selection
      setStep('selectGroupType');
    } else {
      setStep(`create${capitalize(type)}` as Step);
    }
  }, []);

  const handleGroupTypeSelected = useCallback(
    (groupType: GroupType, templateId?: store.GroupTemplateId) => {
      if (groupType === 'quick') {
        // Quick group goes to member selection without template
        setSelectedTemplateId(undefined);
        setStep('createGroup');
      } else if (groupType === 'template' && templateId) {
        setSelectedTemplateId(templateId);
        // Only basic-group template goes to title input, others skip to member selection
        if (templateId === 'basic-group') {
          setStep('setGroupTitle');
        } else {
          setStep('createGroup');
        }
      }
    },
    []
  );

  const handleTitleSubmitted = useCallback((title: string) => {
    setGroupTitle(title);
    setStep('createGroup');
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
      close: () => {
        setStep('initial');
        setSelectedTemplateId(undefined);
        setGroupTitle(undefined);
        setSelectedContactIds([]);
      },
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
    handleSubmit({
      type: 'group',
      contactIds: selectedContactIds,
      templateId: selectedTemplateId,
      title: groupTitle,
    });
  }, [handleSubmit, selectedContactIds, selectedTemplateId, groupTitle]);

  const chatType =
    step === 'createDm' ? 'dm' : step === 'createGroup' ? 'group' : 'joinGroup';

  const triggerWithOnPress = useMemo(() => {
    if (!trigger || !isValidElement(trigger)) return null;
    return cloneElement(trigger, {
      onPress: () => setStep(step === 'initial' ? 'selectType' : step),
      'data-testid': 'CreateChatSheetTrigger',
    } as Partial<{ onPress: () => void; 'data-testid': string }>);
  }, [trigger, step]);

  return !isWindowNarrow ? (
    <>
      {triggerWithOnPress}
      <ActionSheet
        open={step === 'selectType'}
        onOpenChange={() => setStep('initial')}
        mode="dialog"
        closeButton
        dialogContentProps={{ width: 380 }}
      >
        <ActionSheet.SimpleHeader title="Start a conversation" />
        <ActionSheet.Content>
          <TypeSelectionContent onSelectType={handleTypeSelected} />
        </ActionSheet.Content>
      </ActionSheet>
      <GroupTypeSelectionSheet
        open={step === 'selectGroupType'}
        onOpenChange={() => setStep('initial')}
        onSelectGroupType={handleGroupTypeSelected}
      />
      <GroupTitleInputSheet
        open={step === 'setGroupTitle'}
        onOpenChange={() => setStep('initial')}
        onSubmitTitle={handleTitleSubmitted}
      />
      <ActionSheet
        open={step === 'createJoinGroup'}
        onOpenChange={() => setStep('initial')}
        mode="dialog"
        closeButton
        dialogContentProps={{ width: 600 }}
      >
        <View flex={1}>
          <JoinGroupFormContent
            chatType={chatType}
            close={() => setStep('initial')}
          />
        </View>
      </ActionSheet>
      <ActionSheet
        open={step === 'createDm' || step === 'createGroup'}
        onOpenChange={() => setStep('initial')}
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
      />
      <GroupTypeSelectionSheet
        open={step === 'selectGroupType'}
        onOpenChange={handleOpenChange}
        onSelectGroupType={handleGroupTypeSelected}
      />
      <GroupTitleInputSheet
        open={step === 'setGroupTitle'}
        onOpenChange={handleOpenChange}
        onSubmitTitle={handleTitleSubmitted}
      />
      <CreateChatInviteSheet
        open={step === 'createDm' || step === 'createGroup'}
        onOpenChange={handleOpenChange}
        onSubmit={handleSubmit}
        chatType={step === 'createDm' ? 'dm' : 'group'}
        isCreating={isCreatingChat}
        templateId={selectedTemplateId}
        title={groupTitle}
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
}: {
  onSelectType: (type: ChatType) => void;
}) {
  const isWindowNarrow = useIsWindowNarrow();
  const actions = useMemo(
    () => createTypeActions(onSelectType),
    [onSelectType]
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
      <View
        paddingHorizontal="$2xl"
        paddingTop="$l"
        paddingBottom={isWindowNarrow ? undefined : '$l'}
        alignItems="center"
      >
        <Button
          onPress={() => onSelectType('joinGroup')}
          backgroundColor="transparent"
          minimal
          paddingVertical="$m"
          paddingHorizontal="$l"
        >
          <Button.Text color="$tertiaryText" size="$label/m">
            {CHAT_TYPE_CONFIG.joinGroup.actionTitle}
          </Button.Text>
        </Button>
      </View>
    </>
  );
}

export function CreateChatTypeSheet({
  open,
  onOpenChange,
  onSelectType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectType: (type: ChatType) => void;
}) {
  return (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      <ActionSheet.SimpleHeader title="Start a conversation" />
      <ActionSheet.Content>
        <TypeSelectionContent onSelectType={onSelectType} />
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
  templateId,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (params: CreateChatParams) => void;
  chatType: 'dm' | 'group';
  isCreating: boolean;
  templateId?: store.GroupTemplateId;
  title?: string;
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
    onSubmit({
      type: 'group',
      contactIds: selectedContactIds,
      templateId,
      title,
    });
    setSelectedContactIds([]);
  }, [onSubmit, selectedContactIds, templateId, title]);

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
          // Check if a template was selected
          let group: db.Group;
          if (params.templateId) {
            group = await store.createGroupFromTemplate({
              memberIds: params.contactIds,
              templateId: params.templateId,
              title: params.title,
            });
          } else {
            // No template, use default group
            group = await store.createDefaultGroup({
              memberIds: params.contactIds,
              title: params.title,
            });
          }
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
