import { notesNotebookFlagFromChannelId } from '@tloncorp/shared';
import { forwardRef } from 'react';

import { usePostCollectionContext } from '../../contexts/postCollection';
import { IPostCollectionView } from '../postCollectionViews/shared';
import { NotesNativeChannel } from './NotesNativeChannel';

export const NotesPostCollection: IPostCollectionView = forwardRef(
  function NotesPostCollection() {
    const { channel } = usePostCollectionContext();
    const notebookFlag = notesNotebookFlagFromChannelId(channel.id);

    return (
      <NotesNativeChannel
        channelId={channel.id}
        channelTitle={channel.title ?? undefined}
        groupId={channel.groupId}
        notebookFlag={notebookFlag}
      />
    );
  }
);
