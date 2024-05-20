import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddChatProvider } from '../../contexts';
import { XStack, YStack, ZStack } from '../../core';
import { Button } from '../Button';
import { ContactBook } from '../ContactBook';
import { LoadingSpinner } from '../LoadingSpinner';
import { Sheet } from '../Sheet';

export function StartDmSheet({
  open,
  onOpenChange,
  goToChannel,
  goToDm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goToDm: (participants: string[]) => void;
  goToChannel: ({ channel }: { channel: db.Channel }) => void;
}) {
  const insets = useSafeAreaInsets();
  const dismiss = useCallback(() => onOpenChange(false), [onOpenChange]);
  const [dmParticipants, setDmParticipants] = useState<string[]>([]);

  const handleDismiss = useCallback(() => {
    setDmParticipants([]);
    dismiss();
  }, [dismiss]);

  return (
    <AddChatProvider
      handlers={{ onStartDm: goToDm, onCreatedGroup: goToChannel, dismiss }}
    >
      <Sheet
        open={open}
        onOpenChange={handleDismiss}
        snapPoints={[85]}
        modal
        disableDrag={true}
        animation="quick"
      >
        <Sheet.Overlay />
        <Sheet.Frame paddingTop="$s" paddingHorizontal="$2xl">
          <Sheet.Handle marginBottom="$l" />
          <ZStack flex={1}>
            <YStack flex={1} gap="$2xl">
              <ContactBook
                multiSelect
                onSelectedChange={setDmParticipants}
                searchable
                searchPlaceholder="Start a DM with..."
              />
              {dmParticipants.length > 0 && (
                <XStack
                  position="absolute"
                  bottom={insets.bottom + 12}
                  justifyContent="center"
                >
                  <StartDMButton
                    participants={dmParticipants}
                    onPress={() => goToDm(dmParticipants)}
                  />
                </XStack>
              )}
            </YStack>
          </ZStack>
        </Sheet.Frame>
      </Sheet>
    </AddChatProvider>
  );
}

function StartDMButton({
  participants,
  onPress,
}: {
  participants: string[];
  onPress: () => void;
}) {
  const isMultiDm = participants.length > 1;

  store.useForceNegotiationUpdate(participants, 'chat');
  const {
    match: negotiationMatch,
    isLoading: negotiationLoading,
    haveAllNegotiations,
  } = store.useNegotiateMulti(participants, 'chat', 'chat');
  const multiDmVersionMismatch = !negotiationLoading && !negotiationMatch;
  const shouldBlockInput = isMultiDm && multiDmVersionMismatch;

  return (
    <Button
      hero
      onPress={onPress}
      disabled={participants.length === 0 || shouldBlockInput}
    >
      {shouldBlockInput ? (
        <>
          <Button.Text>
            {haveAllNegotiations
              ? 'Not all Urbits on the same version'
              : 'Checking version compatibility'}
          </Button.Text>
          {!haveAllNegotiations && (
            <Button.Icon>
              <LoadingSpinner />
            </Button.Icon>
          )}
        </>
      ) : (
        <Button.Text>
          Start DM with {participants.length}{' '}
          {participants.length === 1 ? 'person' : 'people'}
        </Button.Text>
      )}
    </Button>
  );
}

// function RootPane() {
//   const handlers = useAddChatHandlers();
//   const [dmParticipants, setDmParticipants] = useState<string[]>([]);

//   return (
//     <ZStack flex={1}>
//       <YStack flex={1} gap="$2xl">
//         <ContactBook multiSelect onSelectedChange={setDmParticipants} />
//         <XStack justifyContent="center">
//           <StartDMButton
//             participants={dmParticipants}
//             onPress={() => handlers.onStartDm(dmParticipants)}
//           />
//         </XStack>
//       </YStack>
//     </ZStack>
//   );
// }

// type JoinGroupPaneState = {
//   loading: boolean;
//   error: string | null;
//   selectedHost: string | null;
//   hostGroups: db.Group[];
//   selectedGroup: db.Group | null;
// };

// export function JoinGroupPane() {
//   const { dismiss } = useAddChatHandlers();
//   const [state, setState] = useState<JoinGroupPaneState>({
//     loading: false,
//     error: null,
//     selectedHost: null,
//     hostGroups: [],
//     selectedGroup: null,
//   });

