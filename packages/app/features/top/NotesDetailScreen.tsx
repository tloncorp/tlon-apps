import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { notesNotebookFlagFromChannelId } from '@tloncorp/shared';
import * as store from '@tloncorp/shared/store';
import { YStack } from 'tamagui';

import type { RootStackParamList } from '../../navigation/types';
import { ChannelHeader, ChannelHeaderItemsProvider } from '../../ui';
import { NotesNoteDetail } from '../../ui/components/NotesChannel/NotesNoteDetail';

type Props = NativeStackScreenProps<RootStackParamList, 'NotesDetail'>;

export function NotesDetailScreen(props: Props) {
  const { channelId, focusTitle, noteId } = props.route.params;
  const notebookFlag = notesNotebookFlagFromChannelId(channelId);
  const { channel, group } = store.useChannelContext({
    channelId,
    draftKey: channelId,
  });

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
          title={channel.title ?? ''}
          description={channel.description ?? ''}
          goBack={handleGoBack}
          hideIdentity
        />
        <NotesNoteDetail
          autoFocusTitle={focusTitle}
          noteId={noteId}
          notebookFlag={notebookFlag}
        />
      </YStack>
    </ChannelHeaderItemsProvider>
  );
}
