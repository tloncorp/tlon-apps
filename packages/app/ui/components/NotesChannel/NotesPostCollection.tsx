import { notesNotebookFlagFromChannelId } from '@tloncorp/shared';
import { forwardRef, useEffect } from 'react';

import { usePostCollectionContext } from '../../contexts/postCollection';
import { IPostCollectionView } from '../postCollectionViews/shared';
import { NotesNativeChannel } from './NotesNativeChannel';

export const NotesPostCollection: IPostCollectionView = forwardRef(
  function NotesPostCollection() {
    const { channel, selectedPostId, posts, onFirstScreenShown } =
      usePostCollectionContext();
    // Notes draw their own view rather than the channel's posts, so there is
    // no list to report its first screen. The posts loading stands in for it:
    // without that report the channel keeps retaking its unread snapshot,
    // which refetches posts nothing shows.
    const postsLoaded = posts !== undefined;
    useEffect(() => {
      if (postsLoaded) {
        onFirstScreenShown?.();
      }
    }, [onFirstScreenShown, postsLoaded]);
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
