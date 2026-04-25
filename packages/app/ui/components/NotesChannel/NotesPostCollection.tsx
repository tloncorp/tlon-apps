import * as db from '@tloncorp/shared/db';
import { forwardRef, useImperativeHandle, useMemo } from 'react';
import { Platform } from 'react-native';

import { usePostCollectionContext } from '../../contexts/postCollection';
import { IPostCollectionView } from '../postCollectionViews/shared';
import { NotesWebView } from './NotesWebView';

function parseNotebookFlagFromChannelId(channelId: string) {
  const [, host, name] = channelId.split('/');
  if (!host || !name) return undefined;
  return `${host}/${name}`;
}

export const NotesPostCollection: IPostCollectionView = forwardRef(
  function NotesPostCollection(_props, forwardedRef) {
    const { channel } = usePostCollectionContext();
    // shipUrl is only required on native (the WebView needs an absolute URL).
    // On web the iframe uses a relative URL since the Tlon web app is served
    // by the same ship that hosts the notes UI.
    const shipInfo = db.shipInfo.useValue();
    const shipUrl =
      Platform.OS === 'web' ? undefined : shipInfo?.shipUrl ?? undefined;

    const notebookFlag = useMemo(
      () => parseNotebookFlagFromChannelId(channel.id),
      [channel.id]
    );

    useImperativeHandle(forwardedRef, () => ({
      scrollToPostAtIndex: () => {},
      scrollToStart: () => {},
      highlightPost: () => {},
    }));

    return (
      <NotesWebView
        shipUrl={shipUrl}
        notebookFlag={notebookFlag}
        hideHeader
      />
    );
  }
);
