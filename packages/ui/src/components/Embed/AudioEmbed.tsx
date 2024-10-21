import { forwardRef } from 'react';

import * as shared from './AudioEmbedShared';

const AudioEmbed: shared.AudioEmbed = ({ url }: { url: string }) => {
  // TODO: This is a placeholder for web. Implement a better audio player.

  return (
    <audio controls>
      <source src={url} type="audio/mpeg" />
      Your browser does not support the audio element.
    </audio>
  );
};

export const AudioPlayer: shared.AudioPlayer = forwardRef(function AudioPlayer(
  { url },
  _ref
) {
  // TODO: This is a placeholder for web. Implement a better audio player.

  return (
    <audio controls>
      <source src={url} type="audio/mpeg" />
      Your browser does not support the audio element.
    </audio>
  );
});

export default AudioEmbed;
