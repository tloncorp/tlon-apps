import { ElementRef, useCallback, useMemo, useRef } from 'react';
import { View } from 'tamagui';

import { RenderItemType } from '../contexts/componentsKits';
import { ChatAuthorRow } from './AuthorRow';
import { AudioPlayer } from './Embed/AudioEmbed';
import { convertContent } from './PostContent/contentUtils';

export const AudioPost: RenderItemType = (props) => {
  const audioUrl = useMemo(() => {
    const content = convertContent(props.post.content);
    if (content[0].type === 'image') {
      return content[0].src;
    }
    return null;
  }, [props.post.content]);

  const playerRef = useRef<ElementRef<typeof AudioPlayer>>(null);

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
    <View padding={20} onPress={togglePlayback}>
      <ChatAuthorRow
        author={props.post.author}
        authorId={props.post.authorId}
      />
      {audioUrl && <AudioPlayer url={audioUrl} ref={playerRef} />}
    </View>
  );
};
