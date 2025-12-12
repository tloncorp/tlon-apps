import { convertContent } from '@tloncorp/shared/logic';
import { Pressable } from '@tloncorp/ui';
import { useCallback, useMemo, useRef } from 'react';

import { RenderItemType } from '../contexts/componentsKits';
import { ChatAuthorRow } from './AuthorRow';
import { AudioPlayerHandle } from './Embed/AudioEmbedShared';
import { AudioPlayer } from './Embed/AudioPlayer';

export const AudioPost: RenderItemType = (props) => {
  const audioUrl = useMemo(() => {
    const content = convertContent(props.post.content, props.post.blob);
    if (content[0].type === 'image') {
      return content[0].src;
    }
    return null;
  }, [props.post.content, props.post.blob]);

  const playerRef = useRef<AudioPlayerHandle>(null);

  const togglePlayback = useCallback(async () => {
    const player = playerRef.current;
    if (!player) {
      return;
    }
    const { isPlaying } = await player.togglePlayPause();
    if (!isPlaying) {
      player.stop();
    }
  }, []);

  return (
    <Pressable padding={20} onPress={togglePlayback}>
      <ChatAuthorRow
        author={props.post.author}
        authorId={props.post.authorId}
      />
      {audioUrl && <AudioPlayer url={audioUrl} ref={playerRef} />}
    </Pressable>
  );
};
