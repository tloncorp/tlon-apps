import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { notesNotebookFlagFromChannelId } from '@tloncorp/shared';
import * as store from '@tloncorp/shared/store';
import { YStack } from 'tamagui';

import type { RootStackParamList } from '../../navigation/types';
import { ChannelHeader, ChannelHeaderItemsProvider } from '../../ui';
import { NotesNativeChannel } from '../../ui/components/NotesChannel/NotesNativeChannel';

type Props = NativeStackScreenProps<RootStackParamList, 'NotesFolder'>;

export function NotesFolderScreen(props: Props) {
  const { channelId, folderId, folderTitle } = props.route.params;
  const notebookFlag = notesNotebookFlagFromChannelId(channelId);
  const { channel, group } = store.useChannelContext({
    channelId,
    draftKey: channelId,
  });
  const title = folderTitle ?? 'Folder';

  const handleGoBack = () => {
    props.navigation.goBack();
  };

  if (!channel) {
    return null;
  }

  return (
    <ChannelHeaderItemsProvider>
      <YStack flex={1} backgroundColor="$background">
        <ChannelHeader
          channel={channel}
          group={group}
          title={title}
          description={channel.title ?? ''}
          goBack={handleGoBack}
          hideIdentity
          preferProvidedTitle
        />
        <NotesNativeChannel
          channelId={channel.id}
          channelTitle={channel.title ?? undefined}
          folderId={folderId}
          groupId={props.route.params.groupId ?? channel.groupId}
          notebookFlag={notebookFlag}
        />
      </YStack>
    </ChannelHeaderItemsProvider>
  );
}