//   const onSelectHost = async (contactId: string) => {
//     setState({
//       loading: true,
//       error: null,
//       selectedHost: contactId,
//       hostGroups: [],
//       selectedGroup: null,
//     });

//     try {
//       const groups = await store.getGroupsHostedBy(contactId);
//       setState((prev) => ({ ...prev, loading: false, hostGroups: groups }));
//     } catch (e) {
//       setState((prev) => ({ ...prev, loading: false, error: e.message }));
//     }
//   };

//   const onSelectGroup = (group: db.Group) => {
//     setState((prev) => ({ ...prev, selectedGroup: group }));
//   };

//   return (
//     <YStack flex={1} gap="$2xl">
//       {state.selectedHost === null && (
//         <ContactSelector onSelect={onSelectHost} />
//       )}

//       {state.selectedHost !== null && state.selectedGroup === null && (
//         <View>
//           <XStack>
//             <Icon
//               type="ChevronLeft"
//               onPress={() => setState({ ...state, selectedHost: null })}
//             />
//             <SizableText>
//               Groups for {state.selectedHost}{' '}
//               {state.loading ? 'loading...' : ''}
//             </SizableText>
//           </XStack>
//           {!state.loading && !state.error && (
//             <ScrollView>
//               {state.hostGroups.map((group) => (
//                 <GroupListItem
//                   key={group.id}
//                   model={group}
//                   onPress={() => onSelectGroup(group)}
//                 />
//               ))}
//             </ScrollView>
//           )}
//         </View>
//       )}

//       {state.selectedGroup !== null && (
//         <GroupPreviewPane
//           group={state.selectedGroup}
//           onActionComplete={dismiss}
//         />
//       )}
//     </YStack>
//   );
// }

// export function CreateGroupPane(props: { currentUserId: string }) {
//   const handlers = useAddChatHandlers();
//   const [loading, setLoading] = useState(false);
//   const [groupName, setGroupName] = useState('');
//   const theme = useTheme();

//   const onCreateGroup = useCallback(async () => {
//     const shortCode = createShortCodeFromTitle(groupName);
//     if (groupName.length < 3 || shortCode.length < 3) {
//       return;
//     }

//     setLoading(true);

//     try {
//       console.log(`//// Starting Create Group Flow ////`);
//       const { group, channel } = await store.createGroup({
//         currentUserId: props.currentUserId,
//         title: groupName,
//         shortCode,
//       });
//       handlers.onCreatedGroup({ group, channel });
//     } catch (e) {
//       console.error(e);
//     } finally {
//       setLoading(false);
//     }
//   }, [groupName, handlers, props.currentUserId]);

//   return (
//     <YStack flex={1} gap="$2xl">
//       <XStack justifyContent="space-between" alignItems="center">
//         <Icon type="ChevronLeft" />
//         <SizableText fontWeight="500">Start a New Group</SizableText>
//         <Icon type="ChevronRight" opacity={0} />
//       </XStack>
//       <SizableText size="$m">What is your group about?</SizableText>
//       {/* TODO: make tamagui input cohere */}
//       <TextInput
//         style={{
//           borderRadius: getTokenValue('$l', 'radius'),
//           borderWidth: 1,
//           borderColor: theme.primaryText.val,
//           padding: getTokenValue('$xl', 'space'),
//           fontSize: 17,
//         }}
//         autoFocus
//         autoComplete="off"
//         spellCheck={false}
//         maxLength={100}
//         onChangeText={setGroupName}
//         placeholder="Group name"
//       />
//       <Button hero disabled={groupName.length < 3} onPress={onCreateGroup}>
//         <Button.Text>Create Group</Button.Text>
//         {loading && (
//           <Button.Icon>
//             <Icon type="Bang" />
//           </Button.Icon>
//         )}
//       </Button>
//     </YStack>
//   );
// }

// function HeroInput() {
//   return (
//     <View
//       borderWidth={1}
//       borderColor="$primaryText"
//       padding="$xl"
//       borderRadius="$l"
//       flexGrow={1}
//     >
//       <SizableText fontSize="$l" fontWeight="500">
//         Find a group host placeholder
//       </SizableText>
//     </View>
//   );
// }
