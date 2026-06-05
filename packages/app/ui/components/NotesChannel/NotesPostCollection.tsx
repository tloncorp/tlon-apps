import { notesNotebookFlagFromChannelId } from '@tloncorp/shared';
import { forwardRef, useImperativeHandle, useMemo } from 'react';

import { usePostCollectionContext } from '../../contexts/postCollection';
import { IPostCollectionView } from '../postCollectionViews/shared';
import { NotesNativeChannel } from './NotesNativeChannel';

export const NotesPostCollection: IPostCollectionView = forwardRef(
  function NotesPostCollection(_props, forwardedRef) {
    const { channel } = usePostCollectionContext();
    const notebookFlag = useMemo(
      () => notesNotebookFlagFromChannelId(channel.id),
      [channel.id]
    );

    useImperativeHandle(forwardedRef, () => ({
      scrollToPostAtIndex: () => {},
      scrollToStart: () => {},
      highlightPost: () => {},
    }));

    return (
      <NotesNativeChannel
        channelId={channel.id}
        groupId={channel.groupId}
        notebookFlag={notebookFlag}
      />
    );
  }
);
