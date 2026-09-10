import { notesNotebookFlagFromChannelId } from '@tloncorp/shared';
import { forwardRef } from 'react';

import { usePostCollectionContext } from '../../contexts/postCollection';
import { IPostCollectionView } from '../postCollectionViews/shared';
import { NotesNativeChannel } from './NotesNativeChannel';

export const NotesPostCollection: IPostCollectionView = forwardRef(
  function NotesPostCollection() {
    const { channel, selectedPostId } = usePostCollectionContext();
    const notebookFlag = notesNotebookFlagFromChannelId(channel.id);
    // notes activity events carry the note id as the post id, so a
    // notification or activity press can target a specific note
    const initialNoteId =
      selectedPostId != null && Number.isFinite(Number(selectedPostId))
        ? Number(selectedPostId)
        : undefined;

    return (
      <NotesNativeChannel
        channelId={channel.id}
        channelTitle={channel.title ?? undefined}
        groupId={channel.groupId}
        notebookFlag={notebookFlag}
        initialNoteId={initialNoteId}
      />
    );
  }
);
