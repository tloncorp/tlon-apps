import * as store from '@tloncorp/shared';
import {
  Action,
  ActionSheet,
  Button,
  ContactBook,
  LoadingSpinner,
  SimpleActionSheet,
  capitalize,
  useIsWindowNarrow,
} from '../../ui';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Popover, View, YStack } from 'tamagui';

import { useRootNavigation } from '../../navigation/utils';
import { trackError } from '../../utils/posthog';

type ChatType = 'dm' | 'group';
type Step = 'initial' | 'selectType' | `create${Capitalize<ChatType>}`;

export type CreateChatParams =
  | { type: 'dm'; contactId: string }
  | { type: 'group'; contactIds: string[] };

export type CreateChatSheetMethods = {
  open: () => void;
  close: () => void;
};

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
  ];
}

const CHAT_TYPE_CONFIG = {
  dm: {
    title: 'New chat',
    subtitle: 'Select a contact to chat with',
    actionTitle: 'New direct message',
    actionDescription: 'Create a new chat with one other person.',
  },
  group: {
    title: 'New group',
    subtitle: 'Select contacts to invite',
    actionTitle: 'New group',
    actionDescription: 'Create customizable group chat',
  },
} as const;

interface ActionButtonsProps {
  actions: Action[];
  paddingBottom?: number;
}

interface CreateChatFormContentProps {
  chatType: ChatType;
  isCreating: boolean;
  onSelectDmContact: (contactId: string) => void;
  onSelectedChange: (contactIds: string[]) => void;
  onCreateGroup: () => void;
  onScrollChange?: (scrolling: boolean) => void;
}

const ActionButtons = ({ actions, paddingBottom }: ActionButtonsProps) => (
  <YStack gap="$s" paddingBottom={paddingBottom}>
    {actions.map((action, i) => (
      <Button
        key={i}
        onPress={action.action}
        width="100%"
        justifyContent="flex-start"
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

  return (
    <YStack flex={1} gap="$l" paddingBottom={bottom}>
      <ActionSheet.SimpleHeader title={title} subtitle={subtitle} />
      <ContactBook
        searchable
        multiSelect={chatType === 'group'}
        searchPlaceholder="Filter by nickname or id"
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
      trackError({
        message: 'Error creating chat: ' + createChatError,
      });
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

  const chatType = step === 'createDm' ? 'dm' : 'group';
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
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Content
        elevate
        animation="quick"
        zIndex={1000000}
        position="relative"
        borderColor="$border"
        borderWidth={1}
        padding="$m"
      >
        {step === 'selectType' ? (
          <ActionButtons actions={actions} paddingBottom={insets.bottom} />
        ) : (
          <CreateChatFormContent
            chatType={chatType}
            isCreating={isCreatingChat}
            onSelectDmContact={handleSelectDmContact}
            onSelectedChange={setSelectedContactIds}
            onCreateGroup={handlePressCreateGroup}
          />
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
          const group = await store.createGroup({
            memberIds: params.contactIds,
          });
          navigateToGroup(group.id);
        }
        return true;
      } catch (e) {
        trackError(e);
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
