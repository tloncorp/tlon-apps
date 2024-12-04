import * as store from '@tloncorp/shared';
import {
  Action,
  ActionSheet,
  Button,
  ContactBook,
  LoadingSpinner,
  SimpleActionSheet,
} from '@tloncorp/ui';
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
import { View, YStack } from 'tamagui';

import { useRootNavigation } from '../../navigation/utils';

export type CreateChatParams =
  | { type: 'dm'; contactId: string }
  | { type: 'group'; contactIds: string[] };

export type CreateChatSheetMethods = {
  open: () => void;
  close: () => void;
};

export const CreateChatSheet = forwardRef(function CreateChatSheet(
  {
    defaultOpen,
  }: {
    defaultOpen?: boolean;
  },
  ref: React.Ref<CreateChatSheetMethods>
) {
  const { isCreatingChat, createChatError, createChat } = useCreateChat();

  useEffect(() => {
    if (createChatError) {
      Alert.alert('Error creating chat', createChatError);
    }
  }, [createChatError]);

  const [step, setStep] = useState<
    'initial' | 'selectType' | 'createGroup' | 'createDm'
  >(defaultOpen ? 'selectType' : 'initial');

  const handleSelectTypeOpenChange = useCallback((open: boolean) => {
    setStep(open ? 'selectType' : 'initial');
  }, []);

  const handleTypeSelected = useCallback((type: 'group' | 'dm') => {
    setStep(type === 'group' ? 'createGroup' : 'createDm');
  }, []);

  const handleSubmit = useCallback(
    async (params: CreateChatParams) => {
      if (!isCreatingChat) {
        const didCreate = await createChat(params);
        if (didCreate) {
          setStep('initial');
        }
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

  return (
    <>
      <CreateChatTypeSheet
        open={step === 'selectType'}
        onOpenChange={handleSelectTypeOpenChange}
        onSelectType={handleTypeSelected}
      />
      <CreateChatInviteSheet
        open={step === 'createDm' || step === 'createGroup'}
        onOpenChange={handleSelectTypeOpenChange}
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
  const actions: Action[] = useMemo(
    (): Action[] => [
      {
        title: 'New direct message',
        description: 'Create a new chat with one other person.',
        action: () => onSelectType('dm'),
      },
      {
        title: 'New group',
        description: 'Create a new group chat or customizable social space',
        action: () => onSelectType('group'),
      },
    ],
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

  const handleSelectDmContact = useCallback(
    (contactId: string) => {
      onSubmit({ type: 'dm', contactId });
    },
    [onSubmit]
  );

  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  const handlePressCreateGroup = useCallback(async () => {
    onSubmit({ type: 'group', contactIds: selectedContactIds });
  }, [onSubmit, selectedContactIds]);

  const insets = useSafeAreaInsets();

  return (
    <ActionSheet
      disableDrag={screenScrolling}
      moveOnKeyboardChange
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={[90]}
      snapPointsMode="percent"
    >
      <ActionSheet.SimpleHeader
        title={chatType === 'dm' ? 'New chat' : 'New group'}
      />
      <YStack flex={1} paddingHorizontal="$2xl">
        <ContactBook
          searchable
          multiSelect={chatType === 'group'}
          searchPlaceholder="Filter by nickname or id"
          onSelect={handleSelectDmContact}
          onSelectedChange={setSelectedContactIds}
          onScrollChange={setScreenScrolling}
          height={400}
        />
        {chatType === 'group' && (
          <Button
            position="absolute"
            bottom={insets.bottom}
            left={'$xl'}
            right={'$xl'}
            hero
            shadow
            onPress={handlePressCreateGroup}
          >
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
