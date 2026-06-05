import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { notesNotebookFlagFromChannelId } from '@tloncorp/shared';
import * as store from '@tloncorp/shared/store';
import { useCallback, useMemo } from 'react';
import { YStack } from 'tamagui';

import type { RootStackParamList } from '../../navigation/types';
import { ChannelHeader, ChannelHeaderItemsProvider, NotesNoteDetail } from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'NotesDetail'>;

export function NotesDetailScreen(props: Props) {
  const { channelId, noteId } = props.route.params;
  const notebookFlag = useMemo(
    () => notesNotebookFlagFromChannelId(channelId),
    [channelId]
  );
  const numericNoteId = useMemo(() => {
    const parsed = Number(noteId);
    return Number.isFinite(parsed) ? parsed : null;
  }, [noteId]);
  const { channel, group } = store.useChannelContext({
    channelId,
    draftKey: channelId,
  });

  const handleGoBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

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
        />
        <NotesNoteDetail
          noteId={numericNoteId}
          notebookFlag={notebookFlag}
          onDeleted={handleGoBack}
        />
      </YStack>
    </ChannelHeaderItemsProvider>
  );
}
