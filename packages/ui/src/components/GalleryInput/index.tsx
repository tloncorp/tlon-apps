import { useState } from 'react';

import { TextArea } from '../../core';
import { GalleryInputProps } from './GalleryInputBase';
import { GalleryInputContainer } from './GalleryInputBase';

export function MessageInput({
  shouldBlur,
  setShouldBlur,
  send,
  channelId,
  groupMembers,
}: GalleryInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <GalleryInputContainer
      containerHeight={0}
      groupMembers={groupMembers}
      onSelectMention={() => {}}
      editorIsEmpty={true}
    >
      <TextArea
        flexGrow={1}
        borderRadius="$xl"
        borderWidth={0}
        fontWeight="$s"
        backgroundColor="$secondaryBackground"
        size="$m"
        height="auto"
        placeholder="Message"
        enterKeyHint="send"
        multiline={true}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
    </GalleryInputContainer>
  );
}
